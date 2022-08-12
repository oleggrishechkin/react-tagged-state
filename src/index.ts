import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

export interface Subscriber {
    callback: () => void;
    signals: Set<Signal<any> | Computed<any>>;
    clock: number;
    level: number;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Event<T> {
    (value: T): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

const isSSR = typeof window === 'undefined';

const noop = () => {};

let clock = 0;

let schedulePromise: Promise<void> | null = null;

let scheduleQueue: Subscriber[][] | null = null;

const schedule = (subscribers: Set<Subscriber>) => {
    if (!scheduleQueue) {
        scheduleQueue = [];
    }

    for (const subscriber of subscribers) {
        if (scheduleQueue[subscriber.level]) {
            scheduleQueue[subscriber.level].push(subscriber);
        } else {
            scheduleQueue[subscriber.level] = [subscriber];
        }
    }

    if (schedulePromise) {
        return;
    }

    schedulePromise = Promise.resolve().then(() => {
        if (!scheduleQueue) {
            return;
        }

        clock++;

        for (let level = 1; level < scheduleQueue.length; level++) {
            if (scheduleQueue[level]) {
                for (let index = 0; index < scheduleQueue[level].length; index++) {
                    if (scheduleQueue[level][index].clock !== clock) {
                        scheduleQueue[level][index].clock = clock;
                        scheduleQueue[level][index].callback();
                    }
                }
            }
        }

        const subscribers = scheduleQueue[0];

        scheduleQueue = null;
        schedulePromise = null;

        if (subscribers) {
            for (let index = 0; index < subscribers.length; index++) {
                if (subscribers[index].clock !== clock) {
                    subscribers[index].clock = clock;
                    subscribers[index].callback();
                }
            }
        }
    });
};

export const flush = async (): Promise<void> => {
    while (schedulePromise) {
        await schedulePromise;
    }
};

const createSubscriber = (callback: () => void = noop, level: 0 | 1 = 0) => ({
    callback,
    signals: new Set<Signal<any> | Computed<any>>(),
    clock,
    level
});

let runDeleteSubscriber: Subscriber | null = null;

let unsubscribeQueue: Subscriber[] | null = null;

const unsubscribe = (subscriber: Subscriber) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.push(subscriber);

        return;
    }

    unsubscribeQueue = [subscriber];

    for (let index = 0; index < unsubscribeQueue.length; index++) {
        for (const signal of unsubscribeQueue[index].signals) {
            runDeleteSubscriber = unsubscribeQueue[index];
            signal();
        }

        unsubscribeQueue[index].signals = new Set();
        unsubscribeQueue[index].clock = clock;
        unsubscribeQueue[index].level = unsubscribeQueue[index].level && 1;
    }

    unsubscribeQueue = null;
};

let runAddSubscriber: Subscriber | null = null;

const autoSubscribe = <T>(func: () => T, subscriber: Subscriber): T => {
    if (isSSR) {
        return func();
    }

    const prevSignals = subscriber.signals;

    subscriber.signals = new Set();
    subscriber.clock = clock;
    subscriber.level = subscriber.level && 1;

    const prevSubscriber = runAddSubscriber;

    runAddSubscriber = subscriber;

    const value = func();

    runAddSubscriber = prevSubscriber;

    for (const signal of prevSignals) {
        if (!subscriber.signals.has(signal)) {
            runDeleteSubscriber = subscriber;
            signal();
        }
    }

    return value;
};

export const sample = <T>(func: () => T): T => {
    const prevSubscriber = runAddSubscriber;

    runAddSubscriber = null;

    const value = func();

    runAddSubscriber = prevSubscriber;

    return value;
};

export const createEvent = <T = void>({ ssr }: { ssr?: boolean } = {}): Event<T> => {
    const callbacks = new Set<(value: T) => void>();
    const event = (value: T) => {
        for (const callback of callbacks) {
            callback(value);
        }

        return value;
    };

    event.on = (callback: (value: T) => void) => {
        if (isSSR && !ssr) {
            return noop;
        }

        callbacks.add(callback);

        return () => {
            callbacks.delete(callback);
        };
    };

    return event;
};

export const reset = createEvent<void | Signal<any> | Computed<any>>({ ssr: true });

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    const subscribers = new Set<Subscriber>();
    const signal = (...args: [T | ((value: T) => T)] | []) => {
        if (runDeleteSubscriber) {
            subscribers.delete(runDeleteSubscriber);
            runDeleteSubscriber = null;

            return value;
        }

        if (args.length) {
            const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(value) : args[0];

            if (nextValue !== value) {
                value = nextValue;

                if (subscribers.size) {
                    schedule(subscribers);
                }
            }

            return value;
        }

        if (runAddSubscriber) {
            subscribers.add(runAddSubscriber);
            runAddSubscriber.signals.add(signal);
        }

        return value;
    };

    signal.on = (callback: (value: T) => void) => {
        if (isSSR) {
            return noop;
        }

        const subscriber = createSubscriber(() => callback(autoSubscribe(signal, subscriber)));

        autoSubscribe(signal, subscriber);

        return () => unsubscribe(subscriber);
    };
    reset.on((signalToReset) => {
        if (!signalToReset || signalToReset === signal) {
            signal(typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
        }
    });

    return signal;
};

