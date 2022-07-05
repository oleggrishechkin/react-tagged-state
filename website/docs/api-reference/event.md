---
sidebar_position: 6
---

# event

```typescript
interface Event<T = void> {
  (value: T): T;
  readonly on: (
    callback: (value: T) => void
  ) => () => void;
}
```

- This function is an event dispatcher.
- Subscribe to event by `on` method.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent();

resetEvent.on((value) =>
  console.log(`reset ${value}`)
);
```
