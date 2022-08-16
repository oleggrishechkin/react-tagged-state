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

### Basics

When you read a signal value into some effect it will be added to this effect deps.<br>
Automatically.

When you write signal value all dependent effects wil be re-run.<br>
Automatically.

```typescript jsx
effect(function logSignal() {
  // "signal" will be added to the effect deps when we read "signal" value
  // "logSignal" will be re-run when we write "signal" value
  console.log(signal());
});
```

### Signals

Create a signal by calling `createSignal` with initial value.

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);
```

Read value by calling a signal without arguments.<br>
Write value by calling a signal with next value.

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

// read
const value = counter();

// write
counter(10);
```

### React & Hooks

Subscribe component to a signal by calling `useSignal`.

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

Also, you can use selectors by calling `useSelector`.

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

Computed is a read-only signal.

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

Create an effect by calling `createEffect` with callback.

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

Subscribe to a signal by calling `signal.on` method with callback.

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

const unsubscribe = counter.on((value) => {
  console.log(value);
});
```

## SSR

In Server-Side Rendering all subscriptions not work excepts `signal.on` and `event.on` methods with `{ ssr: true }` option.

## Concurrent Mode

Partial concurrent mode support via `useSyncExternalStore`.

## Documentation

Visit [the documentation site](https://oleggrishechkin.github.io/react-tagged-state/).

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
