import { useEffect, useRef, useState, DependencyList, useMemo } from 'react';

type DepKey = number | string;

type Deps = Record<DepKey, boolean>;

type DepsRef = { current: Deps | undefined };

export interface Callback<Type> {
    (payload: Type): any;
}

export interface Cleanup {
    (): void;
}

export interface Effect {
    (): any;
}

export interface Selector<Type> {
    (): Type;
}

export interface Subscribe<Type> {
    (subscriber: Type): Cleanup;
}

export type Updater<Type> = ((value: Type) => Type) | Type;

export interface State<Type> {
    (): Type;
    (updater: Updater<Type>): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<Callback<Type>>;
}

export interface Computed<Type> {
    (): Type;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<Callback<Type>>;
}

export interface Event<Type> {
    (payload: Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<Callback<Type>>;
}

const createSubscribe =
    <Type>(subscribers: Set<Type>): Subscribe<Type> =>
    (subscriber) => {
        subscribers.add(subscriber);

        return () => {
            subscribers.delete(subscriber);
        };
    };

const effectsSubscribers: Set<{ effect: Callback<void>; depsRef: DepsRef }> = new Set();

const effectsSubscribe = createSubscribe(effectsSubscribers);

let batchedDeps: Deps = {};

let batchPromise: Promise<void> | null = null;

const notifyEffectsSubscribers = (key: DepKey): void => {
    batchedDeps[key] = true;

    if (batchPromise) {
        return;
    }

    batchPromise = Promise.resolve().then(() => {
        const batchedDepsCopy = batchedDeps;

        batchedDeps = {};
        batchPromise = null;

        let batchedDepKey;

        effectsSubscribers.forEach(({ effect, depsRef }) => {
            for (batchedDepKey in batchedDepsCopy) {
                if (depsRef.current?.[batchedDepKey]) {
                    effect();

                    break;
                }
            }
        });
    });
};

let globalDeps: Deps | null = null;

let uniqueNumber = 0;

const callWithDeps = <Type>(func: () => Type, depsRef: DepsRef): Type => {
    globalDeps = depsRef.current = {};

    const result = func();

    globalDeps = null;

    return result;
};

export const createState = <Type>(initialState: Type): State<Type> => {
    const subscribers: Set<Callback<Type>> = new Set();
    const subscribe = createSubscribe(subscribers);
    const key = ++uniqueNumber;
    let state = initialState;

    return (...args: any[]): any => {
        if (!args.length) {
            if (globalDeps) {
                globalDeps[key] = true;
            }

            return state;
        }

        if (args[0]?.raw) {
            return subscribe;
        }

        const nextState = typeof args[0] === 'function' ? args[0](state) : args[0];

        if (nextState !== state) {
            state = nextState;
            subscribers.forEach((callback) => {
                callback(state);
            });
            notifyEffectsSubscribers(key);
        }
    };
};

export const createComputed = <Type>(selector: Selector<Type>): Computed<Type> => {
    const depsRef: DepsRef = { current: {} };
    const subscribers: Set<Callback<Type>> = new Set();
    const subscribe = createSubscribe(subscribers);
    const key = ++uniqueNumber;
    let computed = callWithDeps(selector, depsRef);

    effectsSubscribe({
        effect: () => {
            const nextValue = callWithDeps(selector, depsRef);

            if (nextValue !== computed) {
                computed = nextValue;
                subscribers.forEach((callback) => {
                    callback(computed);
                });
                notifyEffectsSubscribers(key);
            }
        },
        depsRef
    });

    return (...args: any[]): any => {
        if (!args.length) {
            if (globalDeps) {
                globalDeps[key] = true;
            }

            return computed;
        }

        if (args[0]?.raw) {
            return subscribe;
        }
    };
};

export const createEvent = <Type = void>(): Event<Type> => {
    const subscribers: Set<Callback<Type>> = new Set();
    const subscribe = createSubscribe(subscribers);

    return (...args: any[]): any => {
        if (args[0]?.raw) {
            return subscribe;
        }

        subscribers.forEach((callback) => {
            callback(args[0]);
        });
    };
};

export const createEffect = (effect: Effect): Cleanup => {
    const depsRef: DepsRef = { current: {} };

    callWithDeps(effect, depsRef);

    return effectsSubscribe({
        effect: () => {
            callWithDeps(effect, depsRef);
        },
        depsRef
    });
};

export const useSelector = <Type>(
    selector: Selector<Type> | State<Type> | Computed<Type>,
    deps: DependencyList = []
): Type => {
    const memoizedSelector = useMemo(() => selector, deps);
    const depsRef = useRef<Deps>();
    const [state, setState] = useState<{ value: Type; selector: Selector<Type> | State<Type> | Computed<Type> }>(
        () => ({
            value: callWithDeps(memoizedSelector, depsRef),
            selector: memoizedSelector
        })
    );

    useEffect(
        () =>
            effectsSubscribe({
                effect: () => {
                    const nextValue = callWithDeps(memoizedSelector, depsRef);

                    setState((prevState) => {
                        if (memoizedSelector !== prevState.selector || nextValue === prevState.value) {
                            return prevState;
                        }

                        return { value: nextValue, selector: memoizedSelector };
                    });
                },
                depsRef
            }),
        [memoizedSelector]
    );

    if (memoizedSelector !== state.selector) {
        state.value = callWithDeps(memoizedSelector, depsRef);
        state.selector = memoizedSelector;
    }

    return state.value;
};
