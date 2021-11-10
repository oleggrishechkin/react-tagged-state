import { useEffect, useState } from 'react';

type Deps = Record<number, boolean>;

type DepsRef = { current: Deps };

interface Subscribe<Type> {
    (subscriber: Type): () => void;
}

const createSubscribe =
    <Type>(subscribers: Type[]): Subscribe<Type> =>
    (subscriber) => {
        subscribers.push(subscriber);

        return () => {
            subscribers.splice(subscribers.indexOf(subscriber), 1);
        };
    };

const effectsSubscribers: Array<{ effect: () => void; depsRef: DepsRef }> = [];

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
        let index = 0;
        const length = effectsSubscribers.length;

        for (; index < length; ++index) {
            for (batchedDepsCopyKey in batchedDepsCopy) {
                if (effectsSubscribers[index].depsRef.current[batchedDepsCopyKey]) {
                    effectsSubscribers[index].effect();

                    break;
                }
            }
        }
    });
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
    const subscribers: Array<(payload: Type) => any> = [];
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

            let index = 0;
            const length = subscribers.length;

            for (; index < length; ++index) {
                subscribers[index](nextState);
            }

            notifyEffectsSubscribers(key);
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
    const subscribers: Array<(payload: Type) => any> = [];
    const subscribe = createSubscribe(subscribers);
    const key = ++uniqueNumber;
    let computed = callWithDeps(selector, depsRef);

    effectsSubscribe({
        effect: () => {
            const nextValue = callWithDeps(selector, depsRef);

            if (nextValue !== computed) {
                computed = nextValue;

                let index = 0;
                const length = subscribers.length;

                for (; index < length; ++index) {
                    subscribers[index](nextValue);
                }

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
    const subscribers: Array<(payload: Type) => any> = [];
    const subscribe = createSubscribe(subscribers);

    return (...args: any[]): any => {
        if (args[0]?.raw) {
            return subscribe;
        }

        let index = 0;
        const length = subscribers.length;

        for (; index < length; ++index) {
            subscribers[index](args[0]);
        }
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
