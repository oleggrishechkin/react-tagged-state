import { ForwardRefRenderFunction, FunctionComponent, useEffect, useReducer } from 'react';

const noop = () => {};

interface Subscriber {
    callback: () => any;
    cleanups: Set<(subscriber: Subscriber) => any>;
}

let currentSubscriber: Subscriber | null = null;

export const cleanup = (func: () => any) => {
    if (currentSubscriber) {
        currentSubscriber.cleanups.add(func);
    }
};

export interface State<Type> {
    (): Type;
    (updater: Type | ((value: Type) => Type)): void;
    (string: TemplateStringsArray, ...keys: any[]): (callback: (value: Type) => any) => () => void;
}

export const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    const subscribers = new Set<Subscriber>();
    const deleteSubscriber = (subscriber: Subscriber) => subscribers.delete(subscriber);
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;

    return function (updater?: any): any {
        if (arguments.length) {
            if (updater.raw) {
                return (callback: (value: Type) => any) => {
                    const subscriber: Subscriber = { callback: noop, cleanups: new Set() };

                    subscriber.callback = () => callback(value);

                    subscribers.add(subscriber);

                    return () => {
                        subscribers.delete(subscriber);
                    };
                };
            }

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
    (string: TemplateStringsArray, ...keys: any[]): (callback: (value: Type) => any) => () => void;
}

export const createEvent = <Type = void>(): Event<Type> => {
    const subscribers = new Set<(value: Type) => any>();

    return (value: any): any => {
        if (value.raw) {
            return (callback: (value: Type) => any) => {
                subscribers.add(callback);

                return () => {
                    subscribers.add(callback);
                };
            };
        }

        subscribers.forEach((subscriber) => subscriber(value));
    };
};

export const compute = <Type>(func: () => Type) => {
    if (currentSubscriber) {
        const subscriber: Subscriber = { callback: noop, cleanups: new Set() };
        const tmp = currentSubscriber;

        currentSubscriber = subscriber;

        const value = func();

        currentSubscriber = tmp;
        subscriber.callback = () => value !== func() && tmp.callback();
        tmp.cleanups.add(() => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)));

        return value;
    }

    return func();
};

export const effect = (func: () => any) => {
    const subscriber: Subscriber = { callback: noop, cleanups: new Set() };
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
            func();
            currentSubscriber = tmp;
        });
    };

    if (tmp) {
        tmp.cleanups.add(() => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)));
    }

    return () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
};

const init = (): { subscriber: Subscriber } => ({ subscriber: { callback: noop, cleanups: new Set() } });

const reducer = ({ subscriber }: { subscriber: Subscriber }) => ({ subscriber });

export const useObserver = <Type>(func: (() => Type) | State<Type>) => {
    const [{ subscriber }, forceUpdate] = useReducer(reducer, null, init);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)), []);
    subscriber.callback = () => {
        subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
        subscriber.cleanups.clear();
        Promise.resolve().then(forceUpdate);
    };
    subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
    subscriber.cleanups.clear();

    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = tmp;

    return value;
};

export const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
) => {
    const ObserverComponent = (props: any, ref: any) => useObserver(() => wrappedComponent(props, ref));

    ObserverComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return ObserverComponent as Type;
};
