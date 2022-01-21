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
2. Read state by calling `state()` anywhere.
3. Write state by calling `state(value)` anywhere.
4. Bind your components with `observer` HOC.
5. Use inline computed by `compute`.

## Installation

```shell script
npm install --save react-tagged-state
```

## API Reference

- [createState](#createstate)
- [createEvent](#createevent)
- [observer](#observer)
- [compute](#compute)
- [effect](#effect)
- [cleanup](#cleanup)
- [useObserver](#useobserver)

### createState

```typescript
interface createState {
  <Type>(
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
  (updater: Type | ((value: Type) => Type)): void;
  (string: TemplateStringsArray, ...keys: any[]): (callback: (value: Type) => any) => () => void;
}
```

This is a base part of the state system.

You can use it for read and write state or subscriber to state.

```javascript
import { counterState } from 'react-tagged-state';

const counterState = createState(0);

// Read
const counter = counterState();

// Write with value
counterState(1000);

// Write with function
counterState((counter) => counter + 1);

// Subscribe
const unsubscribe = counterState``((counter) => console.log(counter));

// Unsubscribe
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

const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<Type> {
  (value: Type): void;
  (string: TemplateStringsArray, ...keys: any[]): (callback: (value: Type) => any) => () => void;
}
```

This is a base part of the event system.

You can use it for dispatch event or subscribe to event.

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

// Dispatch
resetEvent();

// Subscribe
const unsubscribe = resetEvent``(() => console.log('reset'));

// Unsubscribe
unsubscribe();
```

---

### observer

```typescript
interface observer {
  <
    Type extends
      | FunctionComponent<any>
      | ForwardRefRenderFunction<any, any>
  >(
    wrappedComponent: Type
  ): Type;
}
```

This is a React binding.

This is a reaction.

This HOC will re-render component anytime when some states thus component reads were changed.

It's like `observer` HOC from _mobx-react-lite_.

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

___

### compute

```typescript
interface compute {
  <Type>(func: () => Type): Type;
}
```

This is inline computed.

This is a reaction (only if you use it inside another reaction).

It can optimize your reactions: reactions will be triggered if value that `func` returns was changed.

Think about it like a `useSelector` hook from _react-redux_.

Deps will be tracked once, so you should avoid reading states inside conditions (rules similar to _react hooks_).

```javascript
import {
  createState,
  observer,
  compute
} from 'react-tagged-state';

const usersState = createState({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  //...
});

// Re-render UserCard if usersState()[userId].fullName was changed
const UserCard = observer(({ userId }) => (
  <div>
    {compute(() => usersState()[userId].fullName)}
  </div>
));
```

---

### effect

```typescript
export interface Effect {
  (func: () => any): () => void;
}
```

This is a reaction.

It will call `func` immediately and will re-call `func` anytime when some states thus `func` reads were changed.

```javascript
import {
  createState,
  effect
} from 'react-tagged-state';

const counterState = createState(0);

// Run effect
const clear = effect(() => {
  console.log(counterState());
});

// Clear effect
clear();
```

---

### cleanup

```typescript
interface cleanup {
  (func: () => any): void;
}
```

This adds cleanup `func` for current `effect`

```javascript
import {
  createState,
  effect,
  cleanup
} from 'react-tagged-state';

const counterState = createState(0);

effect(() => {
  console.log(counterState());

  const handleScroll = (event) => {
    console.log(event);
  };

  window.addEventListener('scroll', handleScroll);

  // Will be called before next effect call
  cleanup(() => {
    window.removeEventListener(
      'scroll',
      handleScroll
    );
  });
});
```

___

### useObserver

```typescript
interface useObserver {
  <Type>(func: (() => Type) | State<Type>): Type;
}
```

This is a React binding.

This is a reaction.

This hook will call `func` immediately and will call `func` and re-render component anytime when states thus `func` reads were changed.

You should prefer [`observer`](#observer) for components but [`useObserver`](#useobserver) useful for custom hooks.

```javascript
import {
  createState,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

const useCounter = () =>
  useObserver(counterState);

// Re-render Counter if counterState was changed
const Counter = () => {
  const counter = useCounter();

  return (
    <button
      onClick={() => {
        counterState((value) => value + 1);
      }}
    >
      {counter}
    </button>
  );
};
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
