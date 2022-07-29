import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

export interface Subscriber {
    callback: () => void;
    cleanups: Set<(subscriber: Subscriber) => void>;
    clock: typeof clock;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    on: (callback: (value: T) => void) => () => void;
}

export interface Computed<T> {
    (): T;
    on: (callback: (value: T) => void) => () => void;
}

export interface Event<T = void> {
    (value: T): T;
    on: (callback: (value: T) => void) => () => void;
}

const isSSR = typeof window === 'undefined';

const noop = () => {};

let clock = {};

let currentSubscriber: Subscriber | null = null;

let batchedSubscribersSet: Set<Set<Subscriber>> | null = null;

export const batch = <T>(func: () => T): T => {
    if (batchedSubscribersSet) {
        return func();
    }

    batchedSubscribersSet = new Set();

    const value = func();

    const subscribersSet = batchedSubscribersSet;

    batchedSubscribersSet = null;

    if (subscribersSet.size) {
        clock = {};
        batch(() =>
            subscribersSet.forEach((subscribers) =>
                subscribers.forEach((subscriber) => {
                    if (subscriber.clock !== clock) {
                        subscriber.clock = clock;
                        subscriber.callback();
                    }
                })
            )
        );
    }

    return value;
};

const createSubscriber = (callback: () => void = noop) => ({
    callback: callback,
    cleanups: new Set<(subscriber: Subscriber) => void>(),
    clock: clock
});

export const compute = <T>(func: () => T, subscriber: Subscriber | null = null): T => {
    let previousCleanups: Subscriber['cleanups'] = new Set();

    if (subscriber) {
        previousCleanups = subscriber.cleanups;

        subscriber.cleanups = new Set();
        subscriber.clock = clock;
    }

    const previousSubscriber = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = previousSubscriber;

    if (subscriber) {
        previousCleanups.forEach((cleanup) => {
            if (!subscriber.cleanups.has(cleanup)) {
                cleanup(subscriber);
            }
        });
    }

    return value;
};

export const createSignal = <T>(
    initializeValue: T | (() => T)
): ((...args: [T | ((value: T) => T)] | []) => T) & { on: (callback: (value: T) => void) => () => void } => {
    let value = typeof initializeValue === 'function' ? (initializeValue as () => T)() : initializeValue;
    const subscribers = new Set<Subscriber>();
    const cleanup = (subscriber: Subscriber) => subscribers.delete(subscriber);
    const subscribe = (callback: (value: T) => void) => {
        const targetSubscriber = createSubscriber(() => callback(value));

        subscribers.add(targetSubscriber);
        targetSubscriber.cleanups.add(cleanup);

        return () => compute(noop, targetSubscriber);
    };
    const signal = (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(value) : args[0];

            if (nextValue !== value) {
                value = nextValue;

                if (subscribers.size) {
                    batch(() => {
                        if (batchedSubscribersSet) {
                            batchedSubscribersSet.add(subscribers);
                        }
                    });
                }
            }

            return value;
        }

        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.cleanups.add(cleanup);
        }

        return value;
    };

    return Object.assign(signal, { on: subscribe });
};

export const createComputed = <T>(func: () => T): (() => T) & { on: (callback: (value: T) => void) => () => void } => {
    let value: T | null = null;
    const subscribers = new Set<Subscriber>();
    const subscriber = createSubscriber(() => {
        if (subscribers.size) {
            const nextValue = compute(func, subscriber);

            if (nextValue !== value) {
                value = nextValue;
                batch(() => {
                    if (batchedSubscribersSet) {
                        batchedSubscribersSet.add(subscribers);
                    }
                });
            }

            return;
        }

        value = null;
        compute(noop, subscriber);
    });
    const cleanup = (targetSubscriber: Subscriber) => {
        subscribers.delete(targetSubscriber);

        if (!subscribers.size) {
            value = null;
            compute(noop, subscriber);
        }
    };
    const subscribe = (callback: (value: T) => void) => {
        if (!subscriber.cleanups.size) {
            compute(func, subscriber);
        }

        const targetSubscriber = createSubscriber(() => callback(value!));

        subscribers.add(targetSubscriber);
        targetSubscriber.cleanups.add(cleanup);

        return () => compute(noop, targetSubscriber);
    };
    const computed = () => {
        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.cleanups.add(cleanup);
        }

        if (!subscriber.cleanups.size) {
            value = compute(func, subscriber);
        }

        return value!;
    };

    return Object.assign(computed, { on: subscribe });
};

export const createEvent = <T = void>(): ((value: T) => T) & { on: (callback: (value: T) => void) => () => void } => {
    const callbacks = new Set<(value: T) => void>();
    const subscribe = (callback: (value: T) => void) => {
        callbacks.add(callback);

        return () => {
            callbacks.delete(callback);
        };
    };
    const event = (value: T) => {
        batch(() => callbacks.forEach((callback) => callback(value)));

        return value;
    };

    return Object.assign(event, { on: subscribe });
};

export const effect = (func: () => void | (() => void)): (() => void) => {
    let value: void | (() => void);
    const subscriber = createSubscriber(() => {
        if (typeof value === 'function') {
            value();
        }

        value = compute(func, subscriber);
    });

    value = compute(() => batch(func), subscriber);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        compute(noop, subscriber);
    };
};

const useIsomorphicLayoutEffect = isSSR ? useEffect : useLayoutEffect;

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T) => {
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

export const useSelector = <T>(func: () => T): T => {
    const subscriber = useMemo(createSubscriber, []);

    return useSyncExternalStoreShim(
        useCallback(
            (handleChange) => {
                subscriber.callback = handleChange;

                return () => compute(noop, subscriber);
            },
            [subscriber]
        ),
        useMemo(() => {
            let currentClock: typeof clock;
            let value: T;

            return () => {
                if (clock === currentClock) {
                    return value;
                }

                currentClock = clock;
                value = isSSR ? func() : compute(func, subscriber);

                return value;
            };
        }, [func, subscriber])
    );
};
