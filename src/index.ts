import {
    DependencyList,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    useSyncExternalStore
} from 'react';

let clock = {};

interface Sub {
    __callback: () => void;
    __cleanups: Set<(subToDelete: Sub) => void>;
}

interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void) => () => void;
    readonly __subs: Set<Sub>;
    readonly __cleanup: (sub: Sub) => void;
    __value: T;
    __nextValue: { current: T } | null;
}

interface Event<T = void> {
    (payload: T): T;
    readonly on: (callback: (payload: T) => void) => () => void;
    readonly __callbacks: Set<(payload: T) => void>;
}

interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
    readonly __sub: Sub;
    readonly __subs: Set<Sub>;
    readonly __cleanup: (sub: Sub) => void;
    __value: T | null;
    __nextValue: { current: T } | null;
}

let currentSub: Sub | null = null;

let batchedObjs: Set<Signal<any> | Computed<any>> | null = null;

const scheduleNotify = (obj: Signal<any> | Computed<any>) => {
    if (batchedObjs) {
        batchedObjs.add(obj);

        return;
    }

    batchedObjs = new Set([obj]);
    Promise.resolve().then(() => {
        const objs = batchedObjs!;

        batchedObjs = null;

        // We need to collect all subs to calling each of them once
        const uniqueSubs = new Set<Sub>();

        objs.forEach((obj) => {
            obj.__value = obj.__nextValue!.current;
            obj.__nextValue = null;
            obj.__subs.forEach((sub) => uniqueSubs.add(sub));
        });
        clock = {};
        uniqueSubs.forEach((sub) => sub.__callback());
    });
};

const createSub = (callback: () => void): Sub => ({
    __callback: callback,
    __cleanups: new Set()
});

const unsubscribe = (sub: Sub) => {
    const cleanups = sub.__cleanups;

    sub.__cleanups = new Set();
    cleanups.forEach((cleanup) => cleanup(sub));
};

const autoSubscribe = <T>(func: () => T, sub: Sub) => {
    const prevCleanups = sub.__cleanups;

    sub.__cleanups = new Set();

    const prevGlobalSub = currentSub;

    currentSub = sub;

    const value = func();

    currentSub = prevGlobalSub;
    // If prev obj has not in next objs we need to unsubscribe from it
    prevCleanups.forEach((cleanup) => {
        if (sub.__cleanups.has(cleanup)) {
            return;
        }

        cleanup(sub);
    });

    return value;
};

const sample = <T>(obj: Signal<T> | Computed<T> | (() => T)) => {
    const prevGlobalSub = currentSub;

    currentSub = null;

    const value = obj();

    currentSub = prevGlobalSub;

    return value;
};

const createSignal = <T>(initializer: T | (() => T)) => {
    const signal: Signal<T> = Object.assign(
        (...args: any[]) => {
            if (args.length) {
                if (signal.__nextValue) {
                    signal.__nextValue.current =
                        typeof args[0] === 'function' ? args[0](signal.__nextValue.current) : args[0];

                    return signal.__value;
                }

                const nextValue = typeof args[0] === 'function' ? args[0](signal.__value) : args[0];

                if (nextValue === signal.__value) {
                    return signal.__value;
                }

                if (signal.__subs.size) {
                    signal.__nextValue = { current: nextValue };
                    scheduleNotify(signal);

                    return signal.__value;
                }

                signal.__value = nextValue;

                return signal.__value;
            }

            if (currentSub) {
                signal.__subs.add(currentSub);
                currentSub.__cleanups.add(signal.__cleanup);
            }

            return signal.__value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(signal()));

                autoSubscribe(signal, sub);

                return () => unsubscribe(sub);
            },
            __subs: new Set<Sub>(),
            __cleanup: (sub: Sub) => signal.__subs.delete(sub),
            __nextValue: null,
            __value: typeof initializer === 'function' ? (initializer as () => T)() : initializer
        }
    );

    return signal;
};

