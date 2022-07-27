---
sidebar_position: 1
---

# Create a computed

## Creating

Computed is a value container too. It's a combination of signals.

Let's create a computed!

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(100);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);
```

Reading a computed value is same as reading signal value:

```typescript
import {
  createSignal,
  createComputed
} from 'react-tagged-state';

const counter = createSignal(100);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

roundedCounter(); // 10
```

But we can't write a computed value. Anytime when related signal (or nested computed) value was changed a computed value will be recomputed.

## Usage

We need to use useSelector for connecting computed with component (same as signal, yeah).

```tsx
import {
  createSignal,
  createComputed,
  useSelector
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const RoundedCounter = () => {
  const roundedCount = useSelector(roundedCounter);

  return <div>{roundedCount}</div>;
};
```

## Why?

We need a computed when we need to reuse some slow computations. Please, don't use computed for low-cost computations like props accessing. It's not about it.
