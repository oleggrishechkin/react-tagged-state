---
sidebar_position: 3
---

# createComputed

```typescript
interface createComputed {
  <T>(selector: () => T): Computed<T>;
}
```

This is a computed factory.

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
