# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

⚛️ Experimental reactive and atomic state manager for React

Inspired by awesome [_solid-js_](https://www.solidjs.com/) and [_S.js_](https://github.com/adamhaile/S)

## Basic Usage

with signal

```javascript
import {
  createSignal,
  useMutable
} from 'react-tagged-state';

/* Create signal */
const counterSignal = createSignal(0);

const Counter = () => {
  /* Bind */
  useMutable(counterSignal);

  return (
    <button
      onClick={() => {
        /* Write */
        counterState((value) => value + 1);
      }}
    >
      {/* Read */}
      {counterState()}
    </button>
  );
};
```

or with mutable object

```javascript
import {
  useMutable,
  mutate
} from 'react-tagged-state';

/* Create mutable object */
const counterRef = { current: 0 };

const Counter = () => {
  /* Bind */
  useMutable(counterRef);

  return (
    <button
      onClick={() => {
        /* Write */
        mutate(
          (mark) =>
            (mark(counterRef).current += 1)
        );
      }}
    >
      {/* Read */}
      {counterRef.current}
    </button>
  );
};
```

## Short overview

You can create immutable signals by `createSignal`.<br>
Read value by `singal()` and write value by `signal(value)`.<br>
Bind signal by reading into `useComputed` and `runEffect` or directly via `useMutable`.

You can observe any mutable objects you want.<br>
Bind mutable object by marking via `mark` callback into `useComputed` and `runEffect` or directly via `useMutable`.<br>
Mutate object into `mutate` with marking via `mark` callback.

You can create events by `createEvent`.<br>
Dispatch payload by `event(payload)`.<br>

You can subscribe to `signal`, `event` or mutable object by `subscribe`.

You can batch writings, mutations and dispatches by `mutate`.

## Installation

```shell script
npm install --save react-tagged-state
```

## API Reference

- [createSignal](#createsignal)
- [signal](#signal)
- [createEvent](#createevent)
- [event](#event)
- [subscribe](#subscribe)
- [mutate](#mutate)
- [runEffect](#runeffect)
- [useMutable](#usemutable)
- [useComputed](#usecomputed)

### createSignal

```typescript
interface createSignal {
  <Type>(
    initialValue: Type | (() => Type)
  ): Signal<Type>;
}
```

This is a [signal](#signal) fabric.

```javascript
import { createSignal } from 'react-tagged-state';

let counterSignal;

/* Initialize with value */
counterSignal = createSignal(0);

/* Initialize with function */
counterSignal = createSignal(() => 0);
```

---

### signal

```typescript
interface Signal<Type> {
  (): Type;
  (updater: Type | ((value: Type) => Type)): void;
}
```

You can use it for read value and write value.

```javascript
import { createSignal } from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Read */
const counter = counterSignal();

/* Write with value */
counterSignal(1000);

/* Write with function */
counterSignal((counter) => counter + 1);

/* Subscribe */
const unsubscribe = subscribe(
  counterState,
  (counter) => console.log(counter)
);

/* Unsubscribe */
unsubscribe();
```

---

### createEvent

```typescript
interface createEvent {
  <Type = void>(): Event<Type>;
}
```

This is an [event](#event) fabric.

```javascript
import { createEvent } from 'react-tagged-state';

/* Create */
const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<Type> {
  (value: Type): void;
}
```

You can use it for dispatch payload.

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

/* Dispatch */
resetEvent();

/* Subscribe */
const unsubscribe = subscribe(resetEvent, () =>
  console.log('reset')
);

/* Unsubscribe */
unsubscribe();
```

---

### subscribe

```typescript
interface Subscribe {
  <Type>(
    event: Event<Type>,
    callback: (value: Type) => void
  ): () => void;
  <Type>(
    signal: Signal<Type>,
    callback: (value: Type) => void
  ): () => void;
  <Type>(
    obj: Type,
    callback: (value: Type) => void
  ): () => void;
}
```

It will call `callback` anytime when `obj` was mutated, `signal` was changed or `event` was dispatched.

```javascript
import {
  createSignal,
  createEvent
} from 'react-tagged-state';

const counterSignal = createSignal(0);

const resetEvent = createEvent();

const counterRef = { current: 0 };

let unsubscribe;

/* Subscribe to signal */
unsubscribe = subscribe(counterState, (counter) =>
  console.log(counter)
);

/* Unsubscribe */
unsubscribe();

/* Subscribe to event */
unsubscribe = subscribe(resetEvent, () =>
  console.log('reset')
);

/* Unsubscribe */
unsubscribe();

/* Subscribe to mutable object */
unsubscribe = subscribe(counterRef, () =>
  console.log(counterRef.current)
);

/* Unsubscribe */
unsubscribe();
```

---

### mutate

```typescript
interface mutate {
  <Type>(
    func: (
      mark: <Obj extends object>(obj: Obj) => Obj
    ) => Type
  ): Type;
}
```

You should mutate your observable mutable objects into this function.<br>
You can batch writings, mutations and dispatches by this function.

```javascript
import {
  useMutable,
  mutate
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Batch */
mutate((mark) => {
  /* Mark mutable object as mutated */
  mark(counterRef).current += 1;
});
```

---

### runEffect

```typescript
export interface runEffect {
  (
    func: (
      mark: <Type extends object>(
        obj: Type
      ) => Type
    ) => (() => void) | void
  ): () => void;
}
```

It will call `func` immediately and will re-call `func` anytime when some signals thus `func` reads were changed or marked mutable objects were mutated.<br>
You can return cleanup function from `func`. It will be called before next `func` call or cleanup.

```javascript
import {
  createSignal,
  runEffect
} from 'react-tagged-state';

const signal = createSignal(0);

const ref = { current: 0 };

/* Run */
const cleanup = runEffect((mark) => {
  /* Read singal */
  console.log(signal());
  /* Mark mutable object */
  console.log(mark(ref).current);

  /* Return cleanup function */
  return () => {
    console.log('cleanup');
  };
});

/* Cleanup */
cleanup();
```

---

### useMutable

```typescript
interface useObserver {
  <Type extends object>(obj: Type): Type;
}
```

This hook will re-render Component anytime when `obj` was mutated (or changed if `obj` is a signal).

```javascript
import {
  createSignal,
  useMutable
} from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Re-render Counter if counterSignal was changed */
const Counter = () => {
  /* Bind */
  useMutable(counterSignal);

  return (
    <button
      onClick={() => {
        counterSignal((value) => value + 1);
      }}
    >
      {counterSignal()}
    </button>
  );
};
```

---

### useComputed

```typescript
interface useComputed {
  <Type>(
    func: (
      mark: <Obj extends object>(obj: Obj) => Obj
    ) => Type
  ): Type;
}
```

It will call `func` immediately and will re-call `func` on each render and anytime when some signals thus `func` reads were changed or marked mutable objects were mutated.<br>
This hook will re-render component anytime when value that `func` returns was changed.<br>
Think about it like a useSelector from react-redux.

```javascript
import {
  createSignal,
  useComputed
} from 'react-tagged-state';

const usersSignal = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  /* ... */
});

/* Re-render UserCard if usersSignal()[userId].fullName was changed */
const UserCard = ({ userId }) => {
  /* Bind */
  const userFullName = useComputed(
    () => usersSignal()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
