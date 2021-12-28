# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

⚛️ Reactive state manager

Easy-to-use super light-weight global state management solution for _React_

- Fast 🚀
- Reactive ⚛️
- Atomic 🧬

## Usage

```javascript
import {
  createState,
  useSelector,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

// with hooks
const Example = () => {
  const counter = useSelector(counterState);

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

// with HOC
const Example = observer(() => (
  <button
    onClick={() => {
      counterState((value) => value + 1);
    }}
  >
    {counterState()}
  </button>
));
```

That's it. You already know how use it 💪

## Main concept

- Based on [signals](https://github.com/adamhaile/S#data-signals) inspired by _solid-js_ and _S.js_, so you only need one function for a state value "get" or "set".
- Connects with _React_ by `useSelector` (like _react-redux_) hook and `observer` HOC (like _mobx-react_). You can use both in the same time.

## Installation

```shell script
npm install --save react-tagged-state
```

## API

### createState: (initialState) => state

```javascript
// With value
const counterState = createState(0);

// With function
const anotherCounterState = createState(() => 0);
```

Params:

- `initialState: () => any | any`

Returns:

- `state: State<any>`

### state

it's [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).

You can use it for:

- "get" value (call without arguments).

```javascript
import { counterState } from 'react-tagged-state';

const counterState = createState(0);

const counter = counterState();
```

- "set" value (call with `updaters` arguments).

```javascript
import { counterState } from 'react-tagged-state';

const counterState = createState(0);

// With value
counterState(1000);

// With function
counterState((counter) => counter + 1);
```

- "subscribe" (call via [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)).

```javascript
import { counterState } from 'react-tagged-state';

const counterState = createState(0);

counterState``((counter) => {
  console.log(counter);
});
```

---

### createEvent: () => event

```typescript
const resetEvent = createEvent();
```

~~Params:~~

Returns:

- `event: Event<any>`

### event

It's [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates).

You can use it for:

- "dispatch" payload.

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent('counter');
```

- "subscribe" (call via [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)).

```javascript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent``((name) => {
  console.log(name);
});
```

---

### createEffect: (effectFunction) => effect

```javascript
const logCounterEffect = createEffect(() => {
  console.log(counterState());
});
```

Params:

- `effectFunction: () => any`

Returns:

- `effect: Effect<any>`

### effect

`effect` is a function that run effect.

> Run effectFunction immediately and when states that effectFunction reads changed. 

~~Params:~~

Returns:

- `cleanup: () => void`

> Useful for `useEffect` when you don't want re-render Component.

```javascript
import {
  createState,
  createEffect
} from 'react-tagged-state';

const counterState = createState(0);

const logCounterEffect = createEffect(() => {
  console.log(counterState());
});

const Example = () => {
  const counter = useSelector(counterState);

  // With effect
  useEffect(logCounterEffect);

  // With inline effect
  useEffect(
    createEffect(() => {
      console.log(counterState());
    })
  );

  return null;
};
```

---

### useSelector: (selector) => value

It's hook for connecting with _React_.

> Re-render Component when value that selector returns changed.

```javascript
const doubledCounter = useSelector(
  () => counterState() * 2
);
```

Params:

- `selector: () => any`

Returns:

- `value: any`

```javascript
import {
  createState,
  useSelector
} from 'react-tagged-state';

const usersState = createState({
  id1: { fullName: 'Adam Sandler' },
  id2: { fullName: 'Oleg Grishechkin' }
  //...
});

// Re-render UserCard when
// usersState()[userId].fullName changed
const UserCard = ({ userId }) => {
  const fullName = useSelector(
    () => usersState()[userId].fullName
  );

  return <div>{fullName}</div>;
};
```

> 💡 Since selector is just a function without arguments, state can be a selector.

```javascript
import {
  createState,
  useSelector
} from 'react-tagged-state';

const counterState = createState(0);

const Example = () => {
  const counter = useSelector(counterState);

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

### observer: (Component) => EnhanceComponent

It's HOC for connecting with _React_.

> Re-render Component when states that Component reads changed.

```javascript
import {
  createState,
  observer
} from 'react-tagged-state';

const counterState = createState(0);

// Re-render Example when counterState changed
const Example = observer(() => (
  <button
    onClick={() => {
      counterState((value) => value + 1);
    }}
  >
    {counterState()}
  </button>
));
```

### compute: (selector) => value

It's inline computed value.

> Useful for `observer` and `createEffect` - reaction will be triggered only if value that selector returns changed.

> 💡 You can use it into `useSelector` - it will work just simple selector.

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

// Re-render UserCard when 
// usersState()[userId].fullName changed
const UserCard = observer(({ userId }) => (
  <div>
    {compute(() => usersState()[userId].fullName)}
  </div>
));
```

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).

## Browsers support

Browser should support [spread](https://caniuse.com/mdn-javascript_operators_spread_spread_in_object_literals):

- Chrome: >= 60
- Firefox: >= 55
- Safari: >= 11.1
