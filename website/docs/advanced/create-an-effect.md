---
sidebar_position: 4
---

# Create an effect

Effect is a subscription with deps auto tracking. It will be called immediately and anytime when related signal (or computed) value was changed.

## Run

We need to just call effect with callback for running an effect:

```typescript
import {
  createSignal,
  effect
} from 'react-tagged-state';

const counter = createSignal(100);

const cleanup = effect(() =>
  console.log(`counter: ${counter()}`)
);

// counter: 100
```

## Cleanup

effect returns cleanup function, just call it:

```typescript
import {
  createSignal,
  effect
} from 'react-tagged-state';

const counter = createSignal(100);

const cleanup = effect(() =>
  console.log(`counter: ${counter()}`)
);

cleanup();
```

## Why?

Basically, we should avoid effects. But it's useful in useEffect, when we want to run some function but don't want to re-render our component.
