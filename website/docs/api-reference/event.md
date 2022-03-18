---
sidebar_position: 6
---

# event

```typescript
interface Event<T = void> {
  (payload: T): T;
  readonly on: (
    callback: (payload: T) => void
  ) => () => void;
}
```

- This function is an event dispatcher.
- Subscribe to event by `on` method.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent();

resetEvent.on((payload) =>
  console.log(`reset ${payload}`)
);
```
