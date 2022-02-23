# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

WIP

⚛️ Experimental reactive and atomic state manager for React.

Inspired by awesome [_solid-js_](https://www.solidjs.com/) and [_S.js_](https://github.com/adamhaile/S).

## Basic Usage

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

/* Create signal */
const counterSignal = createSignal(0);

const Counter = () => {
  /* Bind */
  const counter = useTagged(counterSignal);

  return (
    <button
      onClick={() => {
        /* Write */
        counterState((value) => value + 1);
      }}
    >
      {counter}
    </button>
  );
};
```

## Installation

```shell script
npm install --save react-tagged-state
```

## API Reference

- [mutable](#mutable)
- [mutated](#mutated)
- [getVersion](#getversion)
- [createSignal](#createsignal)
- [signal](#signal)
- [createEvent](#createevent)
- [event](#event)
- [createComputed](#createcomputed)
- [computed](#computed)
- [subscribe](#subscribe)
- [useTagged](#usetagged)
- [createEffect](#createeffect)

### mutable

```typescript
interface mutable {
  <T extends MutableObject>(mutableObject: T): T;
}
```

This is a getter for mutable objects.<br>
It will add specified mutable object to the deps of [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe).

```javascript
import {
  mutable,
  useTagged
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Inside createEffect */
createEffect(() => {
  /* Read mutable object */
  console.log(mutable(counterRef).current);
});

const Counter = () => {
  /* Inside useTagged */
  const counter = useTagged(() => {
    /* Read mutable object */
    return mutable(counterRef).current;
  });

  return <div>{counter}</div>;
};

/* Inside subscribe */
subscribe(
  () => {
    /* Read mutable object */
    return mutable(counterRef).current;
  },
  (counter) => {
    console.log(counter);
  }
);
```

---

### mutated

```typescript
interface mutated {
  <T extends MutableObject>(mutableObject: T): T;
}
```

This is a setter for mutable object.<br>
It will trigger related [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe) for specified mutable object.

```javascript
import {
  mutated,
  useTagged
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Mutate */
counterRef.current += 1;

/* Write mutable object */
mutated(counterRef);
```

---

### getVersion

```typescript
interface getVersion {
  <T extends MutableObject>(
    mutableObject: T
  ): MutableObject;
}
```

This is a getter for mutable object version.<br>
Version will be changed for mutable object when you call [`mutated`](#mutated) with this mutable object.

```javascript
import {
  mutated,
  getVersion
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Get mutable object version */
const firstVerson = getVersion(counterRef);

/* The same version */
const secondVersion = getVersion(counterRef);

/* Write mutable object */
mutated(counterRef);

/* The new version */
const thirdVersion = getVersion(counterRef);
```

---

### createSignal

```typescript
interface CreateSignal {
  <T>(value: T): Signal<T>;
  <T>(selector: () => T): Signal<T>;
}
```

This is a [signal](#signal) factory.

```javascript
import { createSignal } from 'react-tagged-state';

let counterSignal;

/* Initialize with value */
counterSignal = createSignal(0);

/* Initialize with selector */
counterSignal = createSignal(() => 0);
```

---

### signal

```typescript
interface Signal<T> {
  (): T;
  (value: T): T;
  (updater: (value: T) => T): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

This function is a value container.<br>
Reading it will add signal to the deps of [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe).<br>
Writing it will trigger related [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe).

```javascript
import { createSignal } from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Read */
const counter = counterSignal();

/* Write with value */
counterSignal(1000);

/* Write with function */
counterSignal((counter) => counter + 1);
```

---

### createEvent

```typescript
interface createEvent {
  <T = void>(): Event<T>;
}
```

This is an [event](#event) factory.

```javascript
import { createEvent } from 'react-tagged-state';

/* Create */
const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<T = void> {
  (payload: T): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

This function is an event dispatcher.<br>
Dispatching it will trigger related [`subscribe`](#subscribe).

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

/* Dispatch */
resetEvent();
```

---

### createComputed

```typescript
interface createComputed {
  <T>(selector: () => T): Computed<T>;
}
```

This is a [computed](#computed) factory.

```javascript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Initialize */
const computed = createComputed(() =>
  Math.floor(counterSignal() / 10)
);
```

---

### computed

```typescript
interface Computed<T = void> {
  (): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
  readonly compute: () => void;
  readonly cleanup: () => void;
}
```

This function is a computed value container.<br>
Reading it will add computed to the deps of [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe).<br>
Related [`useTagged`](#usetagged), [`createEffect`](#createeffect) or [`subscribe`](#subscribe) will be triggered if computed value was changed.

```javascript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counterSignal = createSignal(0);

const computed = createComputed(() =>
  Math.floor(counterSignal() / 10)
);

/* Read */
const value = computed();
```

---

### subscribe

```typescript
interface Subscribe {
  <T extends MutableObject>(
    mutableObject: T,
    callback: (version: MutableObject) => void
  ): () => void;
  <T>(
    signal: Signal<T>,
    callback: (value: T) => void
  ): () => void;
  <T>(
    event: Event<T>,
    callback: (value: T) => void
  ): () => void;
  <T>(
    computed: Computed<T>,
    callback: (value: T) => void
  ): () => void;
  <T>(
    selector: () => T,
    callback: (value: T) => void
  ): () => void;
}
```

This function subscribe to mutable object, signal, event, computed or selector<br>
`callback` will be called anytime when deps were updated.<br>

```javascript
import {
  createSignal,
  createEvent,
  createComputed,
  subscribe
} from 'react-tagged-state';

const counterSignal = createSignal(0);

const resetEvent = createEvent();

const computed = createComputed(() =>
  Math.floor(counterSignal() / 10)
);

const counterRef = { current: 0 };

let unsubscribe;

/* Subscribe to signal */
unsubscribe = subscribe(
  counterState,
  (counter) => {
    console.log(counter);
  }
);

/* Subscribe to event */
unsubscribe = subscribe(resetEvent, () => {
  console.log('reset');
});

/* Subscribe to computed */
unsubscribe = subscribe(computed, (value) => {
  console.log(value);
});

/* Subscribe to mutable object */
unsubscribe = subscribe(counterRef, () => {
  console.log(counterRef.current);
});

/* Subscribe to selector */
unsubscribe = subscribe(
  () => Math.floor(counterSignal() / 10),
  (computed) => {
    console.log(computed);
  }
);

/* Unsubscribe */
unsubscribe();
```

---

### createEffect

```typescript
interface CreateEffect {
  (func: () => void): () => void;
  (func: () => () => void): () => void;
}
```

`func` will be called immediately and anytime when deps were updated.<br>
You can return function from `func`. It will be called before next `func` or cleanup call.

```javascript
import {
  mutable,
  createSignal,
  createComputed,
  createEffect
} from 'react-tagged-state';

const signal = createSignal(0);

const computed = createComputed(() =>
  Math.floor(signal() / 10)
);

const ref = { current: 0 };

/* Run */
const cleanup = createEffect(() => {
  /* Read singal */
  console.log(signal());
  /* Read computed */
  console.log(computed());
  /* Read mutable object */
  console.log(mutable(ref).current);

  /* Will be called before next `func` or cleanup call */
  return () => {
    console.log('cleanup');
  };
});

/* Cleanup */
cleanup();
```

---

### useTagged

```typescript
interface UseTagged {
  <T extends MutableObject>(
    mutableObject: T
  ): MutableObject;
  <T>(signal: Signal<T>): T;
  <T>(computed: Computed<T>): T;
  <T>(
    selector: () => T,
    deps?: DependencyList
  ): T;
}
```

This hook will re-render Component anytime when deps were updated.

With signal:

Hook returns signal value.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Re-render Counter if counterSignal was changed */
const Counter = () => {
  /* Bind */
  const counter = useTagged(counterSignal);

  return <div>{counter}</div>;
};
```

With computed:

Hook returns computed value.

```javascript
import {
  createSignal,
  createComputed,
  useTagged
} from 'react-tagged-state';

const counterSignal = createSignal(0);

const computed = createComputed(() =>
  Math.floor(signal() / 10)
);

/* Re-render Counter if computed was changed */
const Counter = () => {
  /* Bind */
  const value = useTagged(computed);

  return <div>{value}</div>;
};
```

With mutable object:

Hook returns mutable object version.

```javascript
import { useTagged } from 'react-tagged-state';

/* Create mutable object */
const counterRef = { current: 0 };

/* Re-render Counter if counterRef was mutated */
const Counter = () => {
  /* Bind */
  useTagged(counterRef);

  return <div>{counterRef.current}</div>;
};
```

With selector:

Hook returns selected value.<br>

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const usersSignal = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  /* ... */
});

/* Re-render UserCard if usersSignal()[userId].fullName was changed */
const UserCard = ({ userId }) => {
  /* Bind */
  const userFullName = useTagged(
    () => usersSignal()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).

## Concurrent Mode

I suppose you can safely use this library in Concurrent Mode because it uses `useSyncExternalStore` under the hood.
