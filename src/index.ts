import { ForwardRefRenderFunction, FunctionComponent, useEffect, useState } from 'react';

const listeners: Map<
    () => any,
    {
        current: Record<number, Array<() => boolean> | true>;
    }
> = new Map();

const listen = (
    callback: () => any,
    depsRef: {
        current: Record<number, Array<() => boolean> | true>;
    }
): (() => void) => {
    listeners.set(callback, depsRef);

    return () => {
        listeners.delete(callback);
    };
};

export interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
    on: (callback: (value: Type) => any) => () => void;
}

let uniqueNumber = 0;

let globalDeps: Record<number, Array<() => boolean> | true>;

let globalCheck: (() => boolean) | null = null;

export const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    const key = ++uniqueNumber;
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const state = (...args: any[]): any => {
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
            listeners.forEach((depsRef, callback) => {
                if (
                    key in depsRef.current &&
                    (depsRef.current[key] === true ||
                        (depsRef.current[key] as Array<() => boolean>).some((check) => check()))
                ) {
                    callback();
                }
            });
        }
    };

    state.on = (callback: (value: Type) => any) =>
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

    return state;
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

const track = <Type>(func: (() => Type) | State<Type>, deps: Record<number, Array<() => boolean> | true>) => {
    const tmp = globalDeps;

    globalDeps = deps;

    const result = func();

    globalDeps = tmp;

    return result;
};

export const compute = <Type>(func: () => Type) => {
    // eslint-disable-next-line prefer-const
    let result: Type;

    globalCheck = () => func() !== result;
    result = func();
    globalCheck = null;

    return result;
};

export const effect = (callback: () => any) => {
    const depsRef = { current: {} };

    track(callback, depsRef.current);

    return listen(() => {
        track(callback, (depsRef.current = {}));
    }, depsRef);
};

export const useObserver = () => {
    const [{ depsRef, get }, forceUpdate] = useState(() => {
        const depsRef = { current: {} };
        const get = <Type>(func: (() => Type) | State<Type>) => track(func, depsRef.current);

        return { depsRef, get };
    });

    depsRef.current = {};

    useEffect(
        () =>
            listen(() => {
                forceUpdate({ depsRef, get });
            }, depsRef),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    return get;
};

export const observer = <Type extends FunctionComponent<any> | ForwardRefRenderFunction<any, any>>(
    wrappedComponent: Type
) => {
    const EnhanceComponent = (props: any, ref: any) => useObserver()(() => wrappedComponent(props, ref));

    EnhanceComponent.displayName = `observer(${wrappedComponent.displayName || wrappedComponent.name || 'Component'})`;

    return EnhanceComponent as Type;
};
