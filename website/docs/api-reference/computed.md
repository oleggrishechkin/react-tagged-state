---
sidebar_position: 4
---

# computed

```typescript
interface Computed<T> {
  (): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

- This function is a value container.
- Read by calling computed without arguments. Reading it will add computed to the deps of useSignal, useSelector, createComputed or createEffect.
- Subscribe to computed by `on` method.
- Nested computed is allowed.

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(100);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const roundedCount = roundedCounter();

roundedCounter.on((roundedCount) =>
  console.log(`roundedCounter: ${roundedCount}`)
);
```
