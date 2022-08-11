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

let clock = 0;

let schedulePromise: Promise<void> | null = null;

let scheduleQueue: Set<Set<Subscriber>> | null = null;

let scheduleSubscribersByLevel: Subscriber[][] | null = null;

const runSubscribers = (subscribers?: Subscriber[]) => {
    if (subscribers) {
        for (let index = 0; index < subscribers.length; index++) {
            if (subscribers[index].clock !== clock) {
                subscribers[index].clock = clock;
                subscribers[index].callback();
            }
        }
    }
};

const scheduleUpdates = (subscribers: Set<Subscriber>) => {
    if (scheduleSubscribersByLevel) {
        for (const subscriber of subscribers) {
            if (scheduleSubscribersByLevel[subscriber.level]) {
                scheduleSubscribersByLevel[subscriber.level].push(subscriber);
            } else {
                scheduleSubscribersByLevel[subscriber.level] = [subscriber];
            }
        }

        return;
    }

    if (scheduleQueue) {
        scheduleQueue.add(subscribers);

        return;
    }

    scheduleQueue = new Set([subscribers]);
    schedulePromise = Promise.resolve().then(() => {
        clock++;
        schedulePromise = null;
        scheduleSubscribersByLevel = [];

        for (const subscribers of scheduleQueue!) {
            scheduleUpdates(subscribers);
        }

        scheduleQueue = null;

        for (let index = 1; index < scheduleSubscribersByLevel.length; index++) {
            runSubscribers(scheduleSubscribersByLevel[index]);
        }

        const subscribers = scheduleSubscribersByLevel[0];

        scheduleSubscribersByLevel = null;
        runSubscribers(subscribers);
    });
};

export const flush = async (): Promise<void> => {
    if (schedulePromise) {
        await schedulePromise;
    }
};

const createSubscriber = (callback: () => void = () => {}, level: 0 | 1 = 0) => ({
    callback,
    signals: new Set<Signal<any> | Computed<any>>(),
    clock,
    level
});

const resetSubscriber = (subscriber: Subscriber) => {
    subscriber.signals = new Set();
    subscriber.clock = clock;
    subscriber.level = subscriber.level && 1;
};

let subscriberToDelete: Subscriber | null = null;

let unsubscribeQueue: Subscriber[] | null = null;

const unsubscribe = (subscriber: Subscriber) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.push(subscriber);

        return;
    }

    unsubscribeQueue = [subscriber];

    for (let index = 0; index < unsubscribeQueue.length; index++) {
        for (const signal of unsubscribeQueue[index].signals) {
            subscriberToDelete = unsubscribeQueue[index];
            signal();
        }

        resetSubscriber(unsubscribeQueue[index]);
    }

    unsubscribeQueue = null;
};

let subscriberToAdd: Subscriber | null = null;

const autoSubscribe = <T>(func: () => T, subscriber: Subscriber): T => {
    const prevSignals = subscriber.signals;

    resetSubscriber(subscriber);

    const prevSubscriber = subscriberToAdd;

    subscriberToAdd = subscriber;

    const value = func();

    subscriberToAdd = prevSubscriber;

    for (const signal of prevSignals) {
        if (!subscriber.signals.has(signal)) {
            subscriberToDelete = subscriber;
            signal();
        }
    }

    return value;
};

export const sample = <T>(func: () => T): T => {
    const prevSubscriber = subscriberToAdd;

    subscriberToAdd = null;

    const value = func();

    subscriberToAdd = prevSubscriber;

    return value;
};

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    const subscribers = new Set<Subscriber>();
    const signal = (...args: [T | ((value: T) => T)] | []) => {
        if (subscriberToDelete) {
            subscribers.delete(subscriberToDelete);
            subscriberToDelete = null;

            return value;
        }

        if (args.length) {
            const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(value) : args[0];

            if (nextValue !== value) {
                value = nextValue;

                if (subscribers.size) {
                    scheduleUpdates(subscribers);
                }
            }

            return nextValue;
        }

        if (subscriberToAdd) {
            subscribers.add(subscriberToAdd);
            subscriberToAdd.signals.add(signal);
        }

        return value;
    };

    signal.on = (callback: (value: T) => void) => {
        const subscriber = createSubscriber(() => callback(autoSubscribe(signal, subscriber)));

        autoSubscribe(signal, subscriber);

        return () => unsubscribe(subscriber);
    };

    return signal;
};

let computeQueue: Computed<any>[] | null = null;

let recursionCount = 0;

let tryToCompute = false;

const compute = <T>(computed: Computed<T>) => {
    if (recursionCount++ < 1000) {
        tryToCompute = true;
        computed();
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
        tryToCompute = true;
        computed();

        if (!computeQueue.length) {
            computeQueue = null;

            return;
        }

        for (let index = 0; index < computeQueue.length; index++) {
            tryToCompute = true;
            computeQueue[index]();
        }

        for (let index = computeQueue.length - 2; index > -1; index--) {
            tryToCompute = true;
            computeQueue[index]();
        }
    }
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
                scheduleUpdates(subscribers);
            }

            return;
        }

        value = fallback;
        hasValue = false;
        unsubscribe(subscriber);
    }, 1);
    const computed = () => {
        if (tryToCompute) {
            tryToCompute = false;

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

                return nextValue;
            }

            value = autoSubscribe(func, subscriber);
            hasValue = true;

            return value;
        }

        if (subscriberToDelete) {
            subscribers.delete(subscriberToDelete);
            subscriberToDelete = null;

            if (subscribers.size) {
                return value;
            }

            value = fallback;
            hasValue = false;
            unsubscribe(subscriber);

            return fallback;
        }

        if (!hasValue) {
            compute(computed);
        }

        if (subscriberToAdd) {
            subscribers.add(subscriberToAdd);
            subscriberToAdd.signals.add(computed);
            subscriberToAdd.level = subscriberToAdd.level && Math.max(subscriberToAdd.level, subscriber.level + 1);
        }

        return value;
    };

    computed.on = (callback: (value: T) => void) => {
        const subscriber = createSubscriber(() => callback(autoSubscribe(computed, subscriber)));

        autoSubscribe(computed, subscriber);

        return () => unsubscribe(subscriber);
    };

    return computed;
};

export const createEvent = <T = void>(): Event<T> => {
    const callbacks = new Set<(value: T) => void>();
    const event = (value: T) => {
        for (const callback of callbacks) {
            callback(value);
        }

        return value;
    };

    event.on = (callback: (value: T) => void) => {
        callbacks.add(callback);

        return () => {
            callbacks.delete(callback);
        };
    };

    return event;
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

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
                if (clock !== currentClock) {
                    currentClock = clock;
                    value = autoSubscribe(func, subscriber);
                }

                return value;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [func])
    );
};
