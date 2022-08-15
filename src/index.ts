import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, useDebugValue } from 'react';

const CALLBACKS = 'callbacks';

const SUBSCRIBERS = 'subscribers';

const VALUE = 'value';

const HAS_VALUE = 'hasValue';

const CALLBACK = 'callback';

const SIGNALS = 'signals';

const CLOCK = 'clock';

const LEVEL = 'level';

const GET_SNAPSHOT = 'getSnapshot';

const DEFAULT_KEY = 'signal';

export interface EventOptions {
    ssr?: boolean;
}

export interface Event<T> {
    (value: T): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface EventNode<T> {
    [CALLBACKS]: Set<(value: T) => void>;
}

export interface SignalOptions {
    key?: string;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface SignalNode<T> {
    [SUBSCRIBERS]: Set<SubscriberNode | ComputedNode<any>>;
    [VALUE]: T;
}

export interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface ComputedNode<T> extends SignalNode<T | null>, SubscriberNode {
    [HAS_VALUE]: boolean;
}

interface SubscriberNode {
    [CALLBACK]: () => void;
    [SIGNALS]: Set<SignalNode<any> | ComputedNode<any>>;
    [CLOCK]: typeof clock;
    [LEVEL]: number;
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

    for (const subscriberNode of signalNode[SUBSCRIBERS]) {
        if (scheduleQueue[subscriberNode[LEVEL]]) {
            scheduleQueue[subscriberNode[LEVEL]].push(subscriberNode);

            continue;
        }

        scheduleQueue[subscriberNode[LEVEL]] = [subscriberNode];
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
                if (scheduleQueue[level][index][CLOCK] !== clock) {
                    scheduleQueue[level][index][CLOCK] = clock;
                    scheduleQueue[level][index][CALLBACK]();
                }
            }
        }

        const subscriberNodes = scheduleQueue[0];

        scheduleQueue = null;

        if (!subscriberNodes) {
            return;
        }

        for (let index = 0; index < subscriberNodes.length; index++) {
            if (subscriberNodes[index][CLOCK] !== clock) {
                subscriberNodes[index][CLOCK] = clock;
                subscriberNodes[index][CALLBACK]();
            }
        }
    });
};

export const flush = async (): Promise<void> => {
    while (schedulePromise) {
        await schedulePromise;
    }
};

const createSubscriberNode = (callback: () => void = NOOP): SubscriberNode => ({
    [CALLBACK]: callback,
    [SIGNALS]: new Set(),
    [CLOCK]: clock,
    [LEVEL]: 0
});

let unsubscribeQueue: SubscriberNode[] | null = null;

const unsubscribe = (subscriberNode: SubscriberNode) => {
    if (unsubscribeQueue) {
        unsubscribeQueue.push(subscriberNode);

        return;
    }

    unsubscribeQueue = [subscriberNode];

    for (let index = 0; index < unsubscribeQueue.length; index++) {
        for (const signal of unsubscribeQueue[index][SIGNALS]) {
            signal[SUBSCRIBERS].delete(unsubscribeQueue[index]);

            if (HAS_VALUE in signal && !signal[SUBSCRIBERS].size) {
                signal[VALUE] = null;
                signal[HAS_VALUE] = false;
                unsubscribe(signal);
            }
        }

        unsubscribeQueue[index][SIGNALS] = new Set();
        unsubscribeQueue[index][CLOCK] = clock;
        unsubscribeQueue[index][LEVEL] = unsubscribeQueue[index][LEVEL] && 1;
    }

    unsubscribeQueue = null;
};

let currentSubscriberNode: SubscriberNode | null = null;

