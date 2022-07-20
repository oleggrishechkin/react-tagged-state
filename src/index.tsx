import React, { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from 'react';

const PROVIDER_NOT_FOUND_ERROR_MESSAGE = '[react-tagged-state] Provider not found.';

export type Updater<T> = T | ((value: T) => T);

class Store<T> {
    private _state: T;
    private _subscribers: Set<() => void>;
    boundSubscribe: (callback: () => void) => () => void;

    constructor(initialState: T) {
        this._state = initialState;
        this._subscribers = new Set();
        this.boundSubscribe = this.subscribe.bind(this);
    }

    getState<K>(proxyPath: K): K {
        const pathString = `${proxyPath}`;
        const path = pathString.split('.');

        let value: any;

        if (pathString) {
            for (let index = 0; index < path.length && value; index++) {
                value = value[path[index]];
            }
        } else {
            value = this._state;
        }

        return value;
    }

    setState<K>(proxyPath: K, updater: Updater<K>) {
        const currentValue = this.getState(proxyPath);
        const nextValue = typeof updater === 'function' ? (updater as (value: K) => K)(currentValue) : updater;

        if (currentValue === nextValue) {
            return;
        }

        const pathString = `${proxyPath}`;
        const path = pathString.split('.');
        let nextState: any;

        if (pathString) {
            nextState = Array.isArray(this._state) ? [...this._state] : { ...this._state };

            let value = nextState;

            for (let index = 0; index < path.length - 1; index++) {
                value = value[path[index]] = value
                    ? Array.isArray(value[path[index]])
                        ? [...value[path[index]]]
                        : { ...value[path[index]] }
                    : isNaN(+path[index + 1])
                    ? {}
                    : [];
            }

            value[path[path.length - 1]] = nextValue;
        } else {
            nextState = nextValue;
        }

        this._state = nextState;

        for (const subscriber of this._subscribers) {
            subscriber();
        }
    }

    subscribe(callback: () => void) {
        this._subscribers.add(callback);

        return () => {
            this._subscribers.delete(callback);
        };
    }
}

const PATH_SYMBOL = Symbol('path');

type PathProxy = { [PATH_SYMBOL]: string };

const pathProxyHandler: ProxyHandler<PathProxy> = {
    get(target, prop) {
        if (prop === PATH_SYMBOL || prop === Symbol.toPrimitive || prop === 'toString') {
            return target[PATH_SYMBOL];
        }

        if (typeof prop === 'symbol') {
            return (target as any)[prop];
        }

        return new Proxy(
            {
                [PATH_SYMBOL]: target[PATH_SYMBOL] ? `${target[PATH_SYMBOL]}.${prop}` : prop,
            },
            pathProxyHandler,
        );
    },
};

const createStore = <T extends Record<string, any>>(initialState: T) => {
    const pathProxy: T = new Proxy({ [PATH_SYMBOL]: '' }, pathProxyHandler) as any;
    const StoreContext = createContext<Store<T> | null>(null);
    const Provider = ({
        state,
        merge,
        children,
    }: {
        state?: T;
        merge?: (prevState: T, nextState?: T) => T;
        children: ReactNode;
    }) => {
        const storeRef = useRef<Store<T> | null>(null);
        const store = useMemo(() => {
            if (storeRef.current === null) {
                storeRef.current = new Store<T>(state || initialState);
            } else {
                storeRef.current.setState(pathProxy, (prevState) =>
                    merge ? merge(prevState, state) : { ...prevState, ...state },
                );
            }

            return storeRef.current;
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [state]);

        return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
    };
    const useStore = <K, R = K>(pathProxy: K, selector?: (state: K) => R) => {
        const store = useContext(StoreContext);
        const pathString = `${pathProxy}`;

        if (!store) {
            throw new Error(PROVIDER_NOT_FOUND_ERROR_MESSAGE);
        }

        return [
            useSyncExternalStore(
                store.boundSubscribe,
                useMemo<() => R>(() => {
                    if (selector) {
                        let value: K;
                        let selected: R;

                        return () => {
                            const nextValue = store.getState(pathProxy);

                            if (nextValue !== value) {
                                selected = selector((value = nextValue));
                            }

                            return selected;
                        };
                    }

                    return () => store.getState(pathProxy) as any;
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [pathString, selector]),
            ),
            useCallback(
                (updater: Updater<K>) => {
                    store.setState(pathProxy, updater);
                },
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [pathString, store],
            ),
        ] as const;
    };

    return [pathProxy as T, Provider, useStore] as const;
};

export { createStore };
