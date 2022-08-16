import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, useDebugValue } from 'react';

export interface SignalOnOptions {
    ssr?: boolean;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void, options?: SignalOnOptions) => () => void;
}

interface SignalNode<T> {
    subscribers: Set<SubscriberNode | ComputedNode<any>>;
    value: T;
}

export interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface ComputedNode<T> extends SignalNode<T | null>, SubscriberNode {
    hasValue: boolean;
}

export interface EventOnOptions {
    ssr?: boolean;
}

export interface Event<T> {
    (value: T): T;
    readonly on: (callback: (value: T) => void, options?: EventOnOptions) => () => void;
}

interface EventNode<T> {
    callbacks: Set<(value: T) => void>;
}

interface SubscriberNode {
    callback: () => void;
    signals: Set<SignalNode<any> | ComputedNode<any>>;
    clock: typeof clock;
    level: number;
}

const MAX_RECURSION_COUNT = 2000;

const IS_SSR = typeof window === 'undefined';

const NOOP = () => {};

let clock = {};

let schedulePromise: Promise<void> | null = null;

let scheduleQueue: SubscriberNode[][] | null = null;

const schedule = <T>(signalNode: SignalNode<T>) => {
    if (!scheduleQueue) {
        scheduleQueue = [];
    }

    for (const subscriberNode of signalNode.subscribers) {
        if (scheduleQueue[subscriberNode.level]) {
            scheduleQueue[subscriberNode.level].push(subscriberNode);

            continue;
        }

        scheduleQueue[subscriberNode.level] = [subscriberNode];
    }

    if (schedulePromise) {
        return;
    }

    schedulePromise = Promise.resolve().then(() => {
        schedulePromise = null;

        if (!scheduleQueue) {
            return;
        }

        clock = {};

        for (let level = 1; level < scheduleQueue.length; level++) {
            if (!scheduleQueue[level]) {
                continue;
            }

            for (let index = 0; index < scheduleQueue[level].length; index++) {
                if (scheduleQueue[level][index].clock !== clock) {
                    scheduleQueue[level][index].clock = clock;
                    scheduleQueue[level][index].callback();
                }
            }
        }

        const subscriberNodes = scheduleQueue[0];

        scheduleQueue = null;

        if (!subscriberNodes) {
            return;
        }

        for (let index = 0; index < subscriberNodes.length; index++) {
            if (subscriberNodes[index].clock !== clock) {
                subscriberNodes[index].clock = clock;
                subscriberNodes[index].callback();
            }
        }
    });
};

export const flush = async (): Promise<void> => {
    while (schedulePromise) {
        await schedulePromise;
    }
};

let unsubscribeQueue: SubscriberNode[] | null = null;

const unsubscribe = (subscriberNode: SubscriberNode) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.push(subscriberNode);

        return;
    }

    unsubscribeQueue = [subscriberNode];

    for (let index = 0; index < unsubscribeQueue.length; index++) {
        for (const signal of unsubscribeQueue[index].signals) {
            signal.subscribers.delete(unsubscribeQueue[index]);

            if ('hasValue' in signal && !signal.subscribers.size) {
                signal.value = null;
                signal.hasValue = false;
                unsubscribe(signal);
            }
        }

        unsubscribeQueue[index].signals = new Set();
        unsubscribeQueue[index].clock = clock;
        unsubscribeQueue[index].level = unsubscribeQueue[index].level && 1;
    }

    unsubscribeQueue = null;
};

let currentSubscriberNode: SubscriberNode | null = null;

const autoSubscribe = <T>(func: () => T, subscriberNode: SubscriberNode): T => {
    if (IS_SSR) {
        return func();
    }

    const prevSignals = subscriberNode.signals;

    subscriberNode.signals = new Set();
    subscriberNode.clock = clock;
    subscriberNode.level = subscriberNode.level && 1;

    const tmp = currentSubscriberNode;

    currentSubscriberNode = subscriberNode;

    const value = func();

    currentSubscriberNode = tmp;

    for (const signal of prevSignals) {
        if (subscriberNode.signals.has(signal)) {
            continue;
        }

        signal.subscribers.delete(subscriberNode);

        if ('hasValue' in signal && !signal.subscribers.size) {
            signal.value = null;
            signal.hasValue = false;
            unsubscribe(signal);
        }
    }

    return value;
};

export const sample = <T>(func: () => T): T => {
    const tmp = currentSubscriberNode;

    currentSubscriberNode = null;

    const value = func();

    currentSubscriberNode = tmp;

    return value;
};

const createSubscriberNode = (callback: () => void = NOOP): SubscriberNode => ({
    callback: callback,
    signals: new Set(),
    clock: clock,
    level: 0
});

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    const signalNode: SignalNode<T> = {
        subscribers: new Set(),
        value: typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    };
    const signal = (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const tmp = signalNode.value;

            signalNode.value = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(tmp) : args[0];

            if (tmp === signalNode.value) {
                return signalNode.value;
            }

            if (signalNode.subscribers.size) {
                schedule(signalNode);
            }

            return signalNode.value;
        }

        if (currentSubscriberNode) {
            signalNode.subscribers.add(currentSubscriberNode);
            currentSubscriberNode.signals.add(signalNode);
        }

        return signalNode.value;
    };

    signal.on = (callback: (value: T) => void, { ssr }: SignalOnOptions = {}) => {
        if (IS_SSR && !ssr) {
            return NOOP;
        }

        const subscriberNode = createSubscriberNode(() => callback(signalNode.value));

        signalNode.subscribers.add(subscriberNode);
        subscriberNode.signals.add(signalNode);

        return () => unsubscribe(subscriberNode);
    };

    return signal;
};

