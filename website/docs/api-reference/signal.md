---
sidebar_position: 2
---

# signal

```typescript
interface Signal<T> {
  (): T;
  (updater: T | ((value: T) => T)): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

- This function is a value container.
- Read by calling signal without arguments. Reading it will add signal to the deps of useSignal, useSelector, createComputed or createEffect.
- Write by calling signal with value or updater argument. Writing it will trigger related useSignal, useSelector, computed or createEffect.
- Subscribe to signal by `on` method.

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

const count = counter();

counter(1000);

counter((count) => count + 1);

counter.on((count) =>
  console.log(`counter: ${count}`)
);
```
