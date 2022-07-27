# React Tagged State

[![NPM version](https://img.shields.io/npm/v/react-tagged-state.svg?style=flat)](https://www.npmjs.com/package/react-tagged-state)
[![Package size](https://img.shields.io/bundlephobia/minzip/react-tagged-state.svg)](https://bundlephobia.com/result?p=react-tagged-state)
![typescript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-blue.svg)
![NPM license](https://img.shields.io/npm/l/react-tagged-state.svg?style=flat)
[![NPM total downloads](https://img.shields.io/npm/dt/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)
[![NPM monthly downloads](https://img.shields.io/npm/dm/react-tagged-state.svg?style=flat)](https://npmcharts.com/compare/react-tagged-state?minimal=true)

⚛️ Experimental reactive and atomic state manager

Inspired by awesome [SolidJS](https://www.solidjs.com/) and [S.js](https://github.com/adamhaile/S).

## Basic Usage

```javascript
import { createSignal, useSelector } from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
    const count = useSelector(counter);

    return <button onClick={() => counter((value) => value + 1)}>{count}</button>;
};
```

## Documentation

Visit [the documentation site](https://oleggrishechkin.github.io/react-tagged-state/).

## Example

Open [CodeSandbox](https://codesandbox.io/s/react-tagged-state-qco1t)

## Performance

See results on [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html).
