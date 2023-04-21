# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)

⚛️ Global atomic state manager

**React Tagged State** uses signals API as [SolidJS](https://www.solidjs.com/) and [S.js](https://github.com/adamhaile/S) but without automatic deps tracking.

## Basic Usage

```typescript jsx
import {
  createSignal,
  useSelector,
} from 'react-tagged-state';

// create a signal
const counter = createSignal(0);

const Counter = () => {
  // read value
  const count = useSelector(counter);

  return (
    <button
      onClick={() => {
        // update value
        counter((value) => value + 1)
      }}
    >
      {count}
    </button>
  );
};
```

## API Overview

### Signal

Signal is a value container. And also is just a function.
You can read value by calling signal without arguments and write value by calling signal with next value. Simple.

```typescript jsx
import { createSignal } from 'react-tagged-state';

// create a signal
const counter = createSignal(0);

// read
const value = counter();

// write with value
counter(10);

// write with function
counter((count) => count + 1);
```

### Event

Event is a "write-only" signal. You can't read value, but you can dispatch next value.

```typescript jsx
import { createEvent } from 'react-tagged-state';

// create an event
const reset = createEvent();

// dispatch
reset();
```

### React & Hooks

`useSelector` bind signals with component. This is all what you need to sync signals with yuor components. You can use signals or selectors like you do in redux, of course.

Signal:

```typescript jsx
import {
  createSignal,
  useSelector,
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

Component will be re-rendered on signal's value change.

Selector:

```typescript jsx
import {
  createSignal,
  useSelector,
} from 'react-tagged-state';

const items = createSignal<
  Partial<
    Record<string, { id: string; title: string }>
  >
>({ id: { id: '0', title: 'title' } });

const Item = ({ itemId }: { itemId: string }) => {
  const item = useSelector(() => items()[itemId]);

  if (!item) {
    return null;
  }

  return <div>{item.title}</div>;
};
```

Component will be re-rendered on selected value change.

### Subscription

Signals and events have `on` method. You can use this method to subscribe to signals and events outside your components or in `useEffect`.

```typescript jsx
import {
  createSignal,
  subscribe,
} from 'react-tagged-state';

const counter = createSignal(0);

const unsubscribe = counter.on(
  (value) => {
    console.log(value);
  },
);
```

Callback will be called on signal's value change or event's dispatch.

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