const autoSubscribe = <T>(func: () => T, subscriberNode: SubscriberNode): T => {
    if (IS_SSR) {
        return func();
    }

    const prevSignals = subscriberNode[SIGNALS];

    subscriberNode[SIGNALS] = new Set();
    subscriberNode[CLOCK] = clock;
    subscriberNode[LEVEL] = subscriberNode[LEVEL] && 1;

    const tmp = currentSubscriberNode;

    currentSubscriberNode = subscriberNode;

    const value = func();

    currentSubscriberNode = tmp;

    for (const signal of prevSignals) {
        if (subscriberNode[SIGNALS].has(signal)) {
            continue;
        }

        signal[SUBSCRIBERS].delete(subscriberNode);

        if (HAS_VALUE in signal && !signal[SUBSCRIBERS].size) {
            signal[VALUE] = null;
            signal[HAS_VALUE] = false;
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

export const createEvent = <T = void>({ ssr }: EventOptions = {}): Event<T> => {
    const eventNode: EventNode<T> = {
        [CALLBACKS]: new Set()
    };
    const event = (value: T) => {
        for (const callback of eventNode[CALLBACKS]) {
            callback(value);
        }

        return value;
    };

    event.on = (callback: (value: T) => void) => {
        if (IS_SSR && !ssr) {
            return NOOP;
        }

        eventNode[CALLBACKS].add(callback);

        return () => {
            eventNode[CALLBACKS].delete(callback);
        };
    };

    return event;
};

export const reset = createEvent<void | Signal<any> | Computed<any>>({ ssr: true });

const getState = createEvent<Record<string, any>>();

const setState = createEvent<Record<string, any>>();

let devTools: any = null;

let isJumpToAction = false;

const initDevTools = () => {
    if (devTools || IS_SSR || !(window as any).__REDUX_DEVTOOLS_EXTENSION__) {
        return;
    }

    devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({ name: 'react-tagged-state' });
    devTools.subscribe((message: { type: string; state: string; payload: { type: string } }) => {
        if (message.type === 'DISPATCH' && message.state && message.payload?.type === 'JUMP_TO_ACTION') {
            isJumpToAction = true;
            setState(JSON.parse(message.state));
            isJumpToAction = false;
        }
    });
    devTools.init({});
};

let uniqueId = 0;

export const createSignal = <T>(initialValue: T | (() => T), { key = DEFAULT_KEY }: SignalOptions = {}): Signal<T> => {
    const name = `${key}_${uniqueId++}`;
    const signalNode: SignalNode<T> = {
        [SUBSCRIBERS]: new Set(),
        [VALUE]: typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
    };
    const signal = (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const tmp = signalNode[VALUE];

            signalNode[VALUE] = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(tmp) : args[0];

            if (tmp === signalNode[VALUE]) {
                return signalNode[VALUE];
            }

            if (devTools && !isJumpToAction) {
                devTools.send(`Update ${name}`, getState({}));
            }

            if (signalNode[SUBSCRIBERS].size) {
                schedule(signalNode);
            }

            return signalNode[VALUE];
        }

        if (currentSubscriberNode) {
            signalNode[SUBSCRIBERS].add(currentSubscriberNode);
            currentSubscriberNode[SIGNALS].add(signalNode);
        }

        return signalNode[VALUE];
    };

    signal.on = (callback: (value: T) => void) => {
        if (IS_SSR) {
            return NOOP;
        }

        const subscriberNode = createSubscriberNode(() => callback(signalNode[VALUE]));

        signalNode[SUBSCRIBERS].add(subscriberNode);
        subscriberNode[SIGNALS].add(signalNode);

        return () => unsubscribe(subscriberNode);
    };
    reset.on((signalToReset) => {
        if (!signalToReset || signalToReset === signal) {
            signal(typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue);
        }
    });

    initDevTools();

    if (devTools) {
        getState.on((values) => {
            values[name] = signal();
        });
        setState.on((values) => {
            signal(
                name in values
                    ? values[name]
                    : typeof initialValue === 'function'
                    ? (initialValue as () => T)()
                    : initialValue
            );
        });
        devTools.send(`Create ${name}`, getState({}));
    }

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

            computeQueue[index][1][VALUE] = autoSubscribe(computeQueue[index][0], computeQueue[index][1]);

            if (computeQueue.length === tmp) {
                computeQueue[index][1][HAS_VALUE] = true;
            }
        }

        for (let index = computeQueue.length - 2; index > 0; index--) {
            const tmp = computeQueue.length;

            computeQueue[index][1][VALUE] = autoSubscribe(computeQueue[index][0], computeQueue[index][1]);

            if (computeQueue.length === tmp) {
                computeQueue[index][1][HAS_VALUE] = true;
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
        for (const subscriber of updateLevelQueue[index][SUBSCRIBERS]) {
            if (!(HAS_VALUE in subscriber)) {
                continue;
            }

            if (subscriber[LEVEL] < updateLevelQueue[index][LEVEL] + 1) {
                subscriber[LEVEL] = updateLevelQueue[index][LEVEL] + 1;
                updateLevel(subscriber);

                continue;
            }

            const tmp = subscriber[LEVEL];
            let level = 1;

            for (const signal of subscriber[SIGNALS]) {
                if (HAS_VALUE in signal) {
                    level = Math.max(level, signal[LEVEL] + 1);
                }
            }

            if (tmp !== subscriber[LEVEL]) {
                updateLevel(subscriber);
            }
        }
    }
};

export const createComputed = <T>(func: () => T, fallback: T | null = null): Computed<T> => {
    const computedNode: ComputedNode<T> = {
        [SUBSCRIBERS]: new Set(),
        [VALUE]: null,
        [CALLBACK]: () => {
            if (!computedNode[SUBSCRIBERS].size) {
                computedNode[VALUE] = null;
                computedNode[HAS_VALUE] = false;
                unsubscribe(computedNode);

                return;
            }

            const tmp = computedNode[LEVEL];
            const nextValue = autoSubscribe(func, computedNode);

            if (nextValue !== computedNode[VALUE]) {
                computedNode[VALUE] = nextValue;
                schedule(computedNode);

                return;
            }

            if (tmp !== computedNode[LEVEL]) {
                updateLevel(computedNode);
            }
        },
        [SIGNALS]: new Set(),
        [CLOCK]: clock,
        [LEVEL]: 1,
        [HAS_VALUE]: false
    };
    const computed = () => {
        if (!computedNode[HAS_VALUE]) {
            if (computeRecursionCount < MAX_RECURSION_COUNT) {
                computeRecursionCount++;
                computedNode[VALUE] = autoSubscribe(func, computedNode);
                computedNode[HAS_VALUE] = true;
                computeRecursionCount--;
            } else {
                compute(func, computedNode);
            }
        }

        if (currentSubscriberNode) {
            computedNode[SUBSCRIBERS].add(currentSubscriberNode);
            currentSubscriberNode[SIGNALS].add(computedNode);
            currentSubscriberNode[LEVEL] =
                currentSubscriberNode[LEVEL] && Math.max(currentSubscriberNode[LEVEL], computedNode[LEVEL] + 1);
        }

        return (computedNode[HAS_VALUE] ? computedNode[VALUE] : fallback) as T;
    };

    computed.on = (callback: (value: T) => void) => {
        if (IS_SSR) {
            return NOOP;
        }

        const subscriberNode = createSubscriberNode(() => callback(computedNode[VALUE]!));

        autoSubscribe(computed, subscriberNode);

        return () => unsubscribe(subscriberNode);
    };

    return computed;
};

export const createEffect = (func: () => void | (() => void)): (() => void) => {
    if (IS_SSR) {
        return NOOP;
    }

    let value: void | (() => void);
    const subscriberNode = createSubscriberNode(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(func, subscriberNode);
    });

    value = autoSubscribe(func, subscriberNode);

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
              const [{ inst }, forceUpdate] = useState({ inst: { [VALUE]: value, [GET_SNAPSHOT]: getSnapshot } });

              useIsomorphicLayoutEffect(() => {
                  inst[VALUE] = value;
                  inst[GET_SNAPSHOT] = getSnapshot;

                  if (inst[VALUE] !== inst[GET_SNAPSHOT]()) {
                      forceUpdate({ inst });
                  }
              }, [subscribe, value, getSnapshot]);
              useEffect(() => {
                  if (inst[VALUE] !== inst[GET_SNAPSHOT]()) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (inst[VALUE] !== inst[GET_SNAPSHOT]()) {
                          forceUpdate({ inst });
                      }
                  });
              }, [inst, subscribe]);
              useDebugValue(value);

              return value;
          }
        : useSyncExternalStore;

export const useSignal = <T>(signal: Signal<T> | Computed<T>): T => useSyncExternalStoreShim(signal.on, signal);

export const useSelector = <T>(func: () => T): T => {
    const subscriberNode = useMemo(createSubscriberNode, []);

    return useSyncExternalStoreShim(
        useCallback((handleChange) => {
            subscriberNode[CALLBACK] = handleChange;

            return () => unsubscribe(subscriberNode);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
        useMemo(() => {
            let currentClock: typeof clock;
            let value: T;

            return () => {
                if (subscriberNode[CLOCK] !== currentClock) {
                    value = autoSubscribe(func, subscriberNode);
                    currentClock = subscriberNode[CLOCK];
                }

                return value;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [func])
    );
};

export const useResetSignals = (): void => {
    if (IS_SSR) {
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
