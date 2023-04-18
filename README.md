# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)

⚛️ Experimental global atomic state manager

**React Tagged State** uses signals API as [SolidJS](https://www.solidjs.com/) and [S.js](https://github.com/adamhaile/S) but without smart reactivity with effects and computed.

## Basic Usage

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

## API Overview

### createSignal

Create a signal by calling `createSignal` with initial value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);
```

Read value by calling a signal without arguments, write value by calling a signal with new value:

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

You can create an event like signal by calling `createSignal` without initial value:

```typescript jsx
import { createSignal } from 'react-tagged-state';

const reset = createSignal();
```

Dispatch event by calling a signal:

```typescript
import { createSignal } from 'react-tagged-state';

const reset = createSignal();

reset();
```

You can dispatch some payload too:

```typescript
import { createSignal } from 'react-tagged-state';

const reduxLikeDispatch = createSignal<{
  type: sring;
  payload: any;
}>();

reduxLikeDispatch({
  type: 'SET_COUNTER',
  payload: 5,
});
```

### useSelector

Subscribe component to a signal by calling `useSelector`:

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

You can map value from signal:

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
  const item = useSelector(
    items,
    (value) => value[itemId],
  );

  if (!item) {
    return null;
  }

  return <div>{item.title}</div>;
};
```

Selectors supported too:

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

Component will be re-rendered on selected/mapped value change.

> 💡 Your selector/map function may be called frequently so keep it as simple as possible. You can move heavy computations to `useMemo`.
> 
> Rules:<br>
> - selector function will be called on any signal change/on each render.<br>
> - map function will be called on provided signal change/on each render.

### subscribe

Subscribe to a signal by calling `subscribe` with signal and callback:

```typescript jsx
import {
  createSignal,
  subscribe,
} from 'react-tagged-state';

const counter = createSignal(0);

const unsubscribe = subscribe(
  counter,
  (value) => {
    console.log(value);
  },
);
```

Callback will be called on signal's value change.

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
