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

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    let value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    const signalNode: SignalNode = { subscribers: new Set() };

    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(signalNode);
        } else {
            currentParentNode.children = [signalNode];
        }
    }

    return (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const prevValue = value;

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

        return value;
    };
};

const EMPTY_VALUE = {};

export const createComputed = <T>(
    selector: () => T,
    { lazy = true, pure = false }: { lazy?: boolean; pure?: boolean } = {}
): Computed<T> => {
    let value: T | typeof EMPTY_VALUE = EMPTY_VALUE;
    const computedNode: ComputedNode = {
        subscribers: new Set(),
        callback: () => {
            if (!computedNode.subscribers.size && computedNode.lazy) {
                unsubscribe(computedNode);
            } else {
                const level = computedNode.level;
                const prevValue = value;

                value = autoSubscribe(selector, computedNode);
                computedNode.level = Math.max(level, computedNode.level);

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
    };

    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(computedNode);
        } else {
            currentParentNode.children = [computedNode];
        }
    }

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

const createSubscriberNode = ({
    callback = () => {},
    level = 0,
    pure = false,
    cleanup = () => {}
} = {}): SubscriberNode => ({
    callback,
    signals: new Set(),
    level,
    children: null,
    pure,
    clock,
    cleanup
});

export const createEffect = (
    callback: () => void | (() => void),
    { pure = false }: { pure?: boolean } = {}
): (() => void) => {
    let value: void | (() => void);
    const subscriberNode = createSubscriberNode({
        callback: () => {
            value = autoSubscribe(callback, subscriberNode);
        },
        pure,
        cleanup: () => {
            if (typeof value === 'function') {
                value();
            }
        }
    });

    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(subscriberNode);
        } else {
            currentParentNode.children = [subscriberNode];
        }
    }

    value = autoSubscribe(callback, subscriberNode);

    return () => unsubscribe(subscriberNode);
};

export const createSubscription = <T>(
    signal: Signal<T> | Computed<T>,
    callback: (value: T) => void | (() => void)
): (() => void) => {
    let value: void | (() => void);
    const subscriberNode = createSubscriberNode({
        callback: () => {
            value = callback(autoSubscribe(signal, subscriberNode));
        },
        pure: true,
        cleanup: () => {
            if (typeof value === 'function') {
                value();
            }
        }
    });

    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(subscriberNode);
        } else {
            currentParentNode.children = [subscriberNode];
        }
    }

    autoSubscribe(signal, subscriberNode);

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

export const useSignal = <T>(signal: Signal<T> | Computed<T>): T =>
    useSyncExternalStoreShim(
        useCallback((handleChange) => createSubscription(signal, handleChange), [signal]),
        signal
    );

export const useSelector = <T>(selector: () => T, { pure = false }: { pure?: boolean } = {}): T => {
    const subscriberNode = useMemo(() => createSubscriberNode({ pure }), [pure]);

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
            let value: T;

            return () => {
                if (subscriberNode.clock !== currentClock) {
                    value = autoSubscribe(selector, subscriberNode);
                    currentClock = subscriberNode.clock;
                }

                return value;
            };
        }, [selector, subscriberNode])
    );
};
