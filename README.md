# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

WIP

⚛️ Experimental reactive and atomic state manager for React.

Inspired by awesome [_solid-js_](https://www.solidjs.com/) and [_S.js_](https://github.com/adamhaile/S).

## Basic Usage

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

/* Create signal */
const counterSignal = createSignal(0);

const Counter = () => {
  /* Bind */
  const counter = useTagged(counterSignal);

  return (
    <button
      onClick={() => {
        /* Write */
        counterState((value) => value + 1);
      }}
    >
      {counter}
    </button>
  );
};
```

## Installation

```shell script
npm install --save react-tagged-state
```

## API Reference

- [createSignal](#createsignal)
- [signal](#signal)
- [createEvent](#createevent)
- [event](#event)
- [mutable](#mutable)
- [mutated](#mutated)
- [subscribe](#subscribe)
- [useTagged](#usetagged)
- [createEffect](#createeffect)

### createSignal

```typescript
interface createSignal {
  <Type>(
    initialValue: Type | (() => Type)
  ): Signal<Type>;
}
```

This is a [signal](#signal) factory.

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
  (updater: Type | ((value: Type) => Type)): Type;
}
```

This function is a value container.<br>
Signal will be added to the deps when you read its value inside [useTagged](#usetagged) or [createEffect](#createeffect).

```javascript
import { createSignal } from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Read */
const counter = counterSignal();

/* Write with value */
counterSignal(1000);

/* Write with function */
counterSignal((counter) => counter + 1);
```

---

### createEvent

```typescript
interface createEvent {
  <Type = void>(): Event<Type>;
}
```

This is an [event](#event) factory.

```javascript
import { createEvent } from 'react-tagged-state';

/* Create */
const resetEvent = createEvent();
```

---

### event

```typescript
interface Event<Type = void> {
  (value: Type): Type;
}
```

This function is an event dispatcher.<br>
You can use it for write multiple [signals](#signal) and [mutate](#mutate) multiple mutable objects.

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

/* Dispatch */
resetEvent();
```

---

### mutable

```typescript
interface mutable {
  <Type extends MutableObject>(obj: Type): Type;
}
```

This is a getter for mutable objects.<br>
`obj` will be added to the deps when you call [`mutable(obj)`](#mutate) inside [useTagged](#usetagged) or [createEffect](#createeffect).

```javascript
import {
  useTagged,
  mutable
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Inside createEffect */
createEffect(() => {
  /* Mark object as mutable */
  console.log(mutable(counterRef).current);
});

const Counter = () => {
  /* Inside useTagged */
  const counter = useTagged(() => {
    /* Mark object as mutable */
    return mutable(counterRef).current;
  });

  return <div>{counter}</div>;
};
```

---

### mutated

```typescript
interface mutated {
  <Type extends MutableObject>(obj: Type): Type;
}
```

This is a setter for mutable object.<br>
You should call it when you mutate mutable object.<br>

```javascript
import {
  mutated,
  useTagged
} from 'react-tagged-state';

const counterRef = { current: 0 };

/* Mutate */
counterRef.current += 1;

/* Mark object as mutated */
mutated(counterRef);
```

---

### subscribe

```typescript
interface Subscribe {
  <Type>(
    obj:
      | Signal<Type>
      | Event<Type>
      | (() => Type),
    callback: (value: Type) => void
  ): () => void;
  <Type extends MutableObject>(
    obj: Type,
    callback: (value: Type) => void
  ): () => void;
}
```

This function subscribe to signal writes, event dispatches or mutable object mutations.<br>

```javascript
import {
  createSignal,
  createEvent,
  subscribe
} from 'react-tagged-state';

const counterSignal = createSignal(0);

const resetEvent = createEvent();

const counterRef = { current: 0 };

let unsubscribe;

/* Subscribe to signal */
unsubscribe = subscribe(
  counterState,
  (counter) => {
    console.log(counter);
  }
);

/* Unsubscribe */
unsubscribe();

/* Subscribe to event */
unsubscribe = subscribe(resetEvent, () => {
  console.log('reset');
});

/* Unsubscribe */
unsubscribe();

/* Subscribe to mutable object */
unsubscribe = subscribe(counterRef, () => {
  console.log(counterRef.current);
});

/* Unsubscribe */
unsubscribe();

/* Subscribe to computed */
unsubscribe = subscribe(
  () => Math.floor(counterSignal() / 10),
  (computed) => {
    console.log(computed);
  }
);

/* Unsubscribe */
unsubscribe();
```

---

### createEffect

```typescript
export interface createEffect {
  (func: () => void | (() => void)): () => void;
}
```

`func` will be called immediately and anytime when related signals were written or mutable objects were mutated.<br>
This function returns cleanup function.<br>
You can return cleanup function from `func`. It will be called before next `func` call or cleanup function call.

```javascript
import {
  createSignal,
  createEffect,
  mutable
} from 'react-tagged-state';

const signal = createSignal(0);

const ref = { current: 0 };

/* Run */
const cleanup = createEffect(() => {
  /* Read singal */
  console.log(signal());
  /* Mark mutable object */
  console.log(mutable(ref).current);

  /* Return cleanup function */
  return () => {
    console.log('cleanup');
  };
});

/* Cleanup */
cleanup();
```

---

### useTagged

```typescript
interface UseTagged {
  <Type>(obj: Signal<Type> | (() => Type)): Type;
  <Type extends MutableObject>(obj: Type): MutableObject;
}
```

This hook will re-render Component anytime when `obj` was written or mutated.

With signal:

Hook returns signal value.

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const counterSignal = createSignal(0);

/* Re-render Counter if counterSignal was changed */
const Counter = () => {
  /* Bind */
  const counter = useTagged(counterSignal);

  return <div>{counter}</div>;
};
```

With mutable object:

Hook returns `obj` version (tt's some empty object or `obj` itself).You can use it in hooks deps. Anytime when `obj` was mutated a new version will be created.

```javascript
import { useTagged } from 'react-tagged-state';

/* Create mutable object */
const counterRef = { current: 0 };

/* Re-render Counter if counterRef was mutated */
const Counter = () => {
  /* Bind */
  useTagged(counterRef);

  return <div>{counterRef.current}</div>;
};
```

With computed:

Hook returns value that `obj` returns.<br>
This hook will re-render component anytime when value that `obj` returns was changed.<br>

```javascript
import {
  createSignal,
  useTagged
} from 'react-tagged-state';

const usersSignal = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  /* ... */
});

/* Re-render UserCard if usersSignal()[userId].fullName was changed */
const UserCard = ({ userId }) => {
  /* Bind */
  const userFullName = useTagged(
    () => usersSignal()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).

## Concurrent Mode

You can safely use this library in Concurrent Mode. It uses `useSyncExternalStore` internally.
