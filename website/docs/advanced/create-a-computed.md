---
sidebar_position: 1
---

# Create a computed

Computed is a value container too. It's a combination of signals. Nested computed allowed.

## Create your first computed

For create a computed you should call createComputed with selector.

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

## Read a computed value

Read a signal value by calling computed without arguments:

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

You can't write a computed value. Anytime when related signals or computed were changed a computed value will be recomputed.

## Use a computed

You can use a computed anywhere as well as a signal.
