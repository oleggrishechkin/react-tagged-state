# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)

⚛️ Experimental reactive and atomic state manager

**React Tagged State** uses the same reactivity pattern as [SolidJS](https://www.solidjs.com/) and [S.js](https://github.com/adamhaile/S) but optimized for usage with React.

- Updates batched automatically.
- Affected subscribers called only once per batch.
- Lazy computed.

## Basic Usage

```typescript jsx
import {
  createSignal,
  useSelector
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSelector(counter);

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

## Introduction

Base part of React Tagged State is a signals and effects.<br>
Signal is a value container. It can read and write value.<br>
Effect is an observer. It automatically tracks what signals was read inside it and call self anytime when any of these signals changed.

```typescript jsx
import {
  createSignal,
  createEffect
} from 'react-tagged-state';

const initialValue = 0;

const counter = createSignal(initialValue);

createEffect(() => {
  console.log('counter changed: ', counter());
});

counter(10); // counter changed: 10

counter((count) => count + 1); // counter changed: 11

counter(initialValue); // counter changed: 0
```

## API Overview

### Signals

Create a signal by calling `createSignal` with initial value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

// with value
const counter = createSignal(0);

//with function
const anotherCounter = createSignal(() => 0);
```

> 💡 Signal initialize value when you read or write it first time.<br>

Read value by calling a signal without arguments, write value by calling a signal with next value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// read
const value = counter();

// write with value
counter(10);

// write with function
counter((count) => count + 1);
```

### React & Hooks

Subscribe component to a signal, computed or selector by calling `useSelector`:

```typescript jsx
import {
  createSignal,
  useSelector
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSelector(counter);

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

Use props inside `useSelector`:

```typescript jsx
import {
  createSignal,
  useSelector
} from 'react-tagged-state';

const items = createSignal<
  Record<string, { id: number; title: string }>
>({ id: { id: 0, title: 'title' } });

const Item = ({ itemId }: { itemId: number }) => {
  const item = useSelector(() => items()[itemId]);

  return <div>{item.title}</div>;
};
```

### Computed

Create a computed by calling `createComputed` with selector:

```typescript jsx
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(0);

const doubledCounter = createComputed(
  () => counter() * 2
);
```

> 💡 Computed select value when you read it first time or when its dependencies changed. Computed unsubscribed automatically when nothing depends on it.

Read value by calling a computed without arguments:

```typescript jsx
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(0);

const doubledCounter = createComputed(
  () => counter() * 2
);

// read
const value = doubledCounter();
```

### Effects

Create an effect by calling `createEffect` with callback:

```typescript jsx
import {
  createSignal,
  createEffect
} from 'react-tagged-state';

const counter = createSignal(0);

const unsubscribe = createEffect(() => {
  console.log(counter());
});
```

### Subscriptions

Create a subscription by calling `createSubscription` with signal, computed or selector and callback:

```typescript jsx
import {
  createSignal,
  createSubscription
} from 'react-tagged-state';

const counter = createSignal(0);

const unsubscribe = createSubscription(
  counter,
  (value) => {
    console.log(value);
  }
);
```

### Batching

Updates batched automatically via microtask. Run batched updates immediately by calling `sync`:

```typescript jsx
import {
  createSignal,
  sync
} from 'react-tagged-state';

const counter = createSignal(0);

counter(10);

sync();
```

> 💡 `sync` called automatically when you read any computed.

## Concurrent Mode

Partial concurrent mode support via `useSyncExternalStore`.

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
