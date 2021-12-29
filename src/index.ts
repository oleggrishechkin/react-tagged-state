import { ForwardRefRenderFunction, FunctionComponent, useEffect, useState } from 'react';

type Deps = Record<number, Array<() => boolean> | true>;

interface DepsRef {
    current: Deps;
}

const listeners: Map<() => any, DepsRef> = new Map();

const listen = (callback: () => any, depsRef: DepsRef): (() => void) => {
    listeners.set(callback, depsRef);

    return () => {
        listeners.delete(callback);
    };
};

const notify = (key: number): void => {
    listeners.forEach((depsRef, callback) => {
        if (
            key in depsRef.current &&
            (depsRef.current[key] === true || (depsRef.current[key] as Array<() => boolean>).find((check) => check()))
        ) {
            callback();
        }
    });
};

export interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
    on: (callback: (value: Type) => any) => () => void;
}

let uniqueNumber = 0;

let globalDeps: Deps;

let globalCheck: (() => boolean) | null = null;

export const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    const key = ++uniqueNumber;
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const signal = (...args: any[]): any => {
        if (!args.length) {
            if (globalDeps && globalDeps[key] !== true) {
                if (globalCheck) {
                    if (key in globalDeps) {
                        (globalDeps[key] as Array<() => boolean>).push(globalCheck);
                    } else {
                        globalDeps[key] = [globalCheck];
                    }
                } else {
                    globalDeps[key] = true;
                }
            }

            return value;
        }

        const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

        if (nextValue !== value) {
            value = nextValue;
            notify(key);
        }
    };

    signal.on = (callback: (value: Type) => any) =>
        listen(
            () => {
                callback(value);
            },
            {
                current: {
                    [key]: true
                }
            }
        );

    return signal;
};

export interface Event<Type> {
    (payload: Type): void;
    on: (callback: (payload: Type) => any) => () => void;
}

export const createEvent = <Type = void>(): Event<Type> => {
    const subscribers: Set<(payload: Type) => any> = new Set();
    const event = (payload: Type): void => {
        subscribers.forEach((callback) => callback(payload));
    };

    event.on = (callback: (payload: Type) => any) => {
        subscribers.add(callback);

        return () => {
            subscribers.delete(callback);
        };
    };

    return event;
};

const track = <Type>(func: (() => Type) | State<Type>, deps: Deps) => {
    const tmp = globalDeps;

    globalDeps = deps;

    const result = func();

    globalDeps = tmp;

    return result;
};

export const compute = <Type>(func: (() => Type) | State<Type>) => {
    // eslint-disable-next-line prefer-const
    let result: Type;

    globalCheck = () => func() !== result;
    result = func();

    globalCheck = null;

    return result;
};

export const effect = (callback: () => any) => {
    const depsRef = { current: {} };

    track(callback, depsRef);

    return listen(() => {
        track(callback, (depsRef.current = {}));
    }, depsRef);
};

export const useObserver = <Type>(func: (() => Type) | State<Type>) => {
    const [{ depsRef }, forceUpdate] = useState({ depsRef: { current: {} } });

    useEffect(
        () =>
            listen(() => {
                forceUpdate({ depsRef });
            }, depsRef),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    return track(func, (depsRef.current = {}));
};

export const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
) => {
    const EnhanceComponent = (props: any, ref: any) => useObserver(() => wrappedComponent(props, ref));

    EnhanceComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return EnhanceComponent as Type;
};
