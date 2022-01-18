import { ForwardRefRenderFunction, FunctionComponent, useEffect, useReducer } from 'react';

const noop = () => {};

interface Subscriber {
    callback: () => any;
    cleanups: Set<(subscriber: Subscriber) => any>;
}

let currentSubscriber: Subscriber | null = null;

export interface State<Type> {
    (): Type;
    (updater: Type | ((value: Type) => Type)): void;
}

export const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const subscribers = new Set<Subscriber>();
    const deleteSubscriber = (subscriber: Subscriber) => subscribers.delete(subscriber);

    return function (updater?: any): any {
        if (arguments.length) {
            const nextValue = typeof updater === 'function' ? updater(value) : updater;

            if (nextValue !== value) {
                value = nextValue;
                subscribers.forEach((subscriber) => subscriber.callback());
            }
        }

        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.cleanups.add(deleteSubscriber);
        }

        return value;
    };
};

export interface Event<Type> {
    (value: Type): void;
    readonly _subscribe: (callback: (value: Type) => any) => () => void;
}

export const createEvent = <Type = void>(): Event<Type> => {
    const subscribers = new Set<(value: Type) => any>();

    return Object.assign((value: Type) => subscribers.forEach((subscriber) => subscriber(value)), {
        _subscribe: (callback: (value: Type) => any) => {
            const subscriber = (value: Type) => () => Promise.resolve().then(() => callback(value));

            subscribers.add(subscriber);

            return () => {
                subscribers.delete(subscriber);
            };
        }
    });
};

const cleanupSubscriber = (subscriber: Subscriber) => {
    subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
    subscriber.cleanups.clear();
};

const track = <Type>(func: (() => Type) | State<Type>, subscriber: Subscriber) => {
    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = tmp;

    return value;
};

export const compute = <Type>(func: (() => Type) | State<Type>) => {
    if (!currentSubscriber) {
        return func();
    }

    const subscriber: Subscriber = { callback: noop, cleanups: new Set() };
    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const value = track(func, subscriber);

    currentSubscriber = tmp;

    subscriber.callback = () => value !== func() && tmp.callback();
    currentSubscriber.cleanups.add(() => cleanupSubscriber(subscriber));

    return value;
};

interface Effect {
    (callback: () => any): () => void;
    <Type>(func: (() => Type) | State<Type> | Event<Type>, callback: (value: Type) => any): () => void;
}

export const effect: Effect = (
    func: (...args: any[]) => any,
    callback?: (value: any) => void | (() => void)
): (() => void) => {
    const subscriber: Subscriber = { callback: noop, cleanups: new Set() };

    if (currentSubscriber) {
        currentSubscriber.cleanups.add(() => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)));
    }

    if ('_subscribe' in func) {
        if (callback) {
            subscriber.cleanups.add((func as Event<any>)._subscribe(callback));
        }
    } else {
        const tmp = currentSubscriber;

        currentSubscriber = subscriber;
        func();
        currentSubscriber = tmp;
        subscriber.callback = () => {
            subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
            subscriber.cleanups.clear();
            Promise.resolve().then(() => {
                const tmp = currentSubscriber;

                currentSubscriber = subscriber;

                const value = func();

                currentSubscriber = tmp;

                if (callback) {
                    callback(value);
                }
            });
        };
    }

    return () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
};

export const cleanup = (func: () => any) => {
    if (currentSubscriber) {
        currentSubscriber.cleanups.add(func);
    }
};

const init = (): { subscriber: Subscriber } => ({ subscriber: { callback: noop, cleanups: new Set() } });

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
        subscriber.cleanups.clear();
        Promise.resolve().then(forceUpdate);
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
