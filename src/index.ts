// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';

interface Sub {
    __callback: () => void;
    readonly __objs: Set<Signal<any> | Computed<any>>;
}

interface Signal<T> {
    (): T;
    (value: T): T;
    (updater: (value: T) => T): T;
    value: T;
    readonly __subs: Set<Sub>;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface Event<T = void> {
    (payload: T): T;
    readonly __callbacks: Set<(payload: T) => void>;
    readonly on: (callback: (payload: T) => void) => () => void;
}

interface Computed<T> {
    (): T;
    value: T | void;
    __sub: Sub | null;
    readonly __subs: Set<Sub>;
    readonly on: (callback: (value: T) => void) => () => void;
}

let globalSub: Sub | null = null;

let globalObjs: Set<Signal<any> | Computed<any>> | null = null;

const scheduleUpdates = (obj: Signal<any> | Computed<any>) => {
    if (globalObjs) {
        globalObjs.add(obj);

        return;
    }

    globalObjs = new Set([obj]);
    Promise.resolve().then(() => {
        const objs = globalObjs as Set<Signal<any> | Computed<any>>;

        globalObjs = null;

        // We need to collect all subs to calling each of them once
        const batchedSubs = new Set<Sub>();

        objs.forEach((obj) =>
            obj.__subs.forEach((sub) => {
                batchedSubs.add(sub);
            })
        );
        batchedSubs.forEach((sub) => sub.__callback());
    });
};

const createSub = (callback: () => void): Sub => ({
    __callback: callback,
    __objs: new Set()
});

const subUnsubscribe = (sub: Sub) =>
    sub.__objs.forEach((obj) => {
        obj.__subs.delete(sub);

        if (obj.__subs.size) {
            return;
        }

        // If computed has no subs we need to unsubscribe computed sub
        if ('__sub' in obj && obj.__sub) {
            subUnsubscribe(obj.__sub);
            obj.__sub = null;
        }
    });

const subAutoSubscribe = <T>(func: () => T, sub: Sub) => {
    const prevObjs = Array.from(sub.__objs);

    sub.__objs.clear();

    const prevGlobalSub = globalSub;

    globalSub = sub;

    const value = func();

    globalSub = prevGlobalSub;
    // If prev obj has not in next objs we need to unsubscribe from it
    prevObjs.forEach((obj) => {
        if (sub.__objs.has(obj)) {
            return;
        }

        obj.__subs.delete(sub);

        if (obj.__subs.size) {
            return;
        }

        // If computed has no subs we need to unsubscribe computed sub
        if ('__sub' in obj && obj.__sub) {
            subUnsubscribe(obj.__sub);
            obj.__sub = null;
        }
    });

    return value;
};

interface CreateSignal {
    <T>(value: T): Signal<T>;
    <T>(selector: () => T): Signal<T>;
}

const createSignal: CreateSignal = <T>(initializer: T | (() => T)) => {
    const signal: Signal<T> = Object.assign(
        (...args: any[]) => {
            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? args[0](signal.value) : args[0];

                if (nextValue !== signal.value) {
                    signal.value = nextValue;
                    scheduleUpdates(signal);
                }

                return signal.value;
            }

            if (globalSub) {
                signal.__subs.add(globalSub);
                globalSub.__objs.add(signal);
            }

            return signal.value;
        },
        {
            value: typeof initializer === 'function' ? (initializer as () => T)() : initializer,
            __subs: new Set<Sub>(),
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(signal.value));

                signal.__subs.add(sub);

                return () => {
                    signal.__subs.delete(sub);
                };
            }
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
            __callbacks: new Set<(payload: T) => void>(),
            on: (callback: (payload: T) => void) => {
                event.__callbacks.add(callback);

                return () => {
                    event.__callbacks.delete(callback);
                };
            }
        }
    );

    return event;
};

const createComputed = <T>(selector: () => T): Computed<T> => {
    const computed: Computed<T> = Object.assign(
        () => {
            if (globalSub) {
                computed.__subs.add(globalSub);
                globalSub.__objs.add(computed);

                if (computed.__sub) {
                    return computed.value as T;
                }

                // If computed not subscribed yet we need to subscribe it
                computed.__sub = createSub(() => {
                    const nextValue = subAutoSubscribe(selector, computed.__sub as Sub);

                    if (nextValue !== computed.value) {
                        computed.value = nextValue;
                        scheduleUpdates(computed);
                    }
                });
                computed.value = subAutoSubscribe(selector, computed.__sub);

                return computed.value;
            }

            if (computed.__sub) {
                return computed.value as T;
            }

            return selector();
        },
        {
            value: void 0,
            __sub: null,
            __subs: new Set<Sub>(),
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(subAutoSubscribe(computed, sub)));

                subAutoSubscribe(computed, sub);

                return () => subUnsubscribe(sub);
            }
        }
    );

    return computed;
};

interface CreateEffect {
    (func: () => void): () => void;
    (func: () => () => void): () => void;
}

const createEffect: CreateEffect = (func: () => void | (() => void)) => {
    let value: void | (() => void);
    const sub = createSub(() => {
        if (typeof value === 'function') {
            value();
        }

        value = subAutoSubscribe(func, sub);
    });

    value = subAutoSubscribe(func, sub);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        subUnsubscribe(sub);
    };
};

const init = () => ({ inst: {} as { getSnapshot: () => any; value: any } });

const reducer = ({ inst }: ReturnType<typeof init>) => ({ inst });

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T) => {
              const [{ inst }, forceUpdate] = useReducer(reducer, null, init);

              inst.getSnapshot = getSnapshot;
              inst.value = inst.getSnapshot();

              useEffect(() => {
                  if (inst.getSnapshot() !== inst.value) {
                      forceUpdate();
                  }

                  return subscribe(forceUpdate);
                  // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [subscribe]);

              return inst.value;
          }
        : useSyncExternalStore;

interface UseTagged {
    <T>(signal: Signal<T>): T;
    <T>(computed: Computed<T>): T;
    <T>(selector: () => T): T;
}

const useTagged: UseTagged = <T>(obj: Signal<T> | Computed<T> | (() => T)) => {
    const { sub, handleChangeRef, subscribe } = useMemo(() => {
        const sub = createSub(() => {});
        const handleChangeRef = { current: () => {} };
        // We can't subscribe inside this function because it will be called in effect (but need to be called sync)
        // We only set handleChangeRef (it's something like forceUpdate) inside this function instead
        const subscribe = (func: () => void) => {
            handleChangeRef.current = func;

            return () => subUnsubscribe(sub);
        };

        return { sub, handleChangeRef, subscribe };
    }, []);

    let value = subAutoSubscribe(obj, sub);

    // We need to set sub callback because value and obj can be different during component re-render
    sub.__callback = () => {
        const nextValue = subAutoSubscribe(obj, sub);

        if (nextValue !== value) {
            value = nextValue;
            handleChangeRef.current();
        }
    };

    // We just return value from closure inside getSnapshot because we are already subscribed
    return useSyncExternalStoreShim(subscribe, () => value);
};

export { Signal, Event, Computed, createSignal, createEvent, createComputed, createEffect, useTagged };
