---
sidebar_position: 4
---

# Create an effect

Effect is a subscription with deps auto tracking. It will be called immediately and anytime when related signals or computed were changed.

## Create your first effect

For create an effect you should call createEffect with effect:

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

## Cleanup an effect

Cleanup an effect by calling function that createEffect returns:

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

cleanup();
```
