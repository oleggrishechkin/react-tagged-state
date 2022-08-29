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
    level: number;
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

const runSubscriberNodes = (subscriberNodes: SubscriberNode[]) => {
    if (subscriberNodes) {
        for (let index = 0; index < subscriberNodes.length; index++) {
            const subscriberNode = subscriberNodes[index];

            if (subscriberNode.clock !== clock) {
                subscriberNode.clock = clock;
                subscriberNode.callback();
            }
        }
    }
};

let schedulePromise: Promise<void> | null = null;

export const sync = (): void => {
    if (canSync) {
        if (scheduleQueue) {
            while (scheduleQueue) {
                clock = {};
                canSync = false;

                for (let level = 1; level < scheduleQueue.length; level++) {
                    runSubscriberNodes(scheduleQueue[level]);
                }

                canSync = true;

                const subscriberNodes = scheduleQueue[0];

                scheduleQueue = null;
                runSubscriberNodes(subscriberNodes);
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

const dispose = (subscriberNode: SubscriberNode) => {
    subscriberNode.cleanup();

    if (subscriberNode.children) {
        for (let index = 0; index < subscriberNode.children.length; index++) {
            const child = subscriberNode.children[index];

            if ('signals' in child) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
};

const unsubscribe = (subscriberNode: SubscriberNode) => {
    dispose(subscriberNode);

    subscriberNode.clock = clock;

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
    dispose(subscriberNode);

    subscriberNode.clock = clock;

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

const addToParentNode = (anyNode: SignalNode | ComputedNode | SubscriberNode) => {
    if (currentParentNode) {
        if (currentParentNode.children) {
            currentParentNode.children.push(anyNode);
        } else {
            currentParentNode.children = [anyNode];
        }
    }
};

const bindWithSubscriberNode = (signalNode: SignalNode) => {
    if (currentSubscriberNode) {
        signalNode.subscribers.add(currentSubscriberNode);
        currentSubscriberNode.signals.add(signalNode);

        if (currentSubscriberNode.level && signalNode.level) {
            currentSubscriberNode.level = Math.max(currentSubscriberNode.level, signalNode.level + 1);
        }
    }
};

const runIfFunction = <T, K extends any[]>(value: T | ((...args: K) => T), ...args: K) => {
    if (typeof value === 'function') {
        return (value as (...args: K) => T)(...args);
    }

    return value;
};

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    let value = runIfFunction(initialValue);
    const signalNode: SignalNode = { subscribers: new Set(), level: 0 };

    addToParentNode(signalNode);

    return (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const nextValue = runIfFunction(args[0], value);

            if (nextValue !== value) {
                value = nextValue;
                schedule(signalNode);
            }
        } else {
            bindWithSubscriberNode(signalNode);
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
                const nextValue = autoSubscribe(selector, computedNode);

                computedNode.level = Math.max(level, computedNode.level);

                if (nextValue !== value) {
                    value = nextValue;
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

    addToParentNode(computedNode);

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

        bindWithSubscriberNode(computedNode);

        return value as T;
    };
};

const NOOP = () => {};

const createSubscriberNode = ({ callback = NOOP, level = 0, pure = false, cleanup = NOOP } = {}): SubscriberNode => ({
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
        cleanup: () => runIfFunction(value)
    });

    addToParentNode(subscriberNode);
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
        cleanup: () => runIfFunction(value)
    });

    addToParentNode(subscriberNode);
    autoSubscribe(signal, subscriberNode);

    return () => unsubscribe(subscriberNode);
};

const IS_SSR = typeof window === 'undefined';

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
