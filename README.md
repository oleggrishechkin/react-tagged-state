# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

WIP

⚛️ Experimental reactive and atomic state manager for _React_.

Inspired by awesome [_solid-js_](https://www.solidjs.com/) and [_S.js_](https://github.com/adamhaile/S).

## Basic Usage

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useTagged(counter);

  return (
    <button
      onClick={() =>
        counter((value) => value + 1)
      }
    >
      {count}
    </button>
  );
};
```

## Getting Started

### Installation

First you need to install _react-tagged-state_.

```shell script
npm install --save react-tagged-state
```

Now you can import anything you want from it.<br>

### Creating a signal

The base part of _react-tagged-state_ is a signal. It's a simple value container (atom/state). Keep signals as small as possible. Signal is just a function for value read and write.

For creating a signal you should call [`createSignal`](#createsignal) with initial value.<br>

```typescript
import { createSignal } from 'react-tagged-state';

// Create
const counter = createSignal(0);
```

### Using a signal

For read a signal value you should call signal without arguments.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// Read
counter(); // 0
```

For write a signal value you should call signal with value argument.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter(); // 0

// Write
counter(1);

counter(); // 1
```

You can subscribe to signal writes.<br>
Sync signal value with storages, log updates or integrate _redux-devtools_ - it's just a simple subscription.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// Subscribe
counter.on((count) => console.log(count));
```

### Using a signal in a component

You can bind your component with signal with [`useTagged`](#usetagged).<br>
Component will be re-rendered when you write a signal value.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  // Read and bind
  const count = useTagged(counter);

  return <div>{count}</div>;
};
```

You can use selector inside [`useTagged`](#usetagged).<br>
Component will be re-rendered when selected value was changed.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  // Read and bind
  const roundedCount = useTagged(() =>
    Math.floor(counter() / 10)
  );

  return <div>{roundedCount}</div>;
};
```

Also, you can use props inside selector:

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const users = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  // ...
});

const UserCard = ({ userId }) => {
  // Read and bind
  const userFullName = useTagged(
    () => users()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

### Creating an event

Event is just a function too. It's an event dispatcher.<br>
Events can help you with signal encapsulation. It's like an actions in _redux_.

For creating an event you should call [`createEvent`](#createevent).

```typescript
import { createEvent } from 'react-tagged-state';

// Create
const resetEvent = createEvent();

// Subscribe
resetEvent.on(() => console.log('reset'));
```

### Using an event

With events, you can do this:

```typescript
// signals/counter.ts

import { resetEvent } from '../events/resetEvent';

// Create
const counter = createSignal(0);

// Subscribe
resetEvent.on(() => counter(0));

export { counter };
```

```typescript
// signals/users.ts

import { resetEvent } from '../events/resetEvent';

// Create
const users = createSignal({});

// Subscribe
resetEvent.on(() => users({}));

export { users };
```

instead of this:

```typescript
import { counter } from '../signals/counter';
import { users } from '../signals/users';

const reset = () => {
  counter(0);
  users({});
};
```

## Advanced

### Creating a computed

For creating a computed you should call [`createComputed`](#createcomputed) with selector.<br>

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(0);

// Creating
const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);
```

### Using a computed

For reading a computed value you should call computed without arguments.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(20);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

// Read
roundedCounter(); // 2
```

You can't write a computed value. Anytime when you write a related signal value a computed value will be recomputed.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(20);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

roundedCounter(); // 2

// Write a related signal
counter(40);

roundedCounter(); // 4
```

You can use computed in [`useTagged`](#usetagged) as well as signal.

### Initialize a signal with function

You can initialize a signal with function.<br>

```typescript
import { createSignal } from 'react-tagged-state';

// Create with function
const counter = createSignal(() => 0);
```

### Write a signal value with function

You can write a signal value with function.<br>

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// Write with function
counter((count) => count + 1);
```

## API Reference

- [createSignal](#createsignal)
- [signal](#signal)
- [createEvent](#createevent)
- [event](#event)
- [createComputed](#createcomputed)
- [computed](#computed)
- [createEffect](#createeffect)
- [useTagged](#usetagged)

### createSignal

```typescript
interface CreateSignal {
  <T>(value: T): Signal<T>;
  <T>(selector: () => T): Signal<T>;
}
```

This is a [signal](#signal) factory.

```typescript
import { createSignal } from 'react-tagged-state';

let counter;

counter = createSignal(0);

counter = createSignal(() => 0);
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
Reading it will add signal to the deps of [`useTagged`](#usetagged), [`createComputed`](#createcomputed) or [`createEffect`](#createeffect).<br>
Related [`useTagged`](#usetagged), [`computed`](#computed) or [`createEffect`](#createeffect) will be triggered if signal value was changed.<br>
You can subscribe to signal by `on`.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

const count = counter();

counter(1000);

counter((count) => count + 1);

counter.on((count) => console.log(count));
```

---

### createEvent

```typescript
interface createEvent {
  <T = void>(): Event<T>;
}
```

This is an [event](#event) factory.

```typescript
import { createEvent } from 'react-tagged-state';

/* Create */
const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<T = void> {
  (payload: T): T;
  readonly __callbacks: Set<(payload: T) => void>;
  readonly on: (
    callback: (payload: T) => void
  ) => () => void;
}
```

This function is an event dispatcher.<br>
You can subscribe to event by `on`.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent();

resetEvent.on(() => console.log('reset'));
```

---

### createComputed

```typescript
interface createComputed {
  <T>(selector: () => T): Computed<T>;
}
```

This is a [computed](#computed) factory.

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

roundedCounter.on((roundedCount) =>
  console.log(roundedCount)
);
```

---

### computed

```typescript
interface Computed<T> {
  (): T;
  value: T | void;
  __sub: Sub | null;
  readonly __subs: Set<Sub>;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

This function is a computed value container.<br>
Reading it will add computed to the deps of [`useTagged`](#usetagged), [`createComputed`](#createcomputed) or [`createEffect`](#createeffect).<br>
Related [`useTagged`](#usetagged), [`computed`](#computed) or [`createEffect`](#createeffect) will be triggered if computed value was changed.<br>
You can subscribe to computed by `on`.<br>
Nested computed is allowed.

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const roundedCount = roundedCounter();
```

---

### createEffect

```typescript
interface CreateEffect {
  (func: () => void): () => void;
  (func: () => () => void): () => void;
}
```

`func` will be called immediately and anytime when deps were changed.<br>
You can return function from `func`. It will be called before next `func` or cleanup call.

```typescript
import {
  createSignal,
  createComputed,
  createEffect
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const cleanup = createEffect(() => {
  console.log(counter());
  console.log(roundedCounter());

  return () => {
    console.log('cleanup');
  };
});

cleanup();
```

---

### useTagged

```typescript
interface UseTagged {
  <T>(signal: Signal<T>): T;
  <T>(computed: Computed<T>): T;
  <T>(selector: () => T): T;
}
```

This hook will re-render Component anytime when deps were changed.

With signal:<br>
Hook returns signal value.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useTagged(counter);

  return <div>{count}</div>;
};
```

With computed:<br>
Hook returns computed value.

```javascript
import {
  createSignal,
  createComputed,
  useTagged
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const Counter = () => {
  const roundedCount = useTagged(roundedCounter);

  return <div>{roundedCount}</div>;
};
```

With selector:<br>
Hook returns selected value.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const users = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  // ...
});

const UserCard = ({ userId }) => {
  const userFullName = useTagged(
    () => users()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

## Performance

It's written to be fast. Batch all updates. Notify exactly affected subscribers. Re-render only if needed.<br>
See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