let computeQueue: [() => any, ComputedNode<any>][] | null = null;

let computeRecursionCount = 0;

const compute = <T>(func: () => T, computedNode: ComputedNode<T>) => {
    if (computeQueue) {
        computeQueue.push([func, computedNode]);

        return;
    }

    do {
        computeQueue = [[func, computedNode]];

        for (let index = 0; index < computeQueue.length; index++) {
            const tmp = computeQueue.length;

            computeQueue[index][1].value = autoSubscribe(computeQueue[index][0], computeQueue[index][1]);

            if (computeQueue.length === tmp) {
                computeQueue[index][1].hasValue = true;
            }
        }

        for (let index = computeQueue.length - 2; index > 0; index--) {
            const tmp = computeQueue.length;

            computeQueue[index][1].value = autoSubscribe(computeQueue[index][0], computeQueue[index][1]);

            if (computeQueue.length === tmp) {
                computeQueue[index][1].hasValue = true;
            }
        }
    } while (computeQueue.length !== 1);

    computeQueue = null;
};

let updateLevelQueue: ComputedNode<any>[] | null = null;

const updateLevel = <T>(computeNode: ComputedNode<T>) => {
    if (updateLevelQueue) {
        updateLevelQueue.push(computeNode);

        return;
    }

    updateLevelQueue = [computeNode];

    for (let index = 0; index < updateLevelQueue.length; index++) {
        for (const subscriber of updateLevelQueue[index].subscribers) {
            if (!('hasValue' in subscriber)) {
                continue;
            }

            if (subscriber.level < updateLevelQueue[index].level + 1) {
                subscriber.level = updateLevelQueue[index].level + 1;
                updateLevel(subscriber);

                continue;
            }

            const tmp = subscriber.level;
            let level = 1;

            for (const signal of subscriber.signals) {
                if ('hasValue' in signal) {
                    level = Math.max(level, signal.level + 1);
                }
            }

            if (tmp !== subscriber.level) {
                updateLevel(subscriber);
            }
        }
    }
};

export const createComputed = <T>(selector: () => T, fallback: T | null = null): Computed<T> => {
    const computedNode: ComputedNode<T> = {
        subscribers: new Set(),
        value: null,
        callback: () => {
            if (!computedNode.subscribers.size) {
                computedNode.value = null;
                computedNode.hasValue = false;
                unsubscribe(computedNode);

                return;
            }

            const tmp = computedNode.level;
            const nextValue = autoSubscribe(selector, computedNode);

            if (nextValue !== computedNode.value) {
                computedNode.value = nextValue;
                schedule(computedNode);

                return;
            }

            if (tmp !== computedNode.level) {
                updateLevel(computedNode);
            }
        },
        signals: new Set(),
        clock: clock,
        level: 1,
        hasValue: false
    };
    const computed = () => {
        if (!computedNode.hasValue) {
            if (computeRecursionCount < MAX_RECURSION_COUNT) {
                computeRecursionCount++;
                computedNode.value = autoSubscribe(selector, computedNode);
                computedNode.hasValue = true;
                computeRecursionCount--;
            } else {
                compute(selector, computedNode);
            }
        }

        if (currentSubscriberNode) {
            computedNode.subscribers.add(currentSubscriberNode);
            currentSubscriberNode.signals.add(computedNode);
            currentSubscriberNode.level =
                currentSubscriberNode.level && Math.max(currentSubscriberNode.level, computedNode.level + 1);
        }

        return (computedNode.hasValue ? computedNode.value : fallback) as T;
    };

    computed.on = (callback: (value: T) => void) => {
        if (IS_SSR) {
            return NOOP;
        }

        const subscriberNode = createSubscriberNode(() => callback(computedNode.value!));

        autoSubscribe(computed, subscriberNode);

        return () => unsubscribe(subscriberNode);
    };

    return computed;
};

export const createEvent = <T = void>(): Event<T> => {
    const eventNode: EventNode<T> = {
        callbacks: new Set()
    };
    const event = (value: T) => {
        for (const callback of eventNode.callbacks) {
            callback(value);
        }

        return value;
    };

    event.on = (callback: (value: T) => void, { ssr }: EventOnOptions = {}) => {
        if (IS_SSR && !ssr) {
            return NOOP;
        }

        eventNode.callbacks.add(callback);

        return () => {
            eventNode.callbacks.delete(callback);
        };
    };

    return event;
};

export const createEffect = (callback: () => void | (() => void)): (() => void) => {
    if (IS_SSR) {
        return NOOP;
    }

    let value: void | (() => void);
    const subscriberNode = createSubscriberNode(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(callback, subscriberNode);
    });

    value = autoSubscribe(callback, subscriberNode);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(subscriberNode);
    };
};

const useIsomorphicLayoutEffect = IS_SSR ? useEffect : useLayoutEffect;

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
              useDebugValue(value);

              return value;
          }
        : useSyncExternalStore;

export const useSignal = <T>(signal: Signal<T> | Computed<T>): T => useSyncExternalStoreShim(signal.on, signal);

export const useSelector = <T>(selector: () => T): T => {
    const subscriberNode = useMemo(createSubscriberNode, []);

    return useSyncExternalStoreShim(
        useCallback((handleChange) => {
            subscriberNode.callback = handleChange;

            return () => unsubscribe(subscriberNode);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
        useMemo(() => {
            let currentClock: typeof clock;
            let value: T;

            return () => {
                if (subscriberNode.clock !== currentClock) {
                    value = autoSubscribe(selector, subscriberNode);
                    currentClock = subscriberNode.clock;
                }

                return value;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selector])
    );
};
