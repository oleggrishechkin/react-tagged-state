---
sidebar_position: 2
---

# Subscription


## Subscribing

Signal has a subscription. Subscribers will be called with next signal value when a signal value was changed.

We can use on() for subscribing to signal:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(100);

counter.on((count) =>
  console.log(`counter: ${count}`)
);
```

Same for computed:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(100);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

roundedCounter.on((roundedCount) =>
  console.log(`roundedCounter: ${roundedCount}`)
);
```


## Unsubscribing

Signal's on() returns an unsubscribe function. We need to just call it for unsubscribing:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(100);

const unsubscribe = counter.on((count) =>
  console.log(`counter: ${count}`)
);

unsubscribe();
```
