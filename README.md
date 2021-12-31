# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

⚛️ Reactive state manager

Experimental reactive and atomic state manager for _React_

## Basic Usage

```javascript
import {
  createState,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

const Counter = observer(() => (
  <button
    onClick={() => {
      counterState((value) => value + 1);
    }}
  >
    {counterState()}
  </button>
));
```

## Principles

1. Create your states with `createState`.
2. Read state value by calling state without arguments `state()` anywhere.
3. Write state value by calling state with value argument `state(value)` anywhere.
4. Bind your components with `observer` HOC or `useObserver` hook.
5. Use inline selectors by `compute`.

## Installation

```shell script
npm install --save react-tagged-state
```

## API Reference

- [createState](#createstate)
- [createEvent](#createevent)
- [effect](#effect)
- [observer](#observer)
- [useObserver](#useobserver)
- [compute](#compute)

### createState

```typescript
interface CreateState<Type> {
  (
    initialValue: (() => Type) | Type
  ): State<Type>;
}
```

This is a [state](#state) fabric.

```javascript
import { createState } from 'react-tagged-state';

// Initialize with value
const counterState = createState(0);

// Initialize with function
const anotherCounterState = createState(() => 0);
```

---

### state

```typescript
interface State<Type> {
  (): Type;
  (updater: ((value: Type) => Type) | Type): void;
  on: (
    callback: (value: Type) => any
  ) => () => void;
}
```

This is a base part of state system.
You can use it for read value, write value or subscribe to value.

```javascript
import { counterState } from 'react-tagged-state';

const counterState = createState(0);

// Read
const counter = counterState();

// Write with value
counterState(1000);

// Write with function
counterState((counter) => counter + 1);

// Subscribe to value
const cleanup = counterState.on((counter) => {
  console.log(counter);
});

// Clear subscription
cleanup();
```

---

### createEvent

```typescript
interface CreateEvent<Type = void> {
  (): Event<Type>;
}
```

This is a [event](#event) fabric.

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<Type> {
  (payload: Type): void;
  on: (
    callback: (payload: Type) => any
  ) => () => void;
}
```

This is a base part of event system.
You can use it for dispatch event or subscribe to event.

> 💡 Useful for changing multiple states by one event

```javascript
import {
  counterState,
  createEvent
} from 'react-tagged-state';

const counterState = createState(0);
const resetEvent = createEvent();

// Dispatch payload
resetEvent('counter');

// Subscribe to event dispatches
const cleanup = resetEvent.on((name) => {
  if (name === 'counter') {
    counterState(0);
  }
});

// Clear subscription
cleanup();
```

---

### effect

```typescript
interface Effect {
  (callback: () => any): () => void;
}
```

This is a reaction.
It will call callback immediately and anytime when states thus callback reads was updated.

> 💡 Useful in `useEffect` or non-React code

```javascript
import {
  createState,
  effect
} from 'react-tagged-state';

const counterState = createState(0);

// Run effect and subscribe to state changes
const cleanup = effect(() => {
  console.log(counterState());
});

// Clear subscription
cleanup();
```

---

### observer

```typescript
interface Observer<
  Type extends
    | FunctionComponent<any>
    | ForwardRefRenderFunction<any, any>
> {
  (wrappedComponent: Type): Type;
}
```

This is a React binding (and reaction).
This HOC will re-render Component anytime when states thus Component reads was updated.

```javascript
import {
  createState,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

// Re-render Counter if counterState was changed
const Counter = observer(() => (
  <button
    onClick={() => {
      counterState((value) => value + 1);
    }}
  >
    {counterState()}
  </button>
));
```

---

### useObserver

```typescript
interface UseObserver {
  (): <Type>(
    func: (() => Type) | State<Type>
  ) => Type;
}
```

This is a React binding (and reaction).
It returns a "track" function.
This hook will re-render Component anytime when states thus returned a "track" function reads was updated.

> 💡 Useful in custom hooks (or if you don't like HOCs)

```javascript
import {
  createState,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

// Re-render Counter if counterState was changed
const Counter = () => {
  const get = useObserver();

  return (
    <button
      onClick={() => {
        counterState((value) => value + 1);
      }}
    >
      {get(counterState)}
    </button>
  );
};
```

---

### compute

```typescript
interface Compute<Type> {
  (func: () => Type): Type;
}
```

This is an inline selector.
It can optimize you reactions.
This function receive a "selector" function.
Reactions will be triggered if value that "selector" function returns was changed.

> 💡 Sometimes you need to select specific item or some nested data

```javascript
import {
  createState,
  observer,
  compute
} from 'react-tagged-state';

const usersState = createState({
  id1: { fullName: 'Adam Sandler' },
  id2: { fullName: 'Oleg Grishechkin' }
  //...
});

// Re-render UserCard if usersState()[userId].fullName was changed
const UserCard = observer(({ userId }) => (
  <div>
    {compute(() => usersState()[userId].fullName)}
  </div>
));
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
