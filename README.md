# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)


#### "Single Source Of Truth" state management library. Works well with Next.js.

The main idea is using proxy to collect property path for better typings and setting deeply nested properties. It's like an optics/lens.

## Basic Usage

```typescript jsx
import { store, useStore } from './store';

const Counter = () => {
    const [count, setCount] = useStore(store.count);

    return <button onClick={() => setCount((value) => value + 1)}>{count}</button>;
};
```

## Setup

First, create a store:

```typescript
// store.ts
import { createStore } from 'react-tagged-state';

export interface State {
  count: number
}

const [store, Provider, useStore] = createStore<State>({ count: 0 });

export { store, Provider, useStore };
```

`store` is a Proxy to collect property path.<br>
`Provider` create pub/sub instance with state variable.

Second, wrap app in Provider:

```typescript jsx
// App.tsx
import { State, store, Provider } from './store';

const App = ({ initialState }: { initialState: State }) => {
  const [count, setCount] = useStore(store.count);

  return (
    <Provider state={initialState}>
      ...
    </Provider>
  );
};
```

Third, use store:

```typescript jsx
// Counter.tsx
import { store, useStore } from './store';

const Counter = () => {
  const [count, setCount] = useStore(store.count);

  return (
    <button onClick={() => setCount((value) => value + 1)}>
      {count}
    </button>
  );
};
```
