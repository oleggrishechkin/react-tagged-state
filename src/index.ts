import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, useDebugValue } from 'react';

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
}

export interface Computed<T> {
    (): T;
}

interface SignalNode {
    subscribers: Set<SubscriberNode | ComputedNode>;
}

interface ComputedNode extends SignalNode, SubscriberNode {
    lazy: boolean;
}

interface SubscriberNode {
    callback: () => void;
    signals: Set<SignalNode | ComputedNode>;
    level: number;
    children: (SignalNode | ComputedNode | SubscriberNode)[] | null;
    pure: boolean;
    clock: typeof clock;
    cleanup: () => void;
}

let canSync = true;

let scheduleQueue: SubscriberNode[][] | null = null;

let clock = {};

let schedulePromise: Promise<void> | null = null;

export const sync = (): void => {
    if (canSync) {
        if (scheduleQueue) {
            while (scheduleQueue) {
                clock = {};
                canSync = false;

                for (let level = 1; level < scheduleQueue.length; level++) {
                    const subscriberNodes = scheduleQueue[level];

                    if (subscriberNodes) {
                        for (let index = 0; index < subscriberNodes.length; index++) {
                            const subscriberNode = subscriberNodes[index];

                            if (subscriberNode.clock !== clock) {
                                subscriberNode.clock = clock;
                                subscriberNode.callback();
                            }
                        }
                    }
                }

                canSync = true;

                const subscriberNodes = scheduleQueue[0];

                scheduleQueue = null;

                if (subscriberNodes) {
                    for (let index = 0; index < subscriberNodes.length; index++) {
                        const subscriberNode = subscriberNodes[index];

                        if (subscriberNode.clock !== clock) {
                            subscriberNode.clock = clock;
                            subscriberNode.callback();
                        }
                    }
                }
            }
        }

        schedulePromise = null;
    }
};

const schedule = (signalNode: SignalNode) => {
    if (signalNode.subscribers.size) {
        if (!scheduleQueue) {
            scheduleQueue = [];
        }

        for (const subscriberNode of signalNode.subscribers) {
            if (scheduleQueue[subscriberNode.level]) {
                scheduleQueue[subscriberNode.level].push(subscriberNode);
            } else {
                scheduleQueue[subscriberNode.level] = [subscriberNode];
            }
        }

        if (!schedulePromise) {
            const promise = Promise.resolve().then(() => {
                if (schedulePromise === promise) {
                    sync();
                }
            });

            schedulePromise = promise;
        }
    }
};

const unsubscribe = (subscriberNode: SubscriberNode) => {
    subscriberNode.cleanup();
    subscriberNode.clock = clock;

    if (subscriberNode.children) {
        for (let index = 0; index < subscriberNode.children.length; index++) {
            const child = subscriberNode.children[index];

            if ('signals' in child) {
                unsubscribe(child);
            }

            if ('subscribers' in child && child.subscribers.size) {
                for (const subscriberNode of child.subscribers) {
                    subscriberNode.signals.delete(child);
                }

                child.subscribers.clear();
            }
        }

        subscriberNode.children = null;
    }

    if (subscriberNode.signals.size) {
        for (const signalNode of subscriberNode.signals) {
            signalNode.subscribers.delete(subscriberNode);

            if ('signals' in signalNode && !signalNode.subscribers.size && signalNode.lazy) {
                unsubscribe(signalNode);
            }
        }

        subscriberNode.signals.clear();
    }

    if (subscriberNode.level) {
        subscriberNode.level = 1;
    }
};

let currentParentNode: SubscriberNode | null = null;

let currentSubscriberNode: SubscriberNode | null = null;

const autoSubscribe = <T>(func: () => T, subscriberNode: SubscriberNode): T => {
    subscriberNode.cleanup();
    subscriberNode.clock = clock;

    if (subscriberNode.children) {
        for (let index = 0; index < subscriberNode.children.length; index++) {
            const child = subscriberNode.children[index];

            if ('signals' in child) {
                unsubscribe(child);
            }

            if ('subscribers' in child && child.subscribers.size) {
                for (const subscriberNode of child.subscribers) {
                    subscriberNode.signals.delete(child);
                }

                child.subscribers.clear();
            }
        }

        subscriberNode.children = null;
    }

    let signalNodes;

    if (!subscriberNode.pure) {
        if (subscriberNode.signals.size) {
            signalNodes = Array.from(subscriberNode.signals);

            subscriberNode.signals.clear();
        }

        if (subscriberNode.level) {
            subscriberNode.level = 1;
        }
    }

    const prevParentNode = currentParentNode;
    const prevSubscriberNode = currentSubscriberNode;

    currentParentNode = subscriberNode;
    currentSubscriberNode = subscriberNode;

    const value = func();

    currentParentNode = prevParentNode;
    currentSubscriberNode = prevSubscriberNode;

    if (signalNodes) {
        for (let index = 0; index < signalNodes.length; index++) {
            const signalNode = signalNodes[index];

            if (!subscriberNode.signals.has(signalNode)) {
                signalNode.subscribers.delete(subscriberNode);

                if ('signals' in signalNode && !signalNode.subscribers.size && signalNode.lazy) {
                    unsubscribe(signalNode);
                }
            }
        }
    }

    return value;
};

