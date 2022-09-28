import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { useRef } from 'react';

export interface Signal<T> {
    (): T;
    (updater: T | ((value: T) => T)): T;
}

export interface Computed<T> {
    (): T;
}

const EMPTY_VALUE = {};

let clock = 0;

let currentSubscriber: ComputedNode<any> | null = null;

let queue: SignalNode<any>[] | null = null;

let promise: Promise<void> | null = null;

export function sync(): void {
    if (!queue) {
        if (promise) {
            promise = null;
        }

        return;
    }

    for (let index = 0; index < queue.length; index++) {
        for (let node = queue[index].subscribersList; node; node = node.nextSubscriber) {
            node.subscriber.run();
        }
    }

    queue = null;

    if (promise) {
        promise = null;
    }
}

export function sample<T>(compute: () => T) {
    if (!currentSubscriber) {
        return compute();
    }

    const prevSubscriber = currentSubscriber;

    currentSubscriber = null;

    const value = compute();

    currentSubscriber = prevSubscriber;

    return value;
}

class RelationNode {
    version: number;
    signal: SignalNode<any>;
    subscriber: ComputedNode<any>;
    nextSignal: RelationNode | null;
    prevSignal: RelationNode | null;
    nextSubscriber: RelationNode | null;
    prevSubscriber: RelationNode | null;
    prevRelation: RelationNode | null;
    active: boolean;
    subscribed: boolean;

    constructor(signal: SignalNode<any>, subscriber: ComputedNode<any>) {
        this.version = signal.version;
        this.signal = signal;
        this.subscriber = subscriber;
        this.nextSignal = subscriber.signalsList;
        this.prevSignal = null;
        this.nextSubscriber = null;
        this.prevSubscriber = null;
        this.prevRelation = signal.relation;
        this.active = true;
        this.subscribed = false;
        signal.relation = this;
        subscriber.signalsList = this;

        if (this.nextSignal) {
            this.nextSignal.prevSignal = this;
        }

        if (subscriber.subscribersList !== null) {
            this.addToSignal();
        }
    }

    removeFromSubscriber(this: RelationNode) {
        if (this.prevSignal) {
            this.prevSignal.nextSignal = this.nextSignal;

            if (this.nextSignal) {
                this.nextSignal.prevSignal = this.prevSignal;
            }

            return;
        }

        this.subscriber.signalsList = this.nextSignal;

        if (this.nextSignal) {
            this.nextSignal.prevSignal = null;
        }
    }

    addToSignal() {
        if (this.subscribed) {
            return;
        }

        this.subscribed = true;
        this.nextSubscriber = this.signal.subscribersList!;
        this.signal.subscribersList = this;

        if (this.nextSubscriber) {
            this.nextSubscriber.prevSubscriber = this;
        } else {
            this.signal.subscribe();
        }
    }

    removeFromSignal() {
        if (!this.subscribed) {
            return;
        }

        this.subscribed = false;

        if (this.prevSubscriber) {
            this.prevSubscriber.nextSubscriber = this.nextSubscriber;

            if (this.nextSubscriber) {
                this.nextSubscriber.prevSubscriber = this.prevSubscriber;
            }

            return;
        }

        this.signal.subscribersList = this.nextSubscriber;

        if (this.nextSubscriber) {
            this.nextSubscriber.prevSubscriber = null;
        } else {
            this.signal.unsubscribe();
        }
    }
}

class SignalNode<T> {
    value: T;
    version: number;
    relation: RelationNode | null;
    subscribersList?: RelationNode | null;

    constructor(initialValue: T) {
        this.value = initialValue;
        this.version = 0;
        this.relation = null;
        this.subscribersList = null;
    }

    track() {
        if (!currentSubscriber) {
            return;
        }

        if (!this.relation || this.relation.subscriber !== currentSubscriber) {
            new RelationNode(this, currentSubscriber);

            return;
        }

        this.relation.active = true;
        this.relation.version = this.version;
    }

    notify() {
        if (!this.subscribersList) {
            return;
        }

        if (queue) {
            queue.push(this);
        } else {
            queue = [this];
        }

        if (promise) {
            return;
        }

        const nextPromise = Promise.resolve().then(() => {
            if (nextPromise === promise) {
                sync();
            }
        });

        promise = nextPromise;
    }

    subscribe() {}

    unsubscribe() {}

    recompute() {}

    call(...args: [] | [T | ((value: T) => T)]) {
        if (args.length) {
            const nextValue = typeof args[0] === 'function' ? (args[0] as (value: T) => T)(this.value) : args[0];

            if (nextValue !== this.value) {
                this.value = nextValue;
                this.version++;
                clock++;
                this.notify();
            }

            return this.value;
        }

        this.track();

        return this.value;
    }
}

class ComputedNode<T> extends SignalNode<T> {
    compute: () => T;
    clock: number;
    signalsList: RelationNode | null;
    children: ComputedNode<any>[] | null;

