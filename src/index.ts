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

interface Sub {
    __callback: () => void;
    __cleanups: Set<(subToDelete: Sub) => void>;
}

interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface Event<T = void> {
    (payload: T): T;
    readonly on: (callback: (payload: T) => void) => () => void;
}

interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

let currentSub: Sub | null = null;

let batchedObjsSubs: Set<Set<Sub>> | null = null;

const scheduleNotify = (subs: Set<Sub>) => {
    if (batchedObjsSubs) {
        batchedObjsSubs.add(subs);

        return;
    }

    batchedObjsSubs = new Set([subs]);
    Promise.resolve().then(() => {
        const objsSubs = batchedObjsSubs as Set<Set<Sub>>;

        batchedObjsSubs = null;

        // We need to collect all subs to calling each of them once
        const uniqueSubs = new Set<Sub>();

        objsSubs.forEach((objSubs) => objSubs.forEach((sub) => uniqueSubs.add(sub)));
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
    let value = typeof initializer === 'function' ? (initializer as () => T)() : initializer;
    const subs = new Set<Sub>();
    const cleanup = (subToDelete: Sub) => subs.delete(subToDelete);
    const signal: Signal<T> = Object.assign(
        (...args: any[]) => {
            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

                if (nextValue === value) {
                    return value;
                }

                value = nextValue;

                // We don't need to add signal to the batchedObjs if signal has no subs
                if (subs.size) {
                    scheduleNotify(subs);
                }

                return value;
            }

            if (currentSub) {
                subs.add(currentSub);
                currentSub.__cleanups.add(cleanup);
            }

            return value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(signal()));

                autoSubscribe(signal, sub);

                return () => unsubscribe(sub);
            }
        }
    );

    return signal;
};

const createEvent = <T = void>(): Event<T> => {
    const callbacks = new Set<(payload: T) => void>();
    const event: Event<T> = Object.assign(
        (payload: T) => {
            callbacks.forEach((callback) => callback(payload));

            return payload;
        },
        {
            on: (callback: (payload: T) => void) => {
                callbacks.add(callback);

                return () => {
                    callbacks.delete(callback);
                };
            }
        }
    );

    return event;
};

const createComputed = <T>(selector: () => T): Computed<T> => {
    let value: T;
    const subs = new Set<Sub>();
    const sub = createSub(() => {
        if (subs.size) {
            const nextValue = autoSubscribe(selector, sub);

            if (nextValue !== value) {
                value = nextValue;
                scheduleNotify(subs);
            }

            return;
        }

        unsubscribe(sub);
    });
    const cleanup = (subToDelete: Sub) => subs.delete(subToDelete);
    const computed: Computed<T> = Object.assign(
        () => {
            if (currentSub) {
                subs.add(currentSub);
                currentSub.__cleanups.add(cleanup);
            }

            if (sub.__cleanups.size) {
                return value;
            }

            value = autoSubscribe(selector, sub);

            return value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(computed()));

                autoSubscribe(computed, sub);

                return () => unsubscribe(sub);
            }
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
            sub: createSub(() => {}),
            handleChange: () => {},
            subscribe: (handleChange: () => void) => {
                vars.current!.handleChange = handleChange;

                return () => unsubscribe(vars.current!.sub);
            }
        };
    }

    let value = autoSubscribe(obj, vars.current.sub);

    // We need to set sub callback because value and obj can be different during component re-render
    vars.current.sub.__callback = () => {
        value = autoSubscribe(obj, vars.current!.sub);
        vars.current!.handleChange();
    };

    // We just return value from closure inside getSnapshot because we are already subscribed
    return useSyncExternalStoreShim(vars.current.subscribe, () => value);
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
