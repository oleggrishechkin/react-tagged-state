import { useEffect, useState } from 'react';

type Deps = Record<number, boolean>;

type DepsRef = { current: Deps };

interface Subscribe<Type> {
    (subscriber: Type): () => void;
}

const createSubscription = <Type>() => {
    const subscribers = new Set<Type>();
    const subscribe = (subscriber: Type) => {
        subscribers.add(subscriber);

        return () => {
            subscribers.delete(subscriber);
        };
    };

    return [subscribers, subscribe] as const;
};

const [effectsSubscribers, effectsSubscribe] = createSubscription<{ effect: () => void; depsRef: DepsRef }>();

let batchedDeps: Deps = {};

let batchPromise: Promise<void> | null = null;

const notifyEffectsSubscribers = () => {
    const batchedDepsCopy = batchedDeps;

    batchedDeps = {};
    batchPromise = null;

    effectsSubscribers.forEach(({ effect, depsRef }) => {
        for (const batchedDepsCopyKey in batchedDepsCopy) {
            if (depsRef.current[batchedDepsCopyKey]) {
                effect();

                break;
            }
        }
    });
};

const batchNotifyEffectSubscribers = (key: number): void => {
    batchedDeps[key] = true;

    if (batchPromise) {
        return;
    }

    batchPromise = Promise.resolve().then(notifyEffectsSubscribers);
};

const flush = (): Promise<void> => batchPromise || Promise.resolve();

let globalDeps: Deps | null = null;

interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

let uniqueNumber = 0;

const createState = <Type>(initialState: Type): State<Type> => {
    const [subscribers, subscribe] = createSubscription<(payload: Type) => void>();
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
            subscribers.forEach((callback) => callback(state));
            batchNotifyEffectSubscribers(key);
        }
    };
};

const callWithDeps = <Type>(func: () => Type, depsRef: DepsRef): Type => {
    globalDeps = depsRef.current = {};

    const result = func();

    globalDeps = null;

    return result;
};

interface Computed<Type> {
    (): Type;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

const createComputed = <Type>(selector: Selector<Type>): Computed<Type> => {
    const depsRef: DepsRef = { current: {} };
    const [subscribers, subscribe] = createSubscription<(payload: Type) => void>();
    const key = ++uniqueNumber;
    let computed = callWithDeps(selector, depsRef);

    effectsSubscribe({
        effect: () => {
            const nextValue = callWithDeps(selector, depsRef);

            if (nextValue !== computed) {
                computed = nextValue;
                subscribers.forEach((callback) => callback(computed));
                batchNotifyEffectSubscribers(key);
            }
        },
        depsRef
    });

    return (...args: any[]): any => {
        if (args[0]?.raw) {
            return subscribe;
        }

        if (globalDeps) {
            globalDeps[key] = true;
        }

        return computed;
    };
};

interface Event<Type> {
    (payload: Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): Subscribe<(payload: Type) => any>;
}

const createEvent = <Type = void>(): Event<Type> => {
    const [subscribers, subscribe] = createSubscription<(payload: Type) => void>();

    return (...args: any[]): any => {
        if (args[0]?.raw) {
            return subscribe;
        }

        const payload = args[0];

        subscribers.forEach((callback) => callback(payload));
    };
};

interface Effect {
    (): void;
}

const createEffect = (effect: Effect): (() => void) => {
    const depsRef: DepsRef = { current: {} };

    callWithDeps(effect, depsRef);

    return effectsSubscribe({
        effect: () => callWithDeps(effect, depsRef),
        depsRef
    });
};

interface Selector<Type> {
    (): Type;
}

const useSelector = <Type>(selector: Selector<Type> | State<Type> | Computed<Type>): Type => {
    const [{ state }, setState] = useState(() => {
        const depsRef = { current: {} };

        return {
            state: { value: callWithDeps(selector, depsRef), selector, depsRef }
        };
    });

    useEffect(
        () =>
            effectsSubscribe({
                effect: () => {
                    const nextValue = callWithDeps(state.selector, state.depsRef);

                    if (nextValue !== state.value) {
                        state.value = nextValue;
                        setState({ state });
                    }
                },
                depsRef: state.depsRef
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    if (state.selector !== selector) {
        state.selector = selector;
        state.value = callWithDeps(state.selector, state.depsRef);
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
