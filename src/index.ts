import { useRef } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';

let clock = {};

interface Sub {
    __callback: () => void;
    __objs: Set<Signal<any> | Computed<any>>;
}

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    readonly on: (callback: (value: T) => void) => () => void;
    readonly __subs: Set<Sub>;
    __value: T;
    __nextValue: { current: T } | null;
}

export interface Event<T = void> {
    (payload: T): T;
    readonly on: (callback: (payload: T) => void) => () => void;
    readonly __callbacks: Set<(payload: T) => void>;
}

export interface Computed<T> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
    readonly __sub: Sub;
    readonly __subs: Set<Sub>;
    __value: T | null;
    __nextValue: { current: T } | null;
}

let currentSub: Sub | null = null;

let batchedObjs: Set<Signal<any> | Computed<any>> | null = null;

const scheduleNotify = (obj: Signal<any> | Computed<any>) => {
    if (batchedObjs) {
        batchedObjs.add(obj);

        return;
    }

    batchedObjs = new Set([obj]);
    Promise.resolve().then(() => {
        const objs = batchedObjs!;

        batchedObjs = null;

        const uniqueSubs = new Set<Sub>();

        objs.forEach((obj) => {
            obj.__value = obj.__nextValue!.current;
            obj.__nextValue = null;
            obj.__subs.forEach((sub) => uniqueSubs.add(sub));
        });
        clock = {};
        uniqueSubs.forEach((sub) => sub.__callback());
    });
};

const createSub = (callback: () => void): Sub => ({
    __callback: callback,
    __objs: new Set()
});

const unsubscribe = (sub: Sub) => {
    const objs = sub.__objs;

    sub.__objs = new Set();
    objs.forEach((obj) => {
        obj.__subs.delete(sub);

        if (obj.__subs.size) {
            return;
        }

        if ('__sub' in obj) {
            unsubscribe(obj.__sub);
        }
    });
};

const autoSubscribe = <T>(func: () => T, sub: Sub) => {
    const prevObjs = sub.__objs;

    sub.__objs = new Set();

    const prevGlobalSub = currentSub;

    currentSub = sub;

    const value = func();

    currentSub = prevGlobalSub;
    prevObjs.forEach((obj) => {
        if (sub.__objs.has(obj)) {
            return;
        }

        obj.__subs.delete(sub);

        if (obj.__subs.size) {
            return;
        }

        if ('__sub' in obj) {
            unsubscribe(obj.__sub);
        }
    });

    return value;
};

export const sample = <T>(obj: Signal<T> | Computed<T> | (() => T)) => {
    const prevGlobalSub = currentSub;

    currentSub = null;

    const value = obj();

    currentSub = prevGlobalSub;

    return value;
};

export const createSignal = <T>(initializer: T | (() => T)) => {
    const signal: Signal<T> = Object.assign(
        (...args: any[]) => {
            if (args.length) {
                if (signal.__nextValue) {
                    signal.__nextValue.current =
                        typeof args[0] === 'function' ? args[0](signal.__nextValue.current) : args[0];

                    return signal.__value;
                }

                const nextValue = typeof args[0] === 'function' ? args[0](signal.__value) : args[0];

                if (nextValue === signal.__value) {
                    return signal.__value;
                }

                if (signal.__subs.size) {
                    signal.__nextValue = { current: nextValue };
                    scheduleNotify(signal);

                    return signal.__value;
                }

                signal.__value = nextValue;

                return signal.__value;
            }

            if (currentSub) {
                signal.__subs.add(currentSub);
                currentSub.__objs.add(signal);
            }

            return signal.__value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(signal()));

                autoSubscribe(signal, sub);

                return () => unsubscribe(sub);
            },
            __subs: new Set<Sub>(),
            __nextValue: null,
            __value: typeof initializer === 'function' ? (initializer as () => T)() : initializer
        }
    );

    return signal;
};

export const createEvent = <T = void>(): Event<T> => {
    const event: Event<T> = Object.assign(
        (payload: T) => {
            event.__callbacks.forEach((callback) => callback(payload));

            return payload;
        },
        {
            on: (callback: (payload: T) => void) => {
                event.__callbacks.add(callback);

                return () => {
                    event.__callbacks.delete(callback);
                };
            },
            __callbacks: new Set<(payload: T) => void>()
        }
    );

    return event;
};

export const createComputed = <T>(selector: () => T): Computed<T> => {
    const computed: Computed<T> = Object.assign(
        () => {
            if (currentSub) {
                computed.__subs.add(currentSub);
                currentSub.__objs.add(computed);
            }

            if (computed.__sub.__objs.size) {
                return computed.__value!;
            }

            computed.__value = autoSubscribe(selector, computed.__sub);

            return computed.__value;
        },
        {
            on: (callback: (value: T) => void): (() => void) => {
                const sub = createSub(() => callback(computed()));

                autoSubscribe(computed, sub);

                return () => unsubscribe(sub);
            },
            __sub: createSub(() => {
                if (computed.__subs.size) {
                    if (computed.__nextValue) {
                        computed.__nextValue.current = autoSubscribe(selector, computed.__sub);

                        return;
                    }

                    const nextValue = autoSubscribe(selector, computed.__sub);

                    if (nextValue !== computed.__value) {
                        computed.__nextValue = { current: nextValue };
                        scheduleNotify(computed);
                    }

                    return;
                }

                computed.__nextValue = null;
                unsubscribe(computed.__sub);
            }),
            __subs: new Set<Sub>(),
            __value: null,
            __nextValue: null
        }
    );

    return computed;
};

export const createEffect = (effect: () => void | (() => void)) => {
    let value: void | (() => void);
    const sub = createSub(() => {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(effect, sub);
    });

    value = autoSubscribe(effect, sub);

    return () => {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(sub);
    };
};

export const useSignal = <T>(obj: Signal<T> | Computed<T>): T => useSyncExternalStore(obj.on, obj);

export const useSelector = <T>(obj: Signal<T> | Computed<T> | (() => T)): T => {
    const vars = useRef<{
        sub: Sub;
        handleChange: () => void;
        subscribe: (handleChange: () => void) => () => void;
    } | null>(null);

    if (vars.current === null) {
        vars.current = {
            sub: createSub(() => vars.current!.handleChange()),
            handleChange: () => {},
            subscribe: (handleChange: () => void) => {
                vars.current!.handleChange = handleChange;

                return () => unsubscribe(vars.current!.sub);
            }
        };
    }

    let currentClock: typeof clock;
    let value: T;

    return useSyncExternalStore(vars.current.subscribe, () => {
        if (currentClock !== clock) {
            currentClock = clock;
            value = autoSubscribe(obj, vars.current!.sub);
        }

        return value;
    });
};
