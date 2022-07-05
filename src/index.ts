import { useCallback, useMemo } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

let clock = {};

export interface Subscriber {
    __callback: () => void;
    __signals: Set<ReadOnlySignal<any>>;
    __clock: typeof clock;
}

export interface ReadOnlySignal<T> {
    (): T;
    readonly __subscribers: Set<Subscriber>;
    on: (callback: (value: T) => void) => () => void;
}

export interface Signal<T> extends ReadOnlySignal<T> {
    (updater: T | ((value: T) => T)): T;
}

export interface Event<T = void> {
    (value: T): T;
    on: (callback: (value: T) => void) => () => void;
}

let currentSubscriber: Subscriber | null = null;

let batchedSignals: Set<ReadOnlySignal<any>> | null = null;

export const batch = <T>(func: () => T): T => {
    if (batchedSignals) {
        return func();
    }

    batchedSignals = new Set();

    const value = func();
    const signals = batchedSignals;

    batchedSignals = null;

    if (signals.size !== 0) {
        clock = {};
        batch(() =>
            signals.forEach((signal) =>
                signal.__subscribers.forEach((subscriber) => {
                    if (subscriber.__clock !== clock) {
                        subscriber.__callback();
                    }
                })
            )
        );
    }

    return value;
};

const createSubscriber = (callback: () => void) => ({
    __callback: callback,
    __signals: new Set<ReadOnlySignal<any>>(),
    __clock: clock
});

export const sample = <T>(func: () => T, subscriber: Subscriber | null = null): T => {
    const previousSubscriber = currentSubscriber;

    currentSubscriber = subscriber;

    const value = func();

    currentSubscriber = previousSubscriber;

    return value;
};

const subscribe = <T>(func: () => T, subscriber: Subscriber) => {
    const previousSignals = subscriber.__signals;

    subscriber.__signals = new Set();
    subscriber.__clock = clock;

    const value = sample(func, subscriber);

    previousSignals.forEach((signal) => {
        if (subscriber.__signals.has(signal)) {
            return;
        }

        signal.__subscribers.delete(subscriber);
    });

    return value;
};

const unsubscribe = (subscriber: Subscriber) => {
    subscriber.__signals.forEach((signal) => signal.__subscribers.delete(subscriber));
    subscriber.__signals = new Set();
    subscriber.__clock = clock;
};

export const createSignal = <T>(initializer: T | (() => T)): Signal<T> => {
    let value = typeof initializer === 'function' ? (initializer as () => T)() : initializer;
    const signal = Object.assign(
        (...args: any[]) => {
            if (args.length === 0) {
                if (currentSubscriber) {
                    signal.__subscribers.add(currentSubscriber);
                    currentSubscriber.__signals.add(signal);
                }
            } else {
                const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

                if (nextValue !== value) {
                    value = nextValue;

                    if (signal.__subscribers.size !== 0) {
                        batch(() => batchedSignals!.add(signal));
                    }
                }
            }

            return value;
        },
        {
            on: (callback: (value: T) => void) => {
                const subscriber = createSubscriber(() => callback(signal()));

                subscribe(signal, subscriber);

                return () => unsubscribe(subscriber);
            },
            __subscribers: new Set<Subscriber>()
        }
    );

    return signal;
};

export const createEvent = <T = void>(): Event<T> => {
    const callbacks = new Set<(value: T) => void>();

    return Object.assign(
        (value: T) => {
            callbacks.forEach((callback) => callback(value));

            return value;
        },
        {
            on: (callback: (value: T) => void) => {
                callbacks.add(callback);

                return () => {
                    callbacks.delete(callback);
                };
            }
        }
    );
};

export const createComputed = <T>(func: () => T): ReadOnlySignal<T> => {
    const signal = createSignal<T | null>(null);
    const subscriber = createSubscriber(() => {
        if (signal.__subscribers.size === 0) {
            unsubscribe(subscriber);

            return;
        }

        signal(subscribe(func, subscriber));
    });

    return Object.assign(
        () => {
            if (subscriber.__signals.size === 0) {
                signal(subscribe(func, subscriber));
            }

            return signal()!;
        },
        {
            on: signal.on as (callback: (value: T) => void) => () => void,
            __subscribers: signal.__subscribers
        }
    );
};

export const createEffect = (func: () => void | (() => void)): (() => void) => {
    let value: void | (() => void);
    const subscriber = createSubscriber(() => {
        if (typeof value === 'function') {
            value();
        }

        value = subscribe(func, subscriber);
    });

    value = subscribe(func, subscriber);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(subscriber);
    };
};

export const useSignal = <T>(signal: ReadOnlySignal<T>): T => useSyncExternalStore(signal.on, signal);

export const useSelector = <T>(func: ReadOnlySignal<T> | (() => T)): T => {
    const subscriber = useMemo(() => createSubscriber(() => {}), []);
    let currentClock: typeof clock;
    let value: T;

    return useSyncExternalStore(
        useCallback(
            (handleChange) => {
                subscriber.__callback = handleChange;

                return () => unsubscribe(subscriber);
            },
            [subscriber]
        ),
        () => {
            if (currentClock !== clock) {
                currentClock = clock;
                value = subscribe(func, subscriber);
            }

            return value;
        }
    );
};
