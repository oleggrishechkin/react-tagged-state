/* eslint-disable @typescript-eslint/ban-types */
import { useEffect, useReducer } from 'react';

const noop = () => {};

const array: any[] = [];

const run = (func: () => void) => func();

const arrayFrom = Array.from;

const globalSubscribers = new WeakMap<object, Set<(value: any) => void>>();

let globalObjs: object[] | null = null;

let globalObjsMap: Map<object, any> | null = null;

const get = <Type extends object>(obj: Type) => {
    if (globalObjs) {
        globalObjs.push(obj);
    }

    return obj;
};

const set = <Type extends object, Payload>(obj: Type, payload?: Payload) => {
    if (globalObjsMap) {
        globalObjsMap.set(obj, payload || obj);
    }

    return obj;
};

interface Event<Type> {
    (payload: Type): void;
}

interface Signal<Type> {
    (): Type;
    (updater: Type | ((value: Type) => Type)): void;
}

interface Subscribe {
    <Type>(event: Event<Type>, callback: (value: Type) => void): () => void;
    <Type>(signal: Signal<Type>, callback: (value: Type) => void): () => void;
    <Type>(obj: Type, callback: (value: Type) => void): () => void;
}

const subscribe: Subscribe = (obj: any, callback: (value: any) => void) => {
    let subscribers = globalSubscribers.get(obj);

    if (!subscribers) {
        subscribers = new Set();
        globalSubscribers.set(obj, subscribers);
    }

    subscribers.add(callback);

    return () => {
        subscribers!.delete(callback);
    };
};

const shallowEqual = <Type extends any[]>(target: Type, source: Type) =>
    target.length === source.length && target.every((item, index) => item === source[index]);

const runEffect = (func: (mark: typeof get) => (() => void) | void) => {
    const refs: { lastObjs: object[]; cleanups: (() => void)[]; cleanup: () => void } = {
        lastObjs: array,
        cleanups: array,
        cleanup: noop
    };
    const effect = () => {
        refs.cleanup();

        const objs: object[] = [];

        globalObjs = objs;

        const value = func(get);

        globalObjs = null;

        if (!shallowEqual(objs, refs.lastObjs)) {
            refs.lastObjs = objs;
            refs.cleanups.forEach(run);
            refs.cleanups = objs.map((obj) => subscribe(obj, effect));
        }

        refs.cleanup = typeof value === 'function' ? value : noop;
    };

    effect();

    return () => {
        refs.cleanup();
        refs.cleanups.forEach(run);
    };
};

const mutate = <Type>(func: (mark: typeof set) => Type) => {
    if (globalObjsMap) {
        return func(set);
    }

    const objsSet = new Map<object, any>();

    globalObjsMap = objsSet;

    const value = func(set);

    globalObjsMap = null;
    objsSet.forEach((payload, obj) => {
        const subscribers = globalSubscribers.get(obj);

        if (subscribers) {
            arrayFrom(subscribers).forEach((subscriber) => subscriber(payload));
        }
    });

    return value;
};

const createEvent = <Type = void>() => {
    const obj: Event<Type> = (payload: Type) =>
        mutate((mark) => {
            mark(obj, payload);
        });

    return obj;
};

const createSignal = <Type>(initialValue: Type | (() => Type)) => {
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const obj: Signal<Type> = function (updater?: Type | ((value: Type) => Type)) {
        if (arguments.length) {
            const nextValue = typeof updater === 'function' ? (updater as (value: Type) => Type)(value) : updater!;

            if (nextValue !== value) {
                mutate((mark) => {
                    if (typeof value === 'object' || typeof value === 'function') {
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        mark(value);
                    }

                    value = nextValue;
                    mark(obj, value);
                });
            }

            return value;
        } else {
            get(obj);

            return value;
        }
    };

    return obj;
};

const mutableInit = (): { refs: { lastObj: object; cleanup: () => void } } => ({
    refs: { lastObj: noop, cleanup: noop }
});

const mutableReducer = ({ refs }: ReturnType<typeof mutableInit>) => ({ refs });

const useMutable = <Type extends object>(obj: Type): Type => {
    const [{ refs }, forceUpdate] = useReducer(mutableReducer, null, mutableInit);

    if (obj !== refs.lastObj) {
        refs.cleanup();
        refs.cleanup = subscribe((refs.lastObj = obj), forceUpdate);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => refs.cleanup(), []);

    return obj;
};

const computedInit = (): { refs: { lastObjs: object[]; cleanups: (() => void)[]; callback: () => void } } => ({
    refs: { lastObjs: array, cleanups: array, callback: noop }
});

const computedReducer = ({ refs }: ReturnType<typeof computedInit>) => ({ refs });

const useComputed = <Type>(func: (mark: typeof get) => Type) => {
    const [{ refs }, forceUpdate] = useReducer(computedReducer, 0, computedInit);
    const objs: object[] = [];

    globalObjs = objs;

    const value = func(get);

    globalObjs = null;
    refs.callback = () => {
        const objs: object[] = [];

        globalObjs = objs;

        const nextValue = func(get);

        globalObjs = null;

        if (nextValue === value) {
            if (!shallowEqual(objs, refs.lastObjs)) {
                const callback = () => refs.callback();

                refs.cleanups.forEach(run);
                refs.cleanups = (refs.lastObjs = objs).map((obj) => subscribe(obj, callback));
            }
        } else {
            forceUpdate();
        }
    };

    if (!shallowEqual(objs, refs.lastObjs)) {
        const callback = () => refs.callback();

        refs.cleanups.forEach(run);
        refs.cleanups = (refs.lastObjs = objs).map((obj) => subscribe(obj, callback));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => () => refs.cleanups.forEach(run), []);

    return value;
};

export {
    get,
    set,
    Event,
    Signal,
    Subscribe,
    subscribe,
    runEffect,
    mutate,
    createSignal,
    createEvent,
    useMutable,
    useComputed
};
