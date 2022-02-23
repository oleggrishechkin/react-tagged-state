// @ts-expect-error Module '"react"' has no exported member 'useSyncExternalStore'
import { useEffect, useLayoutEffect, useSyncExternalStore, useState, DependencyList, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

type MutableObject = Record<any, any> | any[] | Set<any> | Map<any, any> | WeakSet<any> | WeakMap<any, any>;

interface Signal<T> {
    (): T;
    (value: T): T;
    (updater: (value: T) => T): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface Event<T = void> {
    (payload: T): T;
    readonly on: (callback: (value: T) => void) => () => void;
}

interface Computed<T = void> {
    (): T;
    readonly on: (callback: (value: T) => void) => () => void;
    readonly compute: () => void;
    readonly cleanup: () => void;
}

type Tagged = MutableObject | Signal<any> | Event<any> | Computed<any>;

const run = <T>(func: () => T) => func();

const globalSubscribers = new WeakMap<Tagged, Set<() => void>>();

const globalVersions = new WeakMap<Tagged, MutableObject>();

let globalObjs: Tagged[] | null = null;

let globalObjsSet: Set<Tagged> | null = null;

const runWithObjs = <T>(func: () => T, objs: typeof globalObjs) => {
    const tmp = globalObjs;

    globalObjs = objs;

    const value = func();

    globalObjs = tmp;

    return value;
};

const subscribeToObj = (obj: Tagged, callback: () => void) => {
    let subscribers = globalSubscribers.get(obj);

    if (subscribers) {
        subscribers.add(callback);
    } else {
        subscribers = new Set([callback]);
        globalSubscribers.set(obj, subscribers);

        if ('compute' in obj) {
            obj.compute();
        }
    }

    return () => {
        if (subscribers!.size === 1) {
            globalSubscribers.delete(obj);

            if (typeof obj === 'object') {
                globalVersions.delete(obj);

                return;
            }

            if ('cleanup' in obj) {
                obj.cleanup();
            }

            return;
        }

        subscribers!.delete(callback);
    };
};

const read = (obj: Tagged) => {
    if (globalObjs) {
        globalObjs.push(obj);
    }
};

const write = (obj: Tagged) => {
    if (globalSubscribers.has(obj)) {
        if (globalObjsSet) {
            globalObjsSet.add(obj);

            return;
        }

        globalObjsSet = new Set([obj]);
        Promise.resolve().then(() => {
            const objsSet = globalObjsSet!;

            globalObjsSet = null;
            unstable_batchedUpdates(() => {
                const batchedSubscribers = new Set<() => void>();

                objsSet.forEach((obj) => {
                    const subscribers = globalSubscribers.get(obj);

                    if (subscribers) {
                        subscribers.forEach((subscriber) => {
                            batchedSubscribers.add(subscriber);
                        });
                    }
                });
                batchedSubscribers.forEach(run);
            });
        });
    }
};

const mutable = <T extends MutableObject>(mutableObject: T): T => {
    read(mutableObject);

    return mutableObject;
};

const mutated = <T extends MutableObject>(mutableObject: T): T => {
    if (globalSubscribers.get(mutableObject)) {
        globalVersions.set(mutableObject, {});
    }

    write(mutableObject);

    return mutableObject;
};

const getVersion = <T extends MutableObject>(mutableObject: T): MutableObject =>
    globalVersions.get(mutableObject) || mutableObject;

interface CreateSignal {
    <T>(value: T): Signal<T>;
    <T>(selector: () => T): Signal<T>;
}

const createSignal: CreateSignal = <T>(initializer: T | (() => T)) => {
    let value = typeof initializer === 'function' ? (initializer as () => T)() : initializer;
    const signal: Signal<T> = Object.assign(
        (...args: any[]) => {
            if (args.length) {
                const nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

                if (nextValue !== value) {
                    value = nextValue;
                    write(signal);
                }
            } else {
                read(signal);
            }

            return value;
        },
        {
            on: (callback: (value: T) => void) => subscribeToObj(signal, () => callback(value))
        }
    );

    return signal;
};

const createEvent = <T = void>(): Event<T> => {
    let value: T;
    const event: Event<T> = Object.assign(
        (payload: T) => {
            value = payload;
            write(event);

            return payload;
        },
        {
            on: (callback: (value: T) => void) => subscribeToObj(event, () => callback(value))
        }
    );

    return event;
};

const shallowNotEqual = <T extends any[]>(prev: T, next: T) =>
    next.length !== prev.length || next.some((item, index) => item !== prev[index]);

const createComputed = <T>(selector: () => T): Computed<T> => {
    let lastObjs: Tagged[] = [];
    let lastCleanups: (() => void)[] = [];
    let value: T | void;
    const computed: Computed<T> = Object.assign(
        () => {
            computed.compute();
            read(computed);

            return value as T;
        },
        {
            on: (callback: (value: T) => void) => subscribeToObj(computed, () => callback(value as T)),
            compute: () => {
                if (lastCleanups.length) {
                    return;
                }

                value = runWithObjs(selector, lastObjs);

                const callback = () => {
                    if (globalSubscribers.has(computed)) {
                        const objs: Tagged[] = [];
                        const nextValue = runWithObjs(selector, objs);

                        if (shallowNotEqual(lastObjs, objs)) {
                            lastObjs = objs;
                            lastCleanups.forEach(run);
                            lastCleanups = lastObjs.map((obj) => subscribeToObj(obj, callback));
                        }

                        if (nextValue !== value) {
                            value = nextValue;
                            write(computed);
                        }

                        return;
                    }

                    computed.cleanup();
                };

                lastCleanups = lastObjs.map((obj) => subscribeToObj(obj, callback));
            },
            cleanup: () => {
                if (lastCleanups.length) {
                    lastObjs = [];
                    lastCleanups.forEach(run);
                    lastCleanups = [];
                    value = void 0;
                }
            }
        }
    );

    return computed;
};

interface CreateEffect {
    (func: () => void): () => void;
    (func: () => () => void): () => void;
}

const createEffect: CreateEffect = (func: () => void | (() => void)) => {
    let lastObjs: Tagged[] = [];
    let lastCleanups: (() => void)[] = [];
    let value = runWithObjs(func, lastObjs);
    const callback = () => {
        if (typeof value === 'function') {
            value();
        }

        const objs: Tagged[] = [];

        value = runWithObjs(func, objs);

        if (shallowNotEqual(lastObjs, objs)) {
            lastObjs = objs;
            lastCleanups.forEach(run);
            lastCleanups = lastObjs.map((obj) => subscribeToObj(obj, callback));
        }
    };

    lastCleanups = lastObjs.map((obj) => subscribeToObj(obj, callback));

    return () => {
        if (typeof value === 'function') {
            value();
        }

        lastCleanups.forEach(run);
    };
};

interface Subscribe {
    <T extends MutableObject>(mutableObject: T, callback: (version: MutableObject) => void): () => void;
    <T>(signal: Signal<T>, callback: (value: T) => void): () => void;
    <T>(event: Event<T>, callback: (value: T) => void): () => void;
    <T>(computed: Computed<T>, callback: (value: T) => void): () => void;
    <T>(selector: () => T, callback: (value: T) => void): () => void;
}

const subscribe: Subscribe = (obj: Tagged | (() => any), callback: (value: any) => void) => {
    if (typeof obj === 'object') {
        return subscribeToObj(obj, () => callback(getVersion(obj)));
    }

    if ('on' in obj) {
        return obj.on(callback);
    }

    return createComputed(obj).on(callback);
};

const checkIfSnapshotChanged = <T>(inst: { getSnapshot: () => T; value: T }) => {
    try {
        return inst.value !== inst.getSnapshot();
    } catch (error) {
        return true;
    }
};

const useSyncExternalStoreShim =
    typeof useSyncExternalStore === 'undefined'
        ? <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T) => {
              const value = getSnapshot();
              const [{ inst }, forceUpdate] = useState({ inst: { value, getSnapshot } });

              useLayoutEffect(() => {
                  inst.value = value;
                  inst.getSnapshot = getSnapshot;

                  if (checkIfSnapshotChanged(inst)) {
                      forceUpdate({ inst });
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [subscribe, value, getSnapshot]);
              useEffect(() => {
                  if (checkIfSnapshotChanged(inst)) {
                      forceUpdate({ inst });
                  }

                  return subscribe(() => {
                      if (checkIfSnapshotChanged(inst)) {
                          forceUpdate({ inst });
                      }
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [subscribe]);

              return value;
          }
        : useSyncExternalStore;

interface UseTagged {
    <T extends MutableObject>(mutableObject: T): MutableObject;
    <T>(signal: Signal<T>): T;
    <T>(computed: Computed<T>): T;
    <T>(selector: () => T, deps?: DependencyList): T;
}

const useTagged: UseTagged = (obj: MutableObject | Signal<any> | Computed<any> | (() => any), deps?: DependencyList) =>
    useSyncExternalStoreShim(
        ...useMemo(() => {
            if (typeof obj === 'object') {
                return [(func: () => void) => subscribeToObj(obj, func), () => getVersion(obj)];
            }

            if ('on' in obj) {
                return [(func: () => void) => obj.on(func), obj];
            }

            const computed = createComputed(obj);

            return [(func: () => void) => computed.on(func), computed];
        }, deps || [obj])
    );

export {
    Signal,
    Event,
    Computed,
    mutable,
    mutated,
    getVersion,
    createSignal,
    createEvent,
    createComputed,
    createEffect,
    subscribe,
    useTagged
};
