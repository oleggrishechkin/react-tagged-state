---
sidebar_position: 4
---

# Create an effect

Effect is a subscription with deps auto tracking. It will be called immediately and anytime when related signal (or computed) value was changed.

## Run

We need to just call createEffect with callback for running an effect:

```typescript
import {
  createSignal,
  createEffect
} from 'react-tagged-state';

const counter = createSignal(100);

const cleanup = createEffect(() =>
  console.log(`counter: ${counter()}`)
);

// counter: 100
```

## Cleanup

createEffect returns cleanup function, just call it:

```typescript
import {
  createSignal,
  createEffect
} from 'react-tagged-state';

const counter = createSignal(100);

const cleanup = createEffect(() =>
  console.log(`counter: ${counter()}`)
);

cleanup();
```

## Why?

Basically, we should avoid effects. But it's useful in useEffect, when we want to run some function but don't want to re-render our component.
