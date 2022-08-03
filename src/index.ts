import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

let clock = {};

export interface Subscriber {
    callback: () => void;
    signals: Set<Signal<any> | Computed<any>>;
    clock: typeof clock;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly subscribers: Set<Subscriber>;
    value: T;
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    readonly subscribers: Set<Subscriber>;
    readonly subscriber: Subscriber;
    value: T | null;
    hasValue: boolean;
    readonly func: () => T;
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Event<T> {
    (value: T): T;
    readonly callbacks: Set<(value: T) => void>;
    readonly on: (callback: (value: T) => void) => () => void;
}

let currentSubscriber: Subscriber | null = null;

let scheduleQueue: Set<Signal<any> | Computed<any>> | null = null;

let schedulePromise: Promise<void> | null = null;

const scheduleUpdates = <T>(updatedSignal: Signal<T> | Computed<T>) => {
    if (schedulePromise) {
        if (scheduleQueue) {
            scheduleQueue.add(updatedSignal);

            return;
        }

        scheduleQueue = new Set([updatedSignal]);

        return;
    }

    scheduleQueue = new Set([updatedSignal]);
    schedulePromise = Promise.resolve().then(() => {
        while (scheduleQueue) {
            const signals = scheduleQueue;

            scheduleQueue = null;
            clock = {};
            signals.forEach((signal) =>
                signal.subscribers.forEach((subscriber) => {
                    if (subscriber.clock !== clock) {
                        subscriber.clock = clock;
                        subscriber.callback();
                    }
                })
            );
        }

        schedulePromise = null;
    });
};

export const flush = async (): Promise<void> => {
    if (schedulePromise) {
        await schedulePromise;
    }
};

const createSubscriber = (callback: () => void = () => {}) => ({
    callback,
    signals: new Set<Signal<any> | Computed<any>>(),
    clock
});

let unsubscribeQueue: Set<Subscriber> | null = null;

const unsubscribe = (subscriber: Subscriber) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.add(subscriber);

        return;
    }

    unsubscribeQueue = new Set([subscriber]);
    unsubscribeQueue.forEach((subscriber) => {
        subscriber.signals.forEach((signal) => {
            signal.subscribers.delete(subscriber);

            if ('subscriber' in signal && !signal.subscribers.size) {
                signal.value = null;
                signal.hasValue = false;
                unsubscribe(signal.subscriber);
            }
        });
        subscriber.signals = new Set();
        subscriber.clock = clock;
    });
    unsubscribeQueue = null;
};

export const sample = <T>(func: () => T): T => {
    const prevSubscriber = currentSubscriber;

    currentSubscriber = null;

    const value = func();

    currentSubscriber = prevSubscriber;

    return value;
};

const autoSubscribe = <T>(func: () => T, subscriber: Subscriber): T => {
    const prevSignals = subscriber.signals;

    subscriber.signals = new Set();
    subscriber.clock = clock;

    const prevSubscriber = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = prevSubscriber;
    prevSignals.forEach((signal) => {
        if (subscriber.signals.has(signal)) {
            return;
        }

        signal.subscribers.delete(subscriber);

        if ('subscriber' in signal && !signal.subscribers.size) {
            signal.value = null;
            signal.hasValue = false;
            unsubscribe(signal.subscriber);
        }
    });

    return value;
};

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    const signal = Object.assign(
        (...args: [T | ((value: T) => T)] | []) => {
            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(signal.value) : args[0];

                if (nextValue !== signal.value) {
                    signal.value = nextValue;

                    if (signal.subscribers.size) {
                        scheduleUpdates(signal);
                    }
                }

                return signal.value;
            }

            if (currentSubscriber) {
                signal.subscribers.add(currentSubscriber);
                currentSubscriber.signals.add(signal);
            }

            return signal.value;
        },
        {
            subscribers: new Set<Subscriber>(),
            value: typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(autoSubscribe(signal, subscriber)));

                autoSubscribe(signal, subscriber);

                return () => unsubscribe(subscriber);
            }
        }
    );

    return signal;
};

let computeQueue: (Computed<any> | null)[] | null = null;

let recursionCount = 0;

