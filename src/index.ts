// @ts-expect-error Module '"react"' has no exported member 'useSyncExternalStore'
import { useEffect, useLayoutEffect, useSyncExternalStore, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

type Tagged = MutableObject | Signal<any> | Event<any>;

const noop = () => {};

const emptyArray: any[] = [];

const run = <Type>(func: () => Type) => func();

const INTERNAL_SUBSCRIBE = Symbol();

const globalSubscribers = new WeakMap<Tagged, Set<() => void>>();

const globalVersions = new WeakMap<Tagged, MutableObject>();

let globalObjs: Tagged[] | null = null;

let globalObjsSet: Set<Tagged> | null = null;

const runWithObjs = <Type>(func: () => Type, objs: typeof globalObjs) => {
    const tmp = globalObjs;

    globalObjs = objs;

    const value = func();

    globalObjs = tmp;

    return value;
};

const subscribeTo = (obj: Tagged, callback: () => void) => {
    let subscribers = globalSubscribers.get(obj);

    if (!subscribers) {
        subscribers = new Set();
        globalSubscribers.set(obj, subscribers);
    }

    subscribers.add(callback);

    return () => {
        if (subscribers!.size === 1) {
            globalSubscribers.delete(obj);
            globalVersions.delete(obj);
        } else {
            subscribers!.delete(callback);
        }
    };
};

const read = <Type extends Tagged>(obj: Type) => {
    if (globalObjs) {
        globalObjs.push(obj);
    }
};

const write = <Type extends Tagged>(obj: Type) => {
    if (!globalObjsSet) {
        globalObjsSet = new Set<Tagged>();
        Promise.resolve().then(() => {
            const objsSet = globalObjsSet!;

            globalObjsSet = null;
            unstable_batchedUpdates(() => {
                const calledSubscribers = new Set<() => void>();

                objsSet.forEach((obj) => {
                    const subscribers = globalSubscribers.get(obj);

                    if (subscribers) {
                        subscribers.forEach((subscriber) => {
                            if (!calledSubscribers.has(subscriber)) {
                                calledSubscribers.add(subscriber);
                                subscriber();
                            }
                        });
                    }
                });
            });
        });
    }

    if (globalSubscribers.has(obj)) {
        globalObjsSet.add(obj);
    }
};

type MutableObject = Record<any, any> | any[] | Set<any> | Map<any, any> | WeakSet<any> | WeakMap<any, any>;

const mutable = <Type extends MutableObject>(obj: Type) => {
    read(obj);

    return obj;
};

const mutated = <Type extends MutableObject>(obj: Type) => {
    if (globalSubscribers.get(obj)) {
        globalVersions.set(obj, {});
    }

    write(obj);

    return obj;
};

interface Signal<Type> {
    (): Type;
    (updater: Type | ((value: Type) => Type)): Type;
    readonly [INTERNAL_SUBSCRIBE]: (callback: (value: Type) => void) => () => void;
}

const createSignal = <Type>(initialValue: Type | (() => Type)) => {
    let value = typeof initialValue === 'function' ? (initialValue as () => Type)() : initialValue;
    const obj: Signal<Type> = Object.assign(
        function (updater?: Type | ((value: Type) => Type)) {
            if (arguments.length) {
                const nextValue = typeof updater === 'function' ? (updater as (value: Type) => Type)(value) : updater!;

                if (nextValue !== value) {
                    value = nextValue;
                    write(obj);
                }
            } else {
                read(obj);
            }

            return value;
        },
        {
            [INTERNAL_SUBSCRIBE]: (callback: (value: Type) => void) => subscribeTo(obj, () => callback(value))
        }
    );

    return obj;
};

interface Event<Type = void> {
    (payload: Type): Type;
    readonly [INTERNAL_SUBSCRIBE]: (callback: (value: Type) => void) => () => void;
}

const createEvent = <Type = void>() => {
    let value: Type;
    const obj: Event<Type> = Object.assign(
        (payload: Type) => {
            value = payload;
            write(obj);

            return payload;
        },
        {
            [INTERNAL_SUBSCRIBE]: (callback: (value: Type) => void) => subscribeTo(obj, () => callback(value))
        }
    );

    return obj;
};

const shallowNotEqual = <Type extends any[]>(prev: Type, next: Type) =>
    next.length !== prev.length || next.some((item, index) => item !== prev[index]);

const createEffect = (func: () => void | (() => void)) => {
    let lastObjs: Tagged[] = emptyArray;
    let lastCleanups: (() => void)[] = emptyArray;
    const objs: Tagged[] = [];
    let value = runWithObjs(func, objs);
    const callback = () => {
        if (typeof value === 'function') {
            value();
        }

        const objs: Tagged[] = [];

        value = runWithObjs(func, objs);

        if (shallowNotEqual(objs, lastObjs)) {
            lastCleanups.forEach(run);
            lastCleanups = objs.map((obj) => subscribeTo(obj, callback));
            lastObjs = objs;
        }
    };

    lastCleanups = objs.map((obj) => subscribeTo(obj, callback));
    lastObjs = objs;

    return () => {
        if (typeof value === 'function') {
            value();
        }

        lastCleanups.forEach(run);
    };
};

interface Subscribe {
    <Type>(obj: Signal<Type> | Event<Type> | (() => Type), callback: (value: Type) => void): () => void;
    <Type extends MutableObject>(obj: Type, callback: (value: Type) => void): () => void;
}

const subscribe: Subscribe = (obj: any, func: (value: any) => void) => {
    if (INTERNAL_SUBSCRIBE in obj) {
        return obj[INTERNAL_SUBSCRIBE](func);
    }

    if (typeof obj === 'function') {
        let lastObjs: Tagged[] = emptyArray;
        let lastCleanups: (() => void)[] = emptyArray;
        const objs: Tagged[] = [];
        let value = runWithObjs(obj, objs);
        const callback = () => {
            const objs: Tagged[] = [];
            const nextValue = runWithObjs(obj, objs);

            if (shallowNotEqual(objs, lastObjs)) {
                lastCleanups.forEach(run);
                lastCleanups = objs.map((obj) => subscribeTo(obj, callback));
                lastObjs = objs;
            }

            if (nextValue !== value) {
                value = nextValue;
                func(value);
            }
        };

        lastCleanups = objs.map((obj) => subscribeTo(obj, callback));
        lastObjs = objs;

        return () => lastCleanups.forEach(run);
    }

    return subscribeTo(obj, () => func(globalVersions.get(obj) || obj));
};

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <Type>(subscribe: (callback: () => void) => () => void, getSnapshot: () => Type) => {
              const snapshot = getSnapshot();
              const [{ inst }, forceUpdate] = useState({ inst: { snapshot, getSnapshot } });

              useLayoutEffect(() => {
                  inst.getSnapshot = getSnapshot;
                  inst.snapshot = snapshot;
              }, [getSnapshot, inst, snapshot]);
              useEffect(() => {
                  if (inst.getSnapshot() !== inst.snapshot) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (inst.getSnapshot() !== inst.snapshot) {
                          forceUpdate({ inst });
                      }
                  });
              }, [inst, subscribe]);

              return snapshot;
          }
        : useSyncExternalStore;

