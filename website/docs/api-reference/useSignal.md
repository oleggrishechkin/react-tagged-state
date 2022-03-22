---
sidebar_position: 8
---

# useSignal

```typescript
interface useSignal {
  <T>(obj: Signal<T> | Computed<T>): T;
}
```

This hook will re-render Component anytime when signal or computed was changed.

With signal:

Hook returns signal value.

```tsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSignal(counter);

  return <div>{count}</div>;
};
```

With computed:

Hook returns computed value.

```tsx
import {
  createSignal,
  createComputed,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const Counter = () => {
  const roundedCount = useSignal(roundedCounter);

  return <div>{roundedCount}</div>;
};
```

Without assigning to variable:

```tsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  useSignal(counter);

  return <div>{counter()}</div>;
};
```
