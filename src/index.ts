import { ForwardRefRenderFunction, FunctionComponent, useEffect, useReducer } from 'react';

let currentSubscriber: Subscriber | null = null;

export interface Subscriber {
    callback: () => any;
    cleanups: Set<(subscriber: Subscriber) => any>;
}

export interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
}

export const createState = <Type>(initialValue?: (() => Type) | Type): State<Type> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const subscribers = new Set<Subscriber>();
    const cleanup = (subscriber: Subscriber) => subscribers.delete(subscriber);

    return (...args: any[]): any => {
        if (!args.length) {
            if (currentSubscriber) {
                subscribers.add(currentSubscriber);
                currentSubscriber.cleanups.add(cleanup);
            }

            return value;
        }

        const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

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

export const track = <Type>(func: (() => Type) | State<Type>, subscriber: Subscriber) => {
    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const result = func();

    currentSubscriber = tmp;

    return result;
};

export const compute = <Type>(func: (() => Type) | State<Type>) => {
    if (!currentSubscriber) {
        return func();
    }

    const subscriber: Subscriber = { callback: () => {}, cleanups: new Set() };
    const tmp = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = tmp;
    tmp.cleanups.add(() => {
        subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
        subscriber.cleanups.clear();
    });
    subscriber.callback = () => value !== func() && tmp.callback();

    return value;
};

export interface Effect {
    (callback: () => void | (() => void)): () => void;
    <Type>(func: (() => Type) | State<Type> | Event<Type>, callback: (value: Type) => void | (() => void)): () => void;
}

export const effect: Effect = (...args: any[]): (() => void) => {
    if (args.length > 1 && '_subscribe' in args[0]) {
        return args[0]._subscribe(args[1]);
    }

    const subscriber: Subscriber = { callback: () => {}, cleanups: new Set() };

    subscriber.callback = () => {
        subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
        subscriber.cleanups.clear();

        const cleanup = args.length > 1 ? args[1](track(args[0], subscriber)) : track(args[0], subscriber);

        if (typeof cleanup === 'function') {
            subscriber.cleanups.add(() => cleanup());
        }
    };

    if (args.length > 1) {
        track(args[0], subscriber);
    } else {
        subscriber.callback();
    }

    return () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
};

const init = () => ({ subscriber: { callback: () => {}, cleanups: new Set<(subscriber: Subscriber) => any>() } });

const reducer = ({ subscriber }: { subscriber: Subscriber }) => ({ subscriber });

export const useObserver = <Type>(func: (() => Type) | State<Type>) => {
    const [{ subscriber }, callback] = useReducer(reducer, null, init);

    subscriber.callback = () => {
        subscriber.cleanups.forEach((cleanup) => cleanup(subscriber));
        subscriber.cleanups.clear();
        callback();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => subscriber.cleanups.forEach((cleanup) => cleanup(subscriber)), []);

    return track(func, subscriber);
};

export const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
) => {
    const ObserverComponent = (props: any, ref: any) => useObserver(() => wrappedComponent(props, ref));

    ObserverComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return ObserverComponent as Type;
};