    constructor(compute: () => T) {
        super(EMPTY_VALUE as T);
        this.compute = compute;
        this.clock = -1;
        this.signalsList = null;
        this.children = null;

        if (!currentSubscriber) {
            return;
        }

        if (currentSubscriber.children) {
            currentSubscriber.children.push(this);

            return;
        }

        currentSubscriber.children = [this];
    }

    subscribe() {
        for (let node = this.signalsList; node; node = node.nextSignal) {
            node.addToSignal();
        }
    }

    cleanup() {
        if (!this.children) {
            return;
        }

        const length = this.children.length;

        for (let index = 0; index < length; index++) {
            this.children[index].unsubscribe();
        }

        this.children = null;
    }

    unsubscribe() {
        for (let node = this.signalsList; node; node = node.nextSignal) {
            node.removeFromSignal();
        }

        this.cleanup();
    }

    recompute(force?: boolean) {
        if (clock === this.clock) {
            return;
        }

        this.clock = clock;

        if (this.signalsList && !force) {
            let node = this.signalsList as RelationNode | null;

            for (; node; node = node.nextSignal) {
                if (node.version !== node.signal.version) {
                    break;
                }

                node.signal.recompute();

                if (node.version !== node.signal.version) {
                    break;
                }
            }

            if (!node) {
                return;
            }
        }

        this.cleanup();

        for (let node = this.signalsList; node; node = node.nextSignal) {
            node.active = false;
            node.prevRelation = node.signal.relation;
            node.signal.relation = node;
        }

        const prevSubscriber = currentSubscriber;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        currentSubscriber = this;

        const nextValue = this.compute();

        currentSubscriber = prevSubscriber;

        for (let node = this.signalsList; node; node = node.nextSignal) {
            if (node.active) {
                node.signal.relation = node.prevRelation;
                node.prevRelation = null;

                continue;
            }

            node.removeFromSubscriber();
            node.removeFromSignal();
        }

        if (nextValue !== this.value) {
            this.value = nextValue;
            this.version++;
            this.notify();
        }
    }

    run() {
        this.recompute(true);
    }

    call() {
        this.recompute();
        this.track();

        return this.value;
    }
}

class EffectNode extends ComputedNode<(() => void) | void> {
    constructor(compute: () => (() => void) | void) {
        super(compute);
        this.subscribersList = undefined;
        this.recompute(true);
    }

    notify() {}

    cleanup() {
        super.cleanup();

        if (typeof this.value === 'function') {
            this.value();
        }
    }
}

class SubscriptionNode<T> extends ComputedNode<T> {
    callback: (value: T) => void;

    constructor(compute: () => T, callback: (value: T) => void) {
        super(compute);
        this.subscribersList = undefined;
        this.callback = callback;
        this.recompute(true);
    }

    _notify() {
        this.callback(this.value);
    }

    notify() {
        this.notify = this._notify;
    }
}

class SyncExternalStoreNode<T> extends ComputedNode<T> {
    callback?: () => void;
    outdated: boolean;

    constructor(compute: () => T) {
        super(compute);
        this.outdated = true;
    }

    notify() {}

    run() {
        this.outdated = true;

        if (this.callback) {
            this.callback();
        }
    }

    storeSubscribe = (onStoreChange: () => void) => {
        this.subscribersList = undefined;
        this.callback = onStoreChange;
        this.subscribe();

        return this.unsubscribe.bind(this);
    };

    storeGetSnapshot = () => {
        this.recompute(this.outdated);
        this.outdated = false;

        return this.value;
    };
}

export function createSignal<T>(initialValue: T): Signal<T> {
    const signalNode = new SignalNode(initialValue);

    return signalNode.call.bind(signalNode);
}

export function createComputed<T>(compute: () => T): Computed<T> {
    const computedNode = new ComputedNode(compute);

    return computedNode.call.bind(computedNode);
}

export function createEffect(compute: () => (() => void) | void): () => void {
    const effectNode = new EffectNode(compute);

    return effectNode.unsubscribe.bind(effectNode);
}

export function createSubscription<T>(compute: () => T, callback: (value: T) => void): () => void {
    const subscriptionNode = new SubscriptionNode(compute, callback);

    return subscriptionNode.unsubscribe.bind(subscriptionNode);
}

export function useSelector<T>(selector: () => T): T {
    const syncExternalStoreNode = useRef<SyncExternalStoreNode<T> | null>(null);

    if (syncExternalStoreNode.current === null) {
        syncExternalStoreNode.current = new SyncExternalStoreNode(selector);
    } else if (syncExternalStoreNode.current.compute !== selector) {
        syncExternalStoreNode.current.compute = selector;
        syncExternalStoreNode.current.clock = -1;
        syncExternalStoreNode.current.outdated = true;
    }

    return useSyncExternalStore(
        syncExternalStoreNode.current.storeSubscribe,
        syncExternalStoreNode.current.storeGetSnapshot,
    );
}