let computeQueue: Computed<any>[] | null = null;

let computeRecursionCount = 0;

let runCompute = false;

const compute = <T>(computed: Computed<T>) => {
    if (computeRecursionCount++ < 1000) {
        runCompute = true;
        computed();
        computeRecursionCount = 0;

        return;
    }

    if (computeQueue) {
        computeQueue.push(computed);

        return;
    }

    do {
        computeQueue = [computed];

        for (let index = 0; index < computeQueue.length; index++) {
            runCompute = true;
            computeQueue[index]();
        }

        for (let index = computeQueue.length - 2; index > 0; index--) {
            runCompute = true;
            computeQueue[index]();
        }
    } while (computeQueue.length !== 1);

    computeQueue = null;
};

export const createComputed = <T>(func: () => T, fallback: T): Computed<T> => {
    let value: T = fallback;
    let hasValue = false;
    const subscribers = new Set<Subscriber>();
    const subscriber = createSubscriber(() => {
        if (subscribers.size) {
            const nextValue = autoSubscribe(func, subscriber);

            if (nextValue !== value) {
                value = nextValue;
                schedule(subscribers);
            }

            return;
        }

        value = fallback;
        hasValue = false;
        unsubscribe(subscriber);
    }, 1);
    const computed = () => {
        if (runCompute) {
            runCompute = false;

            if (hasValue) {
                return value;
            }

            if (computeQueue) {
                const length = computeQueue.length;
                const nextValue = autoSubscribe(func, subscriber);

                if (computeQueue.length === length) {
                    value = nextValue;
                    hasValue = true;
                }

                return value;
            }

            value = autoSubscribe(func, subscriber);
            hasValue = true;

            return value;
        }

        if (runDeleteSubscriber) {
            subscribers.delete(runDeleteSubscriber);
            runDeleteSubscriber = null;

            if (subscribers.size) {
                return value;
            }

            value = fallback;
            hasValue = false;
            unsubscribe(subscriber);

            return value;
        }

        if (!hasValue) {
            compute(computed);
        }

        if (runAddSubscriber) {
            subscribers.add(runAddSubscriber);
            runAddSubscriber.signals.add(computed);
            runAddSubscriber.level = runAddSubscriber.level && Math.max(runAddSubscriber.level, subscriber.level + 1);
        }

        return value;
    };

    computed.on = (callback: (value: T) => void) => {
        if (isSSR) {
            return noop;
        }

        const subscriber = createSubscriber(() => callback(autoSubscribe(computed, subscriber)));

        autoSubscribe(computed, subscriber);

        return () => unsubscribe(subscriber);
    };

    return computed;
};

export const createEffect = (func: () => void | (() => void)): (() => void) => {
    if (isSSR) {
        return noop;
    }

    let value: void | (() => void);
    const subscriber = createSubscriber(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(func, subscriber);
    });

    value = autoSubscribe(func, subscriber);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(subscriber);
    };
};

const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T): T => {
              const value = getSnapshot();
              const [{ inst }, forceUpdate] = useState({ inst: { value, getSnapshot } });

              useIsomorphicLayoutEffect(() => {
                  inst.value = value;
                  inst.getSnapshot = getSnapshot;

                  if (inst.value !== inst.getSnapshot()) {
                      forceUpdate({ inst });
                  }
              }, [subscribe, value, getSnapshot]);
              useEffect(() => {
                  if (inst.value !== inst.getSnapshot()) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (inst.value !== inst.getSnapshot()) {
                          forceUpdate({ inst });
                      }
                  });
              }, [inst, subscribe]);

              return value;
          }
        : useSyncExternalStore;

export const useSignal = <T>(signal: Signal<T> | Computed<T>): T => useSyncExternalStoreShim(signal.on, signal);

export const useSelector = <T>(func: () => T): T => {
    const subscriber = useMemo(createSubscriber, []);

    return useSyncExternalStoreShim(
        useCallback((handleChange) => {
            subscriber.callback = handleChange;

            return () => unsubscribe(subscriber);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
        useMemo(() => {
            let currentClock: typeof clock;
            let value: T;

            return () => {
                if (subscriber.clock !== currentClock) {
                    value = autoSubscribe(func, subscriber);
                    currentClock = subscriber.clock;
                }

                return value;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [func])
    );
};

export const useResetSignals = (): void => {
    if (isSSR) {
        reset();
    }
};

export const useHydrateSignal = <T>(
    signal: Signal<T>,
    hydratedValue: T,
    merge?: (currentValue: T, hydratedValue: T) => T
): void => {
    useMemo(() => {
        signal(merge ? (currentValue) => merge(currentValue, hydratedValue) : hydratedValue);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hydratedValue, signal]);
};
