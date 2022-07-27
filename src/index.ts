import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noop = () => {};

let clock = {};

const isSSR = typeof window === 'undefined';

const CALLBACK = Symbol();

const SIGNALS = Symbol();

const CLOCK = Symbol();

const SUBSCRIBERS = Symbol();

const SUBSCRIBER = Symbol();

const SUBSCRIBE = Symbol();

export interface Subscriber {
    [CALLBACK]: () => void;
    [SIGNALS]: Set<Signal<any> | Computed<any>>;
    [CLOCK]: typeof clock;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly [SUBSCRIBERS]: Set<Subscriber>;
    on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    readonly [SUBSCRIBERS]: Set<Subscriber>;
    readonly [SUBSCRIBER]: Subscriber;
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
            autoSubscribe(noop, (signal as Computed<any>)[SUBSCRIBER]);
        }
    });

    return value;
};

const createSubscriber = (callback: () => void) => ({
    [CALLBACK]: callback,
    [SIGNALS]: new Set<Signal<any> | Computed<any>>(),
    [CLOCK]: clock
});

export const createSignal = <T>(initialValue: T): Signal<T> => {
    let value = initialValue;
    const signal = Object.assign(
        (...args: any[]) => {
            if (args.length === 0) {
                if (currentSubscriber) {
                    signal[SUBSCRIBERS].add(currentSubscriber);
                    currentSubscriber[SIGNALS].add(signal);
                }

                return value;
            }

            const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

            if (nextValue !== value) {
                value = nextValue;

                if (signal[SUBSCRIBERS].size !== 0) {
                    batch(() => batchedSignals!.add(signal));
                }
            }

            return value;
        },
        {
            [SUBSCRIBERS]: new Set<Subscriber>(),
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(value));

                autoSubscribe(signal, subscriber);

                return () => autoSubscribe(noop, subscriber);
            }
        }
    );

    return signal;
};

export const createComputed = <T>(func: () => T): Computed<T> => {
    let value: T | null = null;
    const computed = Object.assign(
        () => {
            if (currentSubscriber) {
                computed[SUBSCRIBERS].add(currentSubscriber);
                currentSubscriber[SIGNALS].add(computed);
            }

            if (value === null || computed[SUBSCRIBER][SIGNALS].size === 0) {
                value = autoSubscribe(func, computed[SUBSCRIBER]);
            }

            return value;
        },
        {
            [SUBSCRIBERS]: new Set<Subscriber>(),
            [SUBSCRIBER]: createSubscriber(() => {
                if (computed[SUBSCRIBERS].size === 0) {
                    autoSubscribe(noop, computed[SUBSCRIBER]);

                    return;
                }

                const nextValue = autoSubscribe(func, computed[SUBSCRIBER]);

                if (nextValue !== value) {
                    value = nextValue;
                    batch(() => batchedSignals!.add(computed));
                }
            }),
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(value!));

                autoSubscribe(computed, subscriber);

                return () => autoSubscribe(noop, subscriber);
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

        autoSubscribe(noop, subscriber);
    };
};

export const useSelector =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(func: () => T): T => {
              const [state, setState] = useState(() => ({ [SUBSCRIBER]: createSubscriber(noop) }));
              let value = isSSR ? func() : autoSubscribe(func, state[SUBSCRIBER]);

              state[SUBSCRIBER][CALLBACK] = () => {
                  const nextValue = isSSR ? func() : autoSubscribe(func, state[SUBSCRIBER]);

                  if (nextValue !== value) {
                      value = nextValue;
                      setState((state) => ({ [SUBSCRIBER]: state[SUBSCRIBER] }));
                  }
              };

              useEffect(() => () => autoSubscribe(noop, state[SUBSCRIBER]));

              return value;
          }
        : <T>(func: () => T): T => {
              const ref = useRef<{
                  [SUBSCRIBER]: Subscriber;
                  [SUBSCRIBE]: (handleChange: () => void) => () => void;
              } | null>(null);

              if (ref.current === null) {
                  ref.current = {
                      [SUBSCRIBER]: createSubscriber(noop),
                      [SUBSCRIBE]: (handleChange: () => void) => {
                          ref.current![SUBSCRIBER][CALLBACK] = handleChange;

                          return () => autoSubscribe(noop, ref.current![SUBSCRIBER]);
                      }
                  };
              }

              let currentClock: typeof clock;
              let value: T;

              return useSyncExternalStore(ref.current[SUBSCRIBE], () => {
                  if (currentClock !== clock) {
                      currentClock = clock;
                      value = isSSR ? func() : autoSubscribe(func, ref.current![SUBSCRIBER]);
                  }

                  return value;
              });
          };
