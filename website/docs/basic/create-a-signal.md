---
sidebar_position: 1
---

# Create a signal

The base part of React Tagged State is a signal. It's a simple value container.

First we need to create a signal:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);
```

Now we can read and write out counter signal. No get()/set() methods or something else - just call our signal:

Read a signal value by calling signal without arguments:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter(); // 0
```

Write a signal value by calling signal with value argument:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter(100);

counter(); // 100
```
