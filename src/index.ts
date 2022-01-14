import { ForwardRefRenderFunction, FunctionComponent, useEffect, useReducer } from 'react';

let currentSubscriber: Subscriber | null = null;

interface Subscriber {
    callback: () => any;
    cleanups: Set<(subscriber: Subscriber) => any>;
}

export interface State<Type> {
    (): Type;
    (updater: Type | ((value: Type) => Type)): void;
}

export const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const subscribers = new Set<Subscriber>();
    const cleanup = (subscriber: Subscriber) => subscribers.delete(subscriber);

    return function (updater?: any): any {
        if (!arguments.length) {
            if (currentSubscriber) {
                subscribers.add(currentSubscriber);
                currentSubscriber.cleanups.add(cleanup);
            }

            return value;
        }

        const nextValue = typeof updater === 'function' ? updater(value) : updater;

        if (nextValue !== value) {
            value = nextValue;
            subscribers.forEach((subscriber) => subscriber.callback());
        }
    };
};

export interface Event<Type> {
    (value: Type): void;
    readonly _subscribe: (callback: (value: Type) => any) => () => void;
}

export const createEvent = <Type = void>(): Event<Type> => {
    const subscribers = new Set<(value: Type) => any>();

    return Object.assign((value: Type) => subscribers.forEach((callback) => callback(value)), {
        _subscribe: (callback: (value: Type) => any) => {
            subscribers.add(callback);

            return () => {
                subscribers.delete(callback);
            };
        }
    });
};

export const compute = <Type>(func: (() => Type) | State<Type>) => {
    if (!currentSubscriber) {
        return func();
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tmp = currentSubscriber!;
    const subscriber: Subscriber = { callback: () => {}, cleanups: new Set() };

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = tmp;
    subscriber.callback = () => value !== func() && tmp.callback();
    tmp.cleanups.add(() => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)));

    return value;
};

export interface Effect {
    (callback: () => void | (() => void)): () => void;
    <Type>(func: (() => Type) | State<Type> | Event<Type>, callback: (value: Type) => void | (() => void)): () => void;
}

export const effect: Effect = (
    func: (...args: any[]) => any,
    callback: (...args: any[]) => any = () => {}
): (() => void) => {
    if ('_subscribe' in func) {
        return (func as Event<any>)._subscribe(callback);
    }

    const tmp = currentSubscriber;
    const subscriber: Subscriber = { callback: () => {}, cleanups: new Set() };

    currentSubscriber = subscriber;
    func();
    currentSubscriber = tmp;
    subscriber.callback = () => callback(func());

    if (tmp) {
        tmp.cleanups.add(() => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)));
    }

    return () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
};

const init = () => ({ subscriber: { callback: () => {}, cleanups: new Set<(subscriber: Subscriber) => any>() } });

const reducer = ({ subscriber }: { subscriber: Subscriber }) => ({ subscriber });

export const useObserver = <Type>(func: (() => Type) | State<Type>) => {
    const [{ subscriber }, forceUpdate] = useReducer(reducer, null, init);

    subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
    subscriber.cleanups.clear();

    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = tmp;
    subscriber.callback = () => {
        subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
        forceUpdate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)), []);

    return value;
};

export const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
) => {
    const ObserverComponent = (props: any, ref: any) => useObserver(() => wrappedComponent(props, ref));

    ObserverComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return ObserverComponent as Type;
};
