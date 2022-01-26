/* eslint-disable @typescript-eslint/ban-types */
import { useEffect, useReducer } from 'react';

type Tagged = MutableObject | Signal<any> | Event<any>;

const run = <Type>(func: () => Type) => func();

const INTERNAL_SUBSCRIBE = Symbol();

const globalSubscribers = new WeakMap<Tagged, Set<() => void>>();

const globalVersions = new WeakMap<Tagged, object>();

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
        subscribers!.delete(callback);
    };
};

const batch = <Type>(func: () => Type) => {
    if (globalObjsSet) {
        return runWithObjs(func, null);
    }

    const objsSet = new Set<Tagged>();

    globalObjsSet = objsSet;

    const value = runWithObjs(func, null);

    globalObjsSet = null;

    if (objsSet.size) {
        batch(() => {
            const uniqueSubscribers = new Set<() => void>();

            objsSet.forEach((obj) => {
                const subscribers = globalSubscribers.get(obj);

                if (subscribers) {
                    subscribers.forEach((subscriber) => uniqueSubscribers.add(subscriber));
                }
            });
            uniqueSubscribers.forEach(run);
        });
    }

    return value;
};

const read = <Type extends Tagged>(obj: Type) => {
    if (globalObjs) {
        globalObjs.push(obj);
    }
};

const write = <Type extends Tagged>(obj: Type) =>
    batch(() => {
        if (globalObjsSet) {
            globalObjsSet.add(obj);
        }
    });

type MutableObject = Record<any, any> | any[] | Set<any> | Map<any, any> | WeakSet<any> | WeakMap<any, any>;

const mutable = <Type extends MutableObject>(obj: Type) => {
    read(obj);

    return obj;
};

const mutated = <Type extends MutableObject>(obj: Type) => {
    globalVersions.set(obj, {});
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

const createEffect = (func: () => void | (() => void)) => {
    let lastObjs: Tagged[] = [];
    let lastCleanups: (() => void)[] = [];
    let value: ReturnType<typeof func>;
    const callback = () => {
        if (typeof value === 'function') {
            value();
        }

        const objs: Tagged[] = [];

        value = runWithObjs(func, objs);

        if (objs.length !== lastObjs.length || objs.some((item, index) => item !== lastObjs[index])) {
            lastCleanups.forEach(run);
            lastCleanups = objs.map((obj) => subscribeTo(obj, callback));
            lastObjs = objs;
        }
    };

    callback();

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

const subscribe: Subscribe = (obj: any, callback: (value: any) => void) => {
    if (INTERNAL_SUBSCRIBE in obj) {
        return obj[INTERNAL_SUBSCRIBE](callback);
    }

    if (typeof obj === 'function') {
        let value: any;
        const inst = {
            callback: () => {
                value = obj();
                inst.callback = () => {
                    const nextValue = obj();

                    if (nextValue !== value) {
                        value = obj();
                        callback(value);
                    }
                };
            }
        };

        return createEffect(() => inst.callback());
    }

    return subscribeTo(obj, () => callback(obj));
};

const taggedInit = () => ({ inst: {} as { getSnapshot: () => any; snapshot: any } });

const taggedReducer = ({ inst }: ReturnType<typeof taggedInit>) => ({ inst });

interface UseTagged {
    <Type>(obj: Signal<Type> | (() => Type)): Type;
    <Type extends MutableObject>(obj: Type): object;
}

const useTagged: UseTagged = (obj: any): any => {
    const [{ inst }, forceUpdate] = useReducer(taggedReducer, null, taggedInit);
    const objs: Tagged[] = [];

    inst.getSnapshot = typeof obj === 'function' ? obj : () => globalVersions.get(mutable(obj)) || obj;
    inst.snapshot = runWithObjs(inst.getSnapshot, objs);

    useEffect(
        () =>
            createEffect(() => {
                if (inst.getSnapshot() !== inst.snapshot) {
                    forceUpdate();
                }
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        objs
    );

    return inst.snapshot;
};

export { batch, mutable, mutated, Signal, createSignal, Event, createEvent, createEffect, subscribe, useTagged };