const createEvent = <T = void>(): Event<T> => {
    const event: Event<T> = Object.assign(
        (payload: T) => {
            event.__callbacks.forEach((callback) => callback(payload));

            return payload;
        },
        {
            on: (callback: (payload: T) => void) => {
                event.__callbacks.add(callback);

                return () => {
                    event.__callbacks.delete(callback);
                };
            },
            __callbacks: new Set<(payload: T) => void>()
        }
    );

    return event;
};

const createComputed = <T>(selector: () => T): Computed<T> => {
    const computed: Computed<T> = Object.assign(
        () => {
            if (currentSub) {
                computed.__subs.add(currentSub);
                currentSub.__cleanups.add(computed.__cleanup);
            }

            if (computed.__sub.__cleanups.size) {
                return computed.__value!;
            }

            computed.__value = autoSubscribe(selector, computed.__sub);

            return computed.__value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(computed()));

                autoSubscribe(computed, sub);

                return () => unsubscribe(sub);
            },
            __sub: createSub(() => {
                if (computed.__subs.size) {
                    if (computed.__nextValue) {
                        computed.__nextValue.current = autoSubscribe(selector, computed.__sub);

                        return;
                    }

                    const nextValue = autoSubscribe(selector, computed.__sub);

                    if (nextValue !== computed.__value) {
                        computed.__nextValue = { current: nextValue };
                        scheduleNotify(computed);
                    }

                    return;
                }

                computed.__nextValue = null;
                unsubscribe(computed.__sub);
            }),
            __subs: new Set<Sub>(),
            __cleanup: (sub: Sub) => {
                computed.__subs.delete(sub);

                if (computed.__subs.size) {
                    return;
                }

                computed.__nextValue = null;
                unsubscribe(computed.__sub);
            },
            __value: null,
            __nextValue: null
        }
    );

    return computed;
};

const createEffect = (effect: () => void | (() => void)) => {
    let value: void | (() => void);
    const sub = createSub(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(effect, sub);
    });

    value = autoSubscribe(effect, sub);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(sub);
    };
};

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(subscribe: (handleChange: () => void) => () => void, getSnapshot: () => T) => {
              const value = getSnapshot();
              const [{ inst }, forceUpdate] = useState({ inst: { value, getSnapshot } });

              useLayoutEffect(() => {
                  inst.value = value;
                  inst.getSnapshot = getSnapshot;

                  if (inst.value !== inst.getSnapshot()) {
                      forceUpdate({ inst });
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [value, getSnapshot]);
              useEffect(() => {
                  if (inst.value !== inst.getSnapshot()) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (inst.value !== inst.getSnapshot()) {
                          forceUpdate({ inst });
                      }
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [subscribe]);

              return value;
          }
        : useSyncExternalStore;

const useSignal = <T>(obj: Signal<T> | Computed<T>): T => useSyncExternalStoreShim(obj.on, obj);

const useSignalEffect = (effect: () => void | (() => void), deps?: DependencyList) =>
    useEffect(() => createEffect(effect), deps);

const useSelector = <T>(obj: Signal<T> | Computed<T> | (() => T)): T => {
    const vars = useRef<{
        sub: Sub;
        handleChange: () => void;
        subscribe: (handleChange: () => void) => () => void;
    } | null>(null);

    if (vars.current === null) {
        vars.current = {
            sub: createSub(() => vars.current!.handleChange()),
            handleChange: () => {},
            subscribe: (handleChange: () => void) => {
                vars.current!.handleChange = handleChange;

                return () => unsubscribe(vars.current!.sub);
            }
        };
    }

    let currentClock: typeof clock;
    let value: T;

    return useSyncExternalStoreShim(vars.current.subscribe, () => {
        if (currentClock === undefined || currentClock !== clock) {
            currentClock = clock;

            value = autoSubscribe(obj, vars.current!.sub);
        }

        return value;
    });
};

export {
    Signal,
    Event,
    Computed,
    sample,
    createSignal,
    createEvent,
    createComputed,
    createEffect,
    useSignal,
    useSelector,
    useSignalEffect
};
