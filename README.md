# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)

⚛️ Experimental reactive and atomic state manager

**React Tagged State** uses the same reactivity pattern as [SolidJS](https://www.solidjs.com/) and [S.js](https://github.com/adamhaile/S) but optimized for usage with React.

- Batch all updates automatically
- Run exactly affected subscribers only once per batch
- Lazy computed

## Basic Usage

```typescript jsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSignal(counter);

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

## Quick Guide

### Signals

Create a signal by calling `createSignal` with initial value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);
```

Read value by calling a signal without arguments, write value by calling a signal with next value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// read
const value = counter();

// write
counter(10);
```

### React & Hooks

Subscribe component to a signal by calling `useSignal`:

```typescript jsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSignal(counter);

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

Use selectors by calling `useSelector`:

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

Create a computed by calling `createComputed` with selector.

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

Create a subscription by calling `createSubscription` with signal (or computed) and callback.

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

## Concurrent Mode

Partial concurrent mode support via `useSyncExternalStore`.

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
