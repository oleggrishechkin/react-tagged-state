interface CheckRef {
    current: () => boolean;
}

interface DepsRef {
    current: Record<
        number,
        {
            directly: boolean;
            withChecks: CheckRef[];
        }
    >;
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
        if (depsRef.current[key]?.directly || depsRef.current[key]?.withChecks.some((check) => check?.current())) {
            callback();
        }
    });
};

interface State<Type> {
    (): Type;
    (updater: ((value: Type) => Type) | Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): (callback: (value: Type) => any) => () => void;
}

let uniqueNumber = 0;

let globalDepsRef: DepsRef;

let globalCheckRef: CheckRef;

const createState = <Type>(initialValue: (() => Type) | Type): State<Type> => {
    const key = ++uniqueNumber;
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const $$ReactTaggedState = (...args: any[]): any => {
        if (!args.length) {
            if (globalDepsRef) {
                if (!globalDepsRef.current[key]) {
                    globalDepsRef.current[key] = {
                        directly: false,
                        withChecks: []
                    };
                }

                if (globalCheckRef) {
                    globalDepsRef.current[key].withChecks.push(globalCheckRef);
                } else {
                    globalDepsRef.current[key].directly = true;
                }
            }

            return value;
        }

        if (args[0]?.raw) {
            return (callback: (value: Type) => any) =>
                listen(
                    () => {
                        callback(value);
                    },
                    {
                        current: {
                            [key]: {
                                directly: true,
                                withChecks: []
                            }
                        }
                    }
                );
        }

        const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

        if (nextValue !== value) {
            value = nextValue;
            notify(key);
        }
    };

    return $$ReactTaggedState;
};

interface Event<Type> {
    (payload: Type): void;
    (strings: TemplateStringsArray, ...keys: Array<string | number>): (callback: (payload: Type) => any) => () => void;
}

const createEvent = <Type = void>(): Event<Type> => {
    const subscribers: Set<(payload: Type) => any> = new Set();
    const $$ReactTaggedEvent = (...args: any[]): any => {
        if (args[0]?.raw) {
            return (callback: (payload: Type) => any) => {
                subscribers.add(callback);

                return () => {
                    subscribers.delete(callback);
                };
            };
        }

        subscribers.forEach((callback) => callback(args[0]));
    };

    return $$ReactTaggedEvent;
};

interface Selector<Type> {
    (): Type;
}

const callWithDeps = <Type>(func: Selector<Type> | State<Type>, depsRef: DepsRef): Type => {
    depsRef.current = {};

    const tmp = globalDepsRef;

    globalDepsRef = depsRef;

    const result = func();

    globalDepsRef = tmp;

    return result;
};

const compute = <Type>(selector: Selector<Type> | State<Type>): Type => {
    if (globalCheckRef || selector.name === '$$ReactTaggedState') {
        return selector();
    }

    const checkRef: CheckRef = { current: () => false };
    const tmp = globalCheckRef;

    globalCheckRef = checkRef;

    const result = selector();

    checkRef.current = () => selector() !== result;
    globalCheckRef = tmp;

    return result;
};

interface Effect {
    (): () => void;
}

const createEffect =
    (effect: () => any): Effect =>
    () => {
        const depsRef = { current: {} };

        callWithDeps(effect, depsRef);

        return listen(() => {
            callWithDeps(effect, depsRef);
        }, depsRef);
    };

export {
    DepsRef,
    listen,
    State,
    createState,
    Event,
    createEvent,
    Selector,
    callWithDeps,
    compute,
    Effect,
    createEffect
};
