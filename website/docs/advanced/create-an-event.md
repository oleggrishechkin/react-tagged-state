---
sidebar_position: 2
---

# Create an event

Event is an event dispatcher. It's like an action in Redux but optional.

## Create your first event

For create an event you should call createEvent.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();
```

## Dispatch an event

Dispatch event by calling event with payload (or without):

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent('counter');
```