interface UseTagged {
    <Type>(obj: Signal<Type> | (() => Type)): Type;
    <Type extends MutableObject>(obj: Type): MutableObject;
}

const useTagged: UseTagged = (obj: any): any => {
    const lastObjsRef = useRef<Tagged[]>(emptyArray);
    const lastCleanupsRef = useRef<(() => void)[]>(emptyArray);
    const callbackRef = useRef(noop);
    const subscribeRef = useRef((func: () => void) => {
        callbackRef.current = func;

        const callback = () => callbackRef.current();

        lastCleanupsRef.current = lastObjsRef.current.map((obj) => subscribeTo(obj, callback));

        return () => lastCleanupsRef.current.forEach(run);
    });

    return useSyncExternalStoreShim(subscribeRef.current, () => {
        const objs: Tagged[] = [];
        const value = runWithObjs(
            typeof obj === 'function' ? obj : () => globalVersions.get(mutable(obj)) || obj,
            objs
        );

        if (callbackRef.current !== noop && shallowNotEqual(objs, lastObjsRef.current)) {
            const callback = () => callbackRef.current();

            lastCleanupsRef.current.forEach(run);
            lastCleanupsRef.current = objs.map((obj) => subscribeTo(obj, callback));
        }

        lastObjsRef.current = objs;

        return value;
    });
};

export { mutable, mutated, Signal, createSignal, Event, createEvent, createEffect, subscribe, useTagged };
