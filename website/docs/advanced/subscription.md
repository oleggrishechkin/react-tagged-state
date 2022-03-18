---
sidebar_position: 3
---

# Subscription

Signal, computed and event has a subscription. Subscribers will be called when signal or computed was changed or event was dispatched.

## Subscribe to signal or computed

For subscribe to signal or computed you should call signal.on or computed.on with callback:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(100);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

counter.on((count) =>
  console.log(`counter: ${count}`)
);

roundedCounter.on((roundedCount) =>
  console.log(`roundedCounter: ${roundedCount}`)
);
```

## Subscribe to event

For subscribe to event you should call event.on with callback:

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent.on((payload) =>
  console.log(`reset: ${payload}`)
);
```
