import { useMemo, useSyncExternalStore } from 'react';

export interface Event<T> {
    (nextValue: T): void;
    on: (callback: (value: T) => void) => () => void;
}

export interface Signal<T> {
    (): T;
    (nextValue: T | ((value: T) => T)): void;
    on: (callback: (value: T) => void) => () => void;
}

export const createEvent = <T = void>(): Event<T> => {
    let callbacks: Set<(value: T) => void> | null = null;

    return Object.assign(
        (value: T) => {
            if (callbacks) {
                for (const callback of callbacks) {
                    callback(value);
                }
            }
        },
        {
            on: (callback: (value: T) => void) => {
                if (!callbacks) {
                    callbacks = new Set();
                }

                callbacks.add(callback);

                return () => {
                    if (callbacks) {
                        callbacks.delete(callback);

                        if (!callbacks.size) {
                            callbacks = null;
                        }
                    }
                };
            },
        },
    );
};

let clock = {};

const clockUpdateEvent = createEvent();

export const createSignal = <T>(initialValue: T | (() => T)): Signal<T> => {
    const event = createEvent<T>();
    let value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;

    return Object.assign(
        (...args: [] | [nextValue: T | ((value: T) => T)]) => {
            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(value) : args[0];

                if (nextValue !== value) {
                    value = nextValue;
                    event(value);
                    clock = {};
                    clockUpdateEvent();
                }

                return;
            }

            return value;
        },
        { on: event.on },
    ) as Signal<T>;
};

export const useSelector = <T>(signal: Signal<T> | (() => T)) =>
    useSyncExternalStore(
        'on' in signal ? signal.on : clockUpdateEvent.on,
        useMemo(() => {
            if ('on' in signal) {
                return signal;
            }

            let lastClock: typeof clock | null = null;
            let value: T;

            return () => {
                if (clock !== lastClock) {
                    lastClock = clock;
                    value = signal();
                }

                return value;
            };
        }, [signal]),
    );
