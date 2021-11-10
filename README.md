# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-viewport-list)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-viewport-list?minimal=true)

⚛️ Reactive state manager

Easy-to-use super light-weight global state management solution for [React](https://reactjs.org/)

## Usage

```javascript
import { createState, useSelector } from 'react-tagged-state';

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

That's it. You already know how use it 💪

## Pros

-   Fast
-   Reactive
-   Atomic
-   No dispatch
-   No Proxy
-   No Providers or HOCs
-   No actions or reducers
-   Tiny (~1kb minified+gzipped)

## Main concept

**React Tagged State** main concept is a [`states`](#state) - it's a functions which can "get" value and "set" value itself. You don't need to create actions, reducers or events for just "set" your state value. Also, you don't need to call `getState` method or call some `get` function for "get" current state value.
Just call `state()` without arguments for "get" value and call `state(newValue)` with new value for "set" value.

**React Tagged State** provide just one hook - `useSelector` - a "computed for components". It's like **react-redux** `useSelector`, but also it tracks what states you read inside selector and call selector only if this states changed.

## Installation

```shell script
npm install --save react-tagged-state
```

## API

### createState: (initialState) => state

```javascript
const initialState = 0;

const counterState = createState(initialState);
```

Returns [`state`](#state) (like [**S.js**](https://github.com/adamhaile/S) [signals](https://github.com/adamhaile/S#data-signals))

### state

`state` is a [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

You can use it for:

-   "get" value (call without arguments)

    ```javascript
    const counter = counterState();
    ```

-   "set" value (call with `updaters` arguments)

    ```javascript
    // with value
    counterState(1000);

    // with function
    counterState((counter) => counter + 1);
    ```

-   "subscribe" (call via [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates))

    ```javascript
    counterState``((counter) => console.log(counter));
    ```

---

### createComputed: (selector) => computed

```javascript
const doubledCounterComputed = createComputed(() => counterState() * 2);
```

Returns [`computed`](#computed)

### computed

`computed` is a [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

You can use it for:

-   "get" value (call without arguments)

    ```javascript
    const doubledCounter = doubledCounterComputed();
    ```

-   "subscribe" (call via [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates))

    ```javascript
    doubledCounterComputed``((doubledCounter) => console.log(doubledCounter));
    ```

---

### createEvent: () => event

```javascript
const resetEvent = createEvent();
```

Returns [`event`](#event)

### event

`event` is a [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

You can use it for:

-   "dispatch" payload

    ```javascript
    resetEvent('counter');
    ```

-   "subscribe" (call via [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates))

    ```javascript
    resetEvent``((name) => console.log(name));
    ```

---

### createEffect: (effect) => cleanup

```javascript
// start effect
const cleanup = createEffect(() => {
    console.log(counterState());
});

// clear effect
cleanup();
```

Params:

-   `effect: () => any`

Returns `function` that clear effect

`effect` would be called immediately and anytime when state parts that `effect` reads changed

```javascript
createEffect(() => console.log(counterState()));
```

---

### useSelector: (selector) => value

`useSelector` is a [React](https://reactjs.org/) binding

-   Call `selector` anytime when state parts that `selector` reads changed or `selector` changed itself
-   Re-render component anytime when `value` that `selector` returns changed

Params:

-   `selector: () => any`

Returns `value` that `selector` returns

```javascript
import { createState, useSelector } from 'react-tagged-state';

const counterState = createState(0);

const Example = () => {
    const doubledCounter = useSelector(() => counterState() * 2);

    return (
        <button
            onClick={() => {
                counterState((value) => value + 1);
            }}
        >
            {doubledCounter}
        </button>
    );
};
```

Since `selector` is just a function without arguments, [`state`](#state) can be a `selector`

```javascript
import { createState, useSelector } from 'react-tagged-state';

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

---

## Performance

See results in [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html)

## Browsers support

Browser should support [spread](https://caniuse.com/mdn-javascript_operators_spread_spread_in_object_literals):

-   Chrome: >= 60
-   Firefox: >= 55
-   Safari: >= 11.1
