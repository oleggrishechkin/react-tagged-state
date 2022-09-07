import { useEffect, useDebugValue, useReducer } from 'react';

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
}

export interface Computed<T> {
    (): T;
}

interface Subscriber {
    cleanups: Set<(subscriber: Subscriber) => any>;
    disposes: (() => any)[] | null;
    callback: () => void;
    clock: typeof clock;
    level: number;
    pure: boolean;
}

let canSync = true;

let queue: Subscriber[][] | null = null;

let clock = {};

const runSubscribers = (subscribers: Subscriber[]) => {
    if (subscribers) {
        for (let index = 0; index < subscribers.length; index++) {
            const subscriber = subscribers[index];

            if (subscriber.clock !== clock) {
                subscriber.clock = clock;
                subscriber.callback();
            }
        }
    }
};

let promise: Promise<void> | null = null;

export const sync = (): void => {
    if (canSync) {
        if (queue) {
            while (queue) {
                clock = {};
                canSync = false;

                for (let level = 1; level < queue.length; level++) {
                    runSubscribers(queue[level]);
                }

                canSync = true;

                const subscribers = queue[0];

                queue = null;
                runSubscribers(subscribers);
            }
        }

        promise = null;
    }
};

const schedule = (subscribers: Set<Subscriber>) => {
    if (subscribers.size) {
        if (!queue) {
            queue = [];
        }

        for (const subscriber of subscribers) {
            if (queue[subscriber.level]) {
                queue[subscriber.level].push(subscriber);
            } else {
                queue[subscriber.level] = [subscriber];
            }
        }

        if (!promise) {
            const nextPromise = Promise.resolve().then(() => {
                if (nextPromise === promise) {
                    sync();
                }
            });

            promise = nextPromise;
        }
    }
};

const runDisposes = (subscriber: Subscriber) => {
    if (subscriber.disposes) {
        for (let index = 0; index < subscriber.disposes.length; index++) {
            subscriber.disposes[index]();
        }

        subscriber.disposes = null;
    }
};

const unsubscribe = (subscriber: Subscriber) => {
    runDisposes(subscriber);
    subscriber.clock = clock;

    if (subscriber.cleanups.size) {
        for (const cleanup of subscriber.cleanups) {
            cleanup(subscriber);
        }

        subscriber.cleanups.clear();

        if (subscriber.level) {
            subscriber.level = 1;
        }
    }
};

let currentParent: Subscriber | null = null;

let currentSubscriber: Subscriber | null = null;

const autoSubscribe = <T>(func: () => T, subscriber: Subscriber): T => {
    runDisposes(subscriber);
    subscriber.clock = clock;

    let cleanups;

    if (subscriber.cleanups.size && !subscriber.pure) {
        cleanups = Array.from(subscriber.cleanups);

        subscriber.cleanups.clear();

        if (subscriber.level) {
            subscriber.level = 1;
        }
    }

    const prevParent = currentParent;
    const prevSubscriber = currentSubscriber;

    currentParent = subscriber;
    currentSubscriber = subscriber;

    const value = func();

    currentParent = prevParent;
    currentSubscriber = prevSubscriber;

    if (cleanups) {
        for (let index = 0; index < cleanups.length; index++) {
            if (!subscriber.cleanups.has(cleanups[index])) {
                cleanups[index](subscriber);
            }
        }
    }

    return value;
};

export const sample = <T>(func: () => T): T => {
    const prevSubscriber = currentSubscriber;

    currentSubscriber = null;

    const value = func();

    currentSubscriber = prevSubscriber;

    return value;
};

const onDispose = (dispose: () => void) => {
    if (currentParent) {
        if (currentParent.disposes) {
            currentParent.disposes.push(dispose);
        } else {
            currentParent.disposes = [dispose];
        }
    }
};

export const createSignal = <T>(initialValue: T): Signal<T> => {
    let value = initialValue;
    const subscribers = new Set<Subscriber>();
    const cleanup = (subscriberNode: Subscriber) => subscribers.delete(subscriberNode);
    const dispose = () => {
        if (subscribers.size) {
            for (const subscriberNode of subscribers) {
                subscriberNode.cleanups.delete(cleanup);
            }

            subscribers.clear();
        }
    };

    onDispose(dispose);

    return (...args: [T | ((value: T) => T)] | []) => {
        if (args.length) {
            const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(value) : args[0];

            if (nextValue !== value) {
                value = nextValue;
                schedule(subscribers);
            }
        } else {
            if (currentSubscriber) {
                subscribers.add(currentSubscriber);
                currentSubscriber.cleanups.add(cleanup);
            }
        }

        return value;
    };
};

const EMPTY_VALUE = {};

const createSubscriber = ({ callback = () => {}, level = 0, pure = false }): Subscriber => ({
    cleanups: new Set(),
    disposes: null,
    callback,
    clock,
    level,
    pure,
});

