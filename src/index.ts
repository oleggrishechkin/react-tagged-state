import { useMemo, useSyncExternalStore } from 'react';

const VALUE = Symbol();

const SUBSCRIBERS = Symbol();

const SUBSCRIBE = Symbol();

const ROOT = Symbol();

export type Callback<T> = (value: T) => void;

type Subscribers<T> = Set<Callback<T>> | null;

export interface SignalW<T> {
    (updater: T): void;
    [SUBSCRIBE]: (callback: Callback<T>) => () => void;
}

export interface SignalRW<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
    [SUBSCRIBE]: (callback: Callback<T>) => () => void;
}

// @ts-expect-error ROOT
// eslint-disable-next-line @typescript-eslint/no-use-before-define
const rootSignal = createSignal({}, ROOT);

function signalWFunction<T>(this: { [SUBSCRIBERS]: Subscribers<T> }, updater: T) {
    if (this[SUBSCRIBERS]) {
        for (const subscriber of this[SUBSCRIBERS]) {
            subscriber(updater);
        }
    }
}

function signalRWFunction<T>(
    this: { [VALUE]: T; [SUBSCRIBERS]: Subscribers<T>; [ROOT]: boolean },
    ...args: [] | [T] | [(value: T) => T]
) {
    if (args.length) {
        const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(this[VALUE]) : args[0];

        if (nextValue !== this[VALUE]) {
            this[VALUE] = nextValue;

            if (this[SUBSCRIBERS]) {
                for (const subscriber of this[SUBSCRIBERS]) {
                    subscriber(nextValue);
                }
            }

            if (!this[ROOT]) {
                rootSignal({});
            }
        }

        return;
    }

    return this[VALUE];
}

function unsubscribeFunction<T>(this: { [SUBSCRIBERS]: Subscribers<T> }, callback: Callback<T>) {
    if (this[SUBSCRIBERS]) {
        this[SUBSCRIBERS].delete(callback);

        if (!this[SUBSCRIBERS].size) {
            this[SUBSCRIBERS] = null;
        }
    }
}

function subscribeFunction<T>(this: { [SUBSCRIBERS]: Subscribers<T> }, callback: Callback<T>) {
    if (!this[SUBSCRIBERS]) {
        this[SUBSCRIBERS] = new Set();
    }

    this[SUBSCRIBERS].add(callback);

    // @ts-expect-error unknown
    return unsubscribeFunction.bind(this, callback);
}

export function createSignal<T>(initialValue: T): SignalRW<T>;
export function createSignal<T = void>(): SignalW<T>;
export function createSignal<T>(...args: [] | [T] | [T, typeof ROOT]): any {
    const data = args.length
        ? { [VALUE]: args[0], [SUBSCRIBERS]: null, [ROOT]: args[1] === ROOT }
        : { [SUBSCRIBERS]: null };
    const signal = (args.length ? signalRWFunction : signalWFunction).bind(data);

    Object.defineProperty(signal, SUBSCRIBE, { value: subscribeFunction.bind(data) });

    return signal;
}

export function subscribe<T>(signal: SignalRW<T> | SignalW<T>, callback: Callback<T>) {
    return signal[SUBSCRIBE](callback);
}

export function useSelector<T, K>(signal: SignalRW<T>, selector: (value: T) => K): K;
export function useSelector<T>(signal: SignalRW<T>): T;
export function useSelector<T>(selector: () => T): T;
export function useSelector<T, K>(signal: SignalRW<T> | (() => T), selector?: (value: T) => K) {
    const isSignal = SUBSCRIBE in signal;
    const snapshotSignal = (isSignal ? signal : rootSignal) as SignalRW<T>;
    const snapshotSelector = selector || (isSignal ? null : signal);

    return useSyncExternalStore(
        snapshotSignal[SUBSCRIBE],
        useMemo(() => {
            if (snapshotSelector) {
                let value: any = {};
                let selected: T | K;

                return () => {
                    const nextValue = snapshotSignal();

                    if (nextValue === value) {
                        return selected;
                    }

                    value = nextValue;
                    selected = snapshotSelector(nextValue);

                    return selected;
                };
            }

            return snapshotSignal;
        }, [snapshotSignal, snapshotSelector]),
    );
}