export const sample = <T>(func: () => T): T => {
    const prevSubscriberNode = currentSubscriberNode;

    currentSubscriberNode = null;

    const value = func();

    currentSubscriberNode = prevSubscriberNode;

    return value;
};

const createNode = <T extends SignalNode | ComputedNode | SubscriberNode>(anyNode: T): T => {
    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(anyNode);
        } else {
            currentParentNode.children = [anyNode];
        }
    }

    return anyNode;
};

const EMPTY_VALUE = {};

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    let value: T | typeof EMPTY_VALUE = EMPTY_VALUE;
    const signalNode = createNode({ subscribers: new Set() });

    return (...args: [T | ((value: T) => T)] | []) => {
        if (value === EMPTY_VALUE) {
            value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
        }

        if (args.length) {
            const prevValue = value as T;

            value = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(prevValue) : args[0];

            if (prevValue !== value) {
                schedule(signalNode);
            }
        } else {
            if (currentSubscriberNode) {
                signalNode.subscribers.add(currentSubscriberNode);
                currentSubscriberNode.signals.add(signalNode);
            }
        }

        return value as T;
    };
};

export const createComputed = <T>(
    selector: () => T,
    { lazy = true, pure = false }: { lazy?: boolean; pure?: boolean } = {}
): Computed<T> => {
    let value: T | typeof EMPTY_VALUE = EMPTY_VALUE;
    const computedNode = createNode({
        subscribers: new Set(),
        callback: () => {
            if (!computedNode.subscribers.size && computedNode.lazy) {
                unsubscribe(computedNode);
            } else {
                const prevValue = value;
                const prevLevel = computedNode.level;

                value = autoSubscribe(selector, computedNode);
                computedNode.level = Math.max(prevLevel, computedNode.level);

                if (prevValue !== value) {
                    schedule(computedNode);
                }
            }
        },
        signals: new Set(),
        level: 1,
        children: null,
        pure,
        clock,
        cleanup: () => {
            value = EMPTY_VALUE;
        },
        lazy
    });

    if (!computedNode.lazy) {
        value = autoSubscribe(selector, computedNode);
    }

    return () => {
        if (canSync) {
            sync();
        }

        if (value === EMPTY_VALUE) {
            value = autoSubscribe(selector, computedNode);
        }

        if (currentSubscriberNode) {
            computedNode.subscribers.add(currentSubscriberNode);
            currentSubscriberNode.signals.add(computedNode);

            if (currentSubscriberNode.level) {
                currentSubscriberNode.level = Math.max(currentSubscriberNode.level, computedNode.level + 1);
            }
        }

        return value as T;
    };
};

export const createEffect = (
    callback: () => void | (() => void),
    { pure = false }: { pure?: boolean } = {}
): (() => void) => {
    let value: void | (() => void);
    const subscriberNode = createNode({
        callback: () => {
            value = autoSubscribe(callback, subscriberNode);
        },
        signals: new Set(),
        level: 0,
        children: null,
        pure,
        clock,
        cleanup: () => {
            if (typeof value === 'function') {
                value();
            }
        }
    });

    value = autoSubscribe(callback, subscriberNode);

    return () => unsubscribe(subscriberNode);
};

export const createSubscription = <T>(
    selector: () => T,
    callback: (value: T) => void | (() => void),
    { pure = false }: { pure?: boolean } = {}
): (() => void) => {
    let selection: T;
    let value: void | (() => void);
    const subscriberNode = createNode({
        callback: () => {
            const prevSelection = selection;

            selection = autoSubscribe(selector, subscriberNode);

            if (prevSelection !== selection) {
                value = callback(selection);
            }
        },
        signals: new Set(),
        level: 0,
        children: null,
        pure,
        clock,
        cleanup: () => {
            if (typeof value === 'function') {
                value();
            }
        }
    });

    selection = autoSubscribe(selector, subscriberNode);

    return () => unsubscribe(subscriberNode);
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
              useDebugValue(value);

              return value;
          }
        : useSyncExternalStore;

export const useSelector = <T>(selector: () => T, { pure = false }: { pure?: boolean } = {}): T => {
    const subscriberNode = useMemo(
        () =>
            createNode({
                callback: () => {},
                signals: new Set(),
                level: 0,
                children: null,
                pure,
                clock,
                cleanup: () => {}
            }),
        [pure]
    );

    return useSyncExternalStoreShim(
        useCallback(
            (handleChange) => {
                subscriberNode.callback = handleChange;

                return () => unsubscribe(subscriberNode);
            },
            [subscriberNode]
        ),
        useMemo(() => {
            let currentClock: typeof clock;
            let selection: T;

            return () => {
                if (subscriberNode.clock !== currentClock) {
                    selection = autoSubscribe(selector, subscriberNode);
                    currentClock = subscriberNode.clock;
                }

                return selection;
            };
        }, [selector, subscriberNode])
    );
};
