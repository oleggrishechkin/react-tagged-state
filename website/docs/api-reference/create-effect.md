---
sidebar_position: 7
---

# createEffect

```typescript
interface createEffect {
  (func: () => void | (() => void)): () => void;
}
```

`func` will be called immediately and anytime when related signals or computed were changed.

You can return function from `func`. It will be called before next `func` or cleanup call.

```typescript
import {
  createSignal,
  createComputed,
  createEffect
} from 'react-tagged-state';

const counter = createSignal(10);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const cleanup = createEffect(() => {
  console.log(`counter: ${counter()}`);
  console.log(
    `roundedCounter: ${roundedCounter()}`
  );

  return () => {
    console.log('cleanup');
  };
});

// counter: 100
// roundedCounter: 10

cleanup();

// cleanup
```
