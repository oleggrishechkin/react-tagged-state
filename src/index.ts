import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

let clock = {};

const isSSR = typeof window === 'undefined';

const CALLBACK = Symbol();

const SIGNALS = Symbol();

const CLOCK = Symbol();

const SUBSCRIBERS = Symbol();

const SUBSCRIBER = Symbol();

const VALUE = Symbol();

export interface Subscriber {
    [CALLBACK]: () => void;
    [SIGNALS]: Set<Signal<any> | Computed<any>>;
    [CLOCK]: typeof clock;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly [SUBSCRIBERS]: Set<Subscriber>;
    [VALUE]: T;
    on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    readonly [SUBSCRIBERS]: Set<Subscriber>;
    readonly [SUBSCRIBER]: Subscriber;
    [VALUE]: T | null;
    on: (callback: (value: T) => void) => () => void;
}

export interface Event<T = void> {
    (value: T): T;
    on: (callback: (value: T) => void) => () => void;
}

let batchedSignals: Set<Signal<any> | Computed<any>> | null = null;

export const batch = <T>(func: () => T): T => {
    if (batchedSignals) {
        return func();
    }

    batchedSignals = new Set();

    const value = func();

    const signals = batchedSignals;

    batchedSignals = null;

    if (signals.size !== 0) {
        clock = {};
        batch(() =>
            signals.forEach((signal) =>
                signal[SUBSCRIBERS].forEach((subscriber) => {
                    if (subscriber[CLOCK] !== clock) {
                        subscriber[CLOCK] = clock;
                        subscriber[CALLBACK]();
                    }
                })
            )
        );
    }

    return value;
};

let currentSubscriber: Subscriber | null = null;

export const sample = <T>(func: () => T, subscriber: Subscriber | null = null): T => {
    const previousSubscriber = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = previousSubscriber;

    return value;
};

const unsubscribe = (subscriber: Subscriber) => {
    subscriber[SIGNALS].forEach((signal) => {
        signal[SUBSCRIBERS].delete(subscriber);

        if (SUBSCRIBER in signal && signal[SUBSCRIBERS].size === 0) {
            (signal as Computed<any>)[VALUE] = null;
            unsubscribe((signal as Computed<any>)[SUBSCRIBER]);
        }
    });
    subscriber[SIGNALS] = new Set();
    subscriber[CLOCK] = clock;
};

const autoSubscribe = <T>(func: () => T, subscriber: Subscriber) => {
    const previousSignals = subscriber[SIGNALS];

    subscriber[SIGNALS] = new Set();
    subscriber[CLOCK] = clock;

    const value = sample(func, subscriber);

    previousSignals.forEach((signal) => {
        if (subscriber[SIGNALS].has(signal)) {
            return;
        }

        signal[SUBSCRIBERS].delete(subscriber);

        if (SUBSCRIBER in signal && signal[SUBSCRIBERS].size === 0) {
            (signal as Computed<any>)[VALUE] = null;
            unsubscribe((signal as Computed<any>)[SUBSCRIBER]);
        }
    });

    return value;
};

const createSubscriber = (callback: () => void = () => {}) => ({
    [CALLBACK]: callback,
    [SIGNALS]: new Set<Signal<any> | Computed<any>>(),
    [CLOCK]: clock
});

export const createSignal = <T>(initialValue: T): Signal<T> => {
    const signal = Object.assign(
        (...args: any[]) => {
            if (args.length === 0) {
                if (currentSubscriber) {
                    signal[SUBSCRIBERS].add(currentSubscriber);
                    currentSubscriber[SIGNALS].add(signal);
                }

                return signal[VALUE];
            }

            const nextValue = typeof args[0] === 'function' ? args[0](signal[VALUE]) : args[0];

            if (nextValue !== signal[VALUE]) {
                signal[VALUE] = nextValue;

                if (signal[SUBSCRIBERS].size !== 0) {
                    batch(() => {
                        if (batchedSignals) {
                            batchedSignals.add(signal);
                        }
                    });
                }
            }

            return signal[VALUE];
        },
        {
            [SUBSCRIBERS]: new Set<Subscriber>(),
            [VALUE]: initialValue,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(signal()));

                autoSubscribe(signal, subscriber);

                return () => unsubscribe(subscriber);
            }
        }
    );

    return signal;
};

export const createComputed = <T>(func: () => T): Computed<T> => {
    const computed = Object.assign(
        () => {
            if (currentSubscriber) {
                computed[SUBSCRIBERS].add(currentSubscriber);
                currentSubscriber[SIGNALS].add(computed);
            }

            if (computed[VALUE] === null || computed[SUBSCRIBER][SIGNALS].size === 0) {
                computed[VALUE] = autoSubscribe(func, computed[SUBSCRIBER]);
            }

            return computed[VALUE];
        },
        {
            [SUBSCRIBERS]: new Set<Subscriber>(),
            [SUBSCRIBER]: createSubscriber(() => {
                if (computed[SUBSCRIBERS].size === 0) {
                    computed[VALUE] = null;
                    unsubscribe(computed[SUBSCRIBER]);

                    return;
                }

                const nextValue = autoSubscribe(func, computed[SUBSCRIBER]);

                if (nextValue !== computed[VALUE]) {
                    computed[VALUE] = nextValue;
                    batch(() => {
                        if (batchedSignals) {
                            batchedSignals.add(computed);
                        }
                    });
                }
            }),
            [VALUE]: null as T | null,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(computed()));

                autoSubscribe(computed, subscriber);

                return () => unsubscribe(subscriber);
            }
        }
    );

    return computed;
};

export const createEvent = <T = void>(): Event<T> => {
    const callbacks = new Set<(value: T) => void>();

    return Object.assign(
        (value: T) => {
            batch(() => callbacks.forEach((callback) => callback(value)));

            return value;
        },
        {
            on: (callback: (value: T) => void) => {
                callbacks.add(callback);

                return () => {
                    callbacks.delete(callback);
                };
            }
        }
    );
};

export const createEffect = (func: () => void | (() => void)): (() => void) => {
    let value: void | (() => void);
    const subscriber = createSubscriber(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(func, subscriber);
    });

    value = autoSubscribe(() => batch(func), subscriber);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(subscriber);
    };
};

const checkIfSnapshotChanged = <T>(inst: { value: T; getSnapshot: () => T }) => {
    try {
        return inst.value !== inst.getSnapshot();
    } catch (error) {
        return true;
    }
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

                  if (checkIfSnapshotChanged(inst)) {
                      forceUpdate({ inst });
                  }
              }, [subscribe, value, getSnapshot]);
              useEffect(() => {
                  if (checkIfSnapshotChanged(inst)) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (checkIfSnapshotChanged(inst)) {
                          forceUpdate({ inst });
                      }
                  });
              }, [inst, subscribe]);

              return value;
          }
        : useSyncExternalStore;

export const useSelector = <T>(func: () => T): T => {
    const subscriber = useMemo(createSubscriber, []);
    let currentClock: typeof clock;
    let value: T;

    return useSyncExternalStoreShim(
        useCallback(
            (handleChange) => {
                subscriber[CALLBACK] = handleChange;

                return () => unsubscribe(subscriber);
            },
            [subscriber]
        ),
        () => {
            if (currentClock !== clock) {
                currentClock = clock;
                value = isSSR ? func() : autoSubscribe(func, subscriber);
            }

            return value;
        }
    );
};
