import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

export interface Subscriber {
    callback: () => void;
    signals: Set<Signal<any> | Computed<any>>;
    clock: Record<string, never>;
    level: number;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly subscribers: Set<Subscriber>;
    value: T | null;
    hasValue: boolean;
    readonly initialValue: T | (() => T);
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    readonly subscribers: Set<Subscriber>;
    readonly subscriber: Subscriber;
    value: T | null;
    hasValue: boolean;
    readonly func: () => T;
    readonly fallback: T;
    readonly on: (callback: (value: T) => void) => () => void;
}

export interface Event<T> {
    (value: T): T;
    readonly callbacks: Set<(value: T) => void>;
    readonly on: (callback: (value: T) => void) => () => void;
}

let clock = {};

let currentSubscriber: Subscriber | null = null;

let scheduleQueue: Set<Signal<any> | Computed<any>> | null = null;

let schedulePromise: Promise<void> | null = null;

let levelSubs: Set<Subscriber>[] | null = null;

const scheduleUpdates = <T>(updatedSignal: Signal<T> | Computed<T>) => {
    if (levelSubs) {
        for (const subscriber of updatedSignal.subscribers) {
            if (levelSubs[subscriber.level]) {
                levelSubs[subscriber.level].add(subscriber);
            } else {
                levelSubs[subscriber.level] = new Set([subscriber]);
            }
        }

        return;
    }

    if (scheduleQueue) {
        scheduleQueue.add(updatedSignal);

        return;
    }

    scheduleQueue = new Set([updatedSignal]);
    schedulePromise = Promise.resolve().then(() => {
        const signals = scheduleQueue!;

        schedulePromise = null;
        scheduleQueue = null;
        levelSubs = [];

        for (const signal of signals) {
            for (const subscriber of signal.subscribers) {
                if (levelSubs[subscriber.level]) {
                    levelSubs[subscriber.level].add(subscriber);
                } else {
                    levelSubs[subscriber.level] = new Set([subscriber]);
                }
            }
        }

        for (let index = 1; index < levelSubs.length; index++) {
            if (levelSubs[index]) {
                for (const subscriber of levelSubs[index]) {
                    subscriber.callback();
                }
            }
        }

        const subscribers = levelSubs[0];

        levelSubs = null;

        if (subscribers) {
            clock = {};

            for (const subscriber of subscribers) {
                subscriber.callback();
            }
        }
    });
};

export const flush = async (): Promise<void> => {
    if (schedulePromise) {
        await schedulePromise;
    }
};

const createSubscriber = (callback: () => void = () => {}, level = 0) => ({
    callback,
    signals: new Set<Signal<any> | Computed<any>>(),
    clock,
    level
});

let unsubscribeQueue: Subscriber[] | null = null;

const unsubscribe = (subscriber: Subscriber) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.push(subscriber);

        return;
    }

    unsubscribeQueue = [subscriber];

    for (let index = 0; index < unsubscribeQueue.length; index++) {
        for (const signal of unsubscribeQueue[index].signals) {
            signal.subscribers.delete(unsubscribeQueue[index]);

            if ('subscriber' in signal && !signal.subscribers.size) {
                signal.value = null;
                signal.hasValue = false;
                unsubscribe(signal.subscriber);
            }
        }

        unsubscribeQueue[index].signals = new Set();
        unsubscribeQueue[index].clock = clock;

        if (unsubscribeQueue[index].level > 1) {
            unsubscribeQueue[index].level = 1;
        }
    }

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

    if (subscriber.level > 1) {
        subscriber.level = 1;
    }

    const prevSubscriber = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = prevSubscriber;

    for (const signal of prevSignals) {
        if (!subscriber.signals.has(signal)) {
            signal.subscribers.delete(subscriber);

            if ('subscriber' in signal && !signal.subscribers.size) {
                signal.value = null;
                signal.hasValue = false;
                unsubscribe(signal.subscriber);
            }
        }
    }

    return value;
};

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    const signal = Object.assign(
        (...args: [T | ((value: T) => T)] | []) => {
            if (!signal.hasValue) {
                signal.value =
                    typeof signal.initialValue === 'function'
                        ? (signal.initialValue as () => T)()
                        : signal.initialValue;
                signal.hasValue = true;
            }

            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(signal.value!) : args[0];

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

            return signal.value!;
        },
        {
            subscribers: new Set<Subscriber>(),
            value: null as T | null,
            hasValue: false,
            initialValue,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(signal.value!));

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

        if (!computeQueue.length) {
            computed.value = value;
            computed.hasValue = true;
            computeQueue = null;
            recursionCount = 0;

            return;
        }

        for (let index = 0; index < computeQueue.length; index++) {
            const length = computeQueue.length;
            const value = autoSubscribe(computeQueue[index]!.func, computeQueue[index]!.subscriber);

            if (computeQueue.length === length) {
                computeQueue[index]!.value = value;
                computeQueue[index]!.hasValue = true;
                computeQueue[index] = null;
            }
        }

        for (let index = computeQueue.length - 2; index > -1; index--) {
            if (computeQueue[index]) {
                const length = computeQueue.length;
                const value = autoSubscribe(computeQueue[index]!.func, computeQueue[index]!.subscriber);

                if (computeQueue.length === length) {
                    computeQueue[index]!.value = value;
                    computeQueue[index]!.hasValue = true;
                }
            }
        }
    }
};

export const createComputed = <T>(func: () => T, fallback: T): Computed<T> => {
    const computed = Object.assign(
        () => {
            if (!computed.hasValue) {
                compute(computed);
            }

            if (currentSubscriber) {
                computed.subscribers.add(currentSubscriber);
                currentSubscriber.signals.add(computed);

                if (currentSubscriber.level > 0) {
                    currentSubscriber.level =
                        currentSubscriber.level > computed.subscriber.level
                            ? currentSubscriber.level
                            : computed.subscriber.level + 1;
                }
            }

            return computed.hasValue ? computed.value! : computed.fallback;
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
            }, 1),
            value: null as T | null,
            hasValue: false,
            func,
            fallback,
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(computed.value!));

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
            for (const callback of event.callbacks) {
                callback(value);
            }

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

    value = autoSubscribe(func, subscriber);

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

              useEffect(() => () => unsubscribe(subscriber), [subscriber]);

              return useMemo(() => {
                  let value = autoSubscribe(func, subscriber);

                  subscriber.callback = () => {
                      const nextValue = autoSubscribe(func, subscriber);

                      if (nextValue !== value) {
                          value = nextValue;
                          setState({ subscriber });
                      }
                  };

                  return value;
              }, [func, subscriber]);
          }
        : <T>(func: () => T): T => {
              const subscriber = useMemo(createSubscriber, []);

              return useSyncExternalStore(
                  useCallback(
                      (handleChange) => {
                          subscriber.callback = handleChange;

                          return () => unsubscribe(subscriber);
                      },
                      [subscriber]
                  ),
                  useMemo(() => {
                      let currentClock: typeof clock;
                      let value: T;

                      return () => {
                          if (clock !== currentClock) {
                              currentClock = clock;
                              value = autoSubscribe(func, subscriber);
                          }

                          return value;
                      };
                  }, [func, subscriber])
              );
          };