export const createComputed = <T>(
    selector: () => T,
    { lazy = true, pure = false }: { lazy?: boolean; pure?: boolean } = {},
): Computed<T> => {
    let value: T | typeof EMPTY_VALUE = EMPTY_VALUE;
    const subscribers = new Set<Subscriber>();
    const subscriber = createSubscriber({
        callback: () => {
            if (!subscribers.size && lazy) {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                dispose();
            } else {
                const prevLevel = subscriber.level;
                const nextValue = autoSubscribe(selector, subscriber);

                subscriber.level = Math.max(prevLevel, subscriber.level);

                if (nextValue !== value) {
                    value = nextValue;
                    schedule(subscribers);
                }
            }
        },
        level: 1,
        pure,
    });
    const cleanup = (subscriberNode: Subscriber) => {
        subscribers.delete(subscriberNode);

        if (!subscribers.size && lazy) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            dispose();
        }
    };
    const dispose = () => {
        value = EMPTY_VALUE;

        if (subscribers.size) {
            for (const subscriberNode of subscribers) {
                subscriberNode.cleanups.delete(cleanup);
            }

            subscribers.clear();
        }

        unsubscribe(subscriber);
    };

    onDispose(dispose);

    if (!lazy) {
        value = autoSubscribe(selector, subscriber);
    }

    return () => {
        if (canSync) {
            sync();
        }

        if (value === EMPTY_VALUE) {
            value = autoSubscribe(selector, subscriber);
        }

        if (currentSubscriber) {
            subscribers.add(currentSubscriber);
            currentSubscriber.cleanups.add(cleanup);

            if (currentSubscriber.level) {
                currentSubscriber.level = Math.max(currentSubscriber.level, subscriber.level + 1);
            }
        }

        return value as T;
    };
};

const runCleanup = (cleanup: void | (() => void)) => {
    if (typeof cleanup === 'function') {
        cleanup();
    }
};

export const createEffect = (
    callback: () => void | (() => void),
    { pure = false }: { pure?: boolean } = {},
): (() => void) => {
    let cleanup: void | (() => void);
    const subscriber = createSubscriber({
        callback: () => {
            runCleanup(cleanup);
            cleanup = autoSubscribe(callback, subscriber);
        },
        pure,
    });
    const dispose = () => {
        runCleanup(cleanup);
        cleanup = void 0;
        unsubscribe(subscriber);
    };

    onDispose(dispose);
    cleanup = autoSubscribe(callback, subscriber);

    return dispose;
};

export const createSubscription = <T>(
    selector: () => T,
    callback: (value: T) => void | (() => void),
    { pure = false }: { pure?: boolean } = {},
): (() => void) => {
    let value: T | typeof EMPTY_VALUE = EMPTY_VALUE;
    let cleanup: void | (() => void);
    const subscriber = createSubscriber({
        callback: () => {
            const nextValue = autoSubscribe(selector, subscriber);

            if (nextValue !== value) {
                value = nextValue;
                runCleanup(cleanup);
                cleanup = callback(value);
            }
        },
        pure,
    });
    const dispose = () => {
        value = EMPTY_VALUE;
        runCleanup(cleanup);
        cleanup = void 0;
        unsubscribe(subscriber);
    };

    onDispose(dispose);
    value = autoSubscribe(selector, subscriber);

    return dispose;
};

interface State<T> {
    inst: {
        subscriber: Subscriber;
        value: T | typeof EMPTY_VALUE;
        clock: typeof clock;
        selector: () => T;
    };
}

const initialize = <T>(selector: () => T): State<T> => {
    const subscriber = createSubscriber({
        callback: () => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            inst.value = EMPTY_VALUE;
            unsubscribe(subscriber);
        },
    });

    const inst = {
        subscriber: subscriber,
        value: autoSubscribe(selector, subscriber) as T | typeof EMPTY_VALUE,
        clock: subscriber.clock,
        selector,
    };

    return { inst };
};

const reducer = <T>({ inst }: State<T>): State<T> => ({ inst });

export const useSelector = <T>(selector: () => T, { pure = false }: { pure?: boolean } = {}): T => {
    const [{ inst }, forceUpdate] = useReducer<({ inst }: State<T>) => State<T>, () => T>(
        reducer,
        selector,
        initialize,
    );

    inst.subscriber.pure = pure;

    useEffect(() => {
        if (inst.value === EMPTY_VALUE || inst.clock !== inst.subscriber.clock) {
            const nextValue = autoSubscribe(inst.selector, inst.subscriber);

            inst.clock = inst.subscriber.clock;

            if (nextValue !== inst.value) {
                inst.value = nextValue;
                forceUpdate();
            }
        }

        inst.subscriber.callback = () => {
            if (inst.clock !== inst.subscriber.clock) {
                const nextValue = autoSubscribe(inst.selector, inst.subscriber);

                inst.clock = inst.subscriber.clock;

                if (nextValue !== inst.value) {
                    inst.value = nextValue;
                    forceUpdate();
                }
            }
        };

        return () => {
            inst.value = EMPTY_VALUE;
            unsubscribe(inst.subscriber);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (inst.value === EMPTY_VALUE || inst.selector !== selector) {
        inst.value = autoSubscribe(selector, inst.subscriber);
        inst.clock = inst.subscriber.clock;
        inst.selector = selector;
    }

    useDebugValue(inst.value);

    return inst.value as T;
};
