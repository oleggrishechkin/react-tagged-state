---
sidebar_position: 1
---

# createSignal

```typescript
interface createSignal {
  <T>(initializer: T | (() => T)): Signal<T>;
}
```

This is a signal factory.

```typescript
import { createSignal } from 'react-tagged-state';

let counter;

counter = createSignal(0);

counter = createSignal(() => 0);
```
