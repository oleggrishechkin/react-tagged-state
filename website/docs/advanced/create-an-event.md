---
sidebar_position: 3
---

# Create an event

Event is an event dispatcher. It's like a dispatch + action in Redux but optional.

## Creating

Just call createEvent for creating an event:

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();
```

Now we can dispatch an event:

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent('counter');
```

We used payload argument in example above. Event's subscribers will be notified with this payload argument.

## Subscribing

Event has on() method too.

```typescript
import { createEvent } from 'react-tagged-state';

const resetEvent = createEvent();

resetEvent('counter');

resetEvent.on((payload) => console.log(`reset ${payload}`));
```

## Why?

Events can help us with signal encapsulation/code splitting. We want to use events for writing multiple signals.

Basing example is a resetting signals:

Without events (import all signals to reset action):

```typescript
// ./signals/counter
import { createSignal } from 'react-tagged-state';

const initialValue = 0;

const counter = createSignal(initialValue);

export { counter, initialValue };
```

```typescript
// ./signals/users
import { createSignal } from 'react-tagged-state';

const initialValue = [];

const users = createSignal(initialValue);

export { users, initialValue };
```

```typescript
// ./actions/reset

import { counter, initialValue as counterInitialValue } from './signals/counter';
import { users, initialValue as usersInitialValue  } from './signals/users';

const reset = () => {
  counter(counterInitialValue);
  users(usersInitialValue);
};

export { reset };
```

With events (import reset event to all signals):

```typescript
// ./signals/counter
import { createSignal } from 'react-tagged-state';

const initialValue = 0;

const counter = createSignal(initialValue);

reset.on(() => counter(initialValue));

export { counter };
```

```typescript
// ./signals/users
import { createSignal } from 'react-tagged-state';
import { reset } from './events/reset';

const initialValue = [];

const users = createSignal(initialValue);

reset.on(() => users(initialValue));

export { users };
```

```typescript
// ./events/reset

import { createEvent } from 'react-tagged-state';

const reset = createEvent();

export { reset };
```
