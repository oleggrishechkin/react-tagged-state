---
sidebar_position: 5
---

# createEvent

```typescript
interface createEvent {
  <T = void>(): Event<T>;
}
```

This is an event factory.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();
```