const compute = <T>(computed: Computed<T>) => {
    if (recursionCount < 1000) {
        recursionCount++;
        computed.value = autoSubscribe(computed.func, computed.subscriber);
        computed.hasValue = true;
        computeQueue = null;
        recursionCount = 0;

        return;
    }

    if (computeQueue) {
        computeQueue.push(computed);

        return;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        computeQueue = [];

        const value = autoSubscribe(computed.func, computed.subscriber);

        if (computeQueue.length === 0) {
            computed.value = value;
            computed.hasValue = true;
            computeQueue = null;
            recursionCount = 0;

            return;
        }

        for (let index = 0; index < computeQueue.length; index++) {
            const item = computeQueue[index];

            if (item) {
                const length = computeQueue.length;
                const value = autoSubscribe(item.func, item.subscriber);

                if (computeQueue.length === length) {
                    item.value = value;
                    item.hasValue = true;
                    computeQueue[index] = null;
                }
            }
        }

        for (let index = computeQueue.length - 2; index > -1; index--) {
            const item = computeQueue[index];

            if (item) {
                const length = computeQueue.length;
                const value = autoSubscribe(item.func, item.subscriber);

                if (computeQueue.length === length) {
                    item.value = value;
                    item.hasValue = true;
                }
            }
        }
    }
};

export const createComputed = <T>(func: () => T, fallback: T): Computed<T> => {
    const computed = Object.assign(
        () => {
            if (currentSubscriber) {
                computed.subscribers.add(currentSubscriber);
                currentSubscriber.signals.add(computed);
            }

            if (!computed.hasValue) {
                compute(computed);
            }

            return computed.hasValue ? computed.value! : fallback;
        },
        {
            subscribers: new Set<Subscriber>(),
            subscriber: createSubscriber(() => {
                if (computed.subscribers.size) {
                    const nextValue = autoSubscribe(computed.func, computed.subscriber);

                    if (nextValue !== computed.value) {
                        computed.value = nextValue;
                        scheduleUpdates(computed);
                    }

                    return;
                }

                computed.value = null;
                computed.hasValue = false;
                unsubscribe(computed.subscriber);
            }),
            value: null as T | null,
            hasValue: false,
            func,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(autoSubscribe(computed, subscriber)));

                autoSubscribe(computed, subscriber);

                return () => unsubscribe(subscriber);
            }
        }
    );

    return computed;
};

export const createEvent = <T = void>(): Event<T> => {
    const event = Object.assign(
        (value: T) => {
            event.callbacks.forEach((callback) => callback(value));

            return value;
        },
        {
            callbacks: new Set<(value: T) => void>(),
            on: (callback: (value: T) => void) => {
                event.callbacks.add(callback);

                return () => {
                    event.callbacks.delete(callback);
                };
            }
        }
    );

    return event;
};

export const subscribe = <T>(
    func: (() => T) | Event<T> | Signal<T> | Computed<T>,
    callback: (value: T) => void
): (() => void) => {
    if ('on' in func) {
        return func.on(callback);
    }

    let value: T;
    const subscriber = createSubscriber(() => {
        const nextValue = autoSubscribe(func, subscriber);

        if (nextValue !== value) {
            value = nextValue;
            callback(value);
        }
    });

    value = autoSubscribe(func, subscriber);

    return () => unsubscribe(subscriber);
};

export const effect = (func: () => void | (() => void)): (() => void) => {
    let value: void | (() => void);
    const subscriber = createSubscriber(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(func, subscriber);
    });

    subscriber.callback();

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(subscriber);
    };
};

export const useSelector =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(func: () => T): T => {
              const [{ subscriber }, setState] = useState(() => ({ subscriber: createSubscriber() }));
              let value = autoSubscribe(func, subscriber);

              subscriber.callback = () => {
                  const nextValue = autoSubscribe(func, subscriber);

                  if (nextValue !== value) {
                      value = nextValue;
                      setState({ subscriber });
                  }
              };
              // eslint-disable-next-line react-hooks/exhaustive-deps
              useEffect(() => () => unsubscribe(subscriber), []);

              return value;
          }
        : <T>(func: () => T): T => {
              const subscriber = useMemo(createSubscriber, []);
              let currentClock: typeof clock;
              let value: T;

              return useSyncExternalStore(
                  useCallback((handleChange) => {
                      subscriber.callback = handleChange;

                      return () => unsubscribe(subscriber);
                      // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, []),
                  () => {
                      if (clock !== currentClock) {
                          currentClock = clock;
                          value = autoSubscribe(func, subscriber);
                      }

                      return value;
                  }
              );
          };
