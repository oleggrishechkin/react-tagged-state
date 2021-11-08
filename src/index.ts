import { useEffect, useRef, useState, DependencyList, useMemo } from 'react';

type Deps = Record<number, boolean>;

type DepsRef = { current: Deps | undefined };

interface Subscribe<Type> {
    (subscriber: Type): () => void;
}

const createSubscribe =
    <Type>(subscribers: Set<Type>): Subscribe<Type> =>
    (subscriber) => {
        subscribers.add(subscriber);

        return () => {
            subscribers.delete(subscriber);
        };
    };

const effectsSubscribers: Set<{ effect: () => void; depsRef: DepsRef }> = new Set();

const effectsSubscribe = createSubscribe(effectsSubscribers);

let batchedDeps: Deps = {};

let batchPromise: Promise<void> | null = null;

const notifyEffectsSubscribers = (key: number): void => {
    batchedDeps[key] = true;

    if (batchPromise) {
        return;
    }

    batchPromise = Promise.resolve().then(() => {
        const batchedDepsCopy = batchedDeps;

        batchedDeps = {};
        batchPromise = null;

        let batchedDepsCopyKey;

        effectsSubscribers.forEach(({ effect, depsRef }) => {
            for (batchedDepsCopyKey in batchedDepsCopy) {
                if (depsRef.current?.[batchedDepsCopyKey]) {
                    effect();

                    break;
                }
            }
        });
    });
};

const flush = (): Promise<void> => batchPromise || Promise.resolve();

let globalDeps: Deps | null = null;

const callWithDeps = <Type>(func: () => Type, depsRef: DepsRef): Type => {
    globalDeps = depsRef.current = {};

    const result = func();

    globalDeps = null;

    return result;
};

interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

let uniqueNumber = 0;

const createState = <Type>(initialState: Type): State<Type> => {
    const subscribers: Set<(payload: Type) => any> = new Set();
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

interface Computed<Type> {
    (): Type;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

const createComputed = <Type>(selector: Selector<Type>): Computed<Type> => {
    const depsRef: DepsRef = { current: {} };
    const subscribers: Set<(payload: Type) => any> = new Set();
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

interface Event<Type> {
    (payload: Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

const createEvent = <Type = void>(): Event<Type> => {
    const subscribers: Set<(payload: Type) => any> = new Set();
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

interface Effect {
    (): void;
}

const createEffect = (effect: Effect): (() => void) => {
    const depsRef: DepsRef = { current: {} };

    callWithDeps(effect, depsRef);

    return effectsSubscribe({
        effect: () => {
            callWithDeps(effect, depsRef);
        },
        depsRef
    });
};

interface Selector<Type> {
    (): Type;
}

const useSelector = <Type>(
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

export {
    Subscribe,
    State,
    Computed,
    Event,
    Effect,
    Selector,
    flush,
    createState,
    createComputed,
    createEvent,
    createEffect,
    useSelector
};
