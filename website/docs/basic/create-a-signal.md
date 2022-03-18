---
sidebar_position: 1
---

# Create a signal

The base part of React Tagged State is a signal. It's a simple value container. Keep signals as small as possible.

## Create your first signal

For create a signal you should call createSignal with initial value:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);
```

You also can create a signal by calling createSignal with initializer function:

```typescript
import { createSignal } from 'react-tagged-state';

const initializeCounter = () => 0;

const counter = createSignal(initializeCounter);
```

## Read a signal value

Read a signal value by calling signal without arguments:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter(); // 0
```

## Write a signal value

Write a signal value by calling signal with value argument:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter(100);

counter(); // 100
```

You also can write a signal by calling signal with initializer function:

```typescript
import { createSignal } from 'react-tagged-state';

const counter = createSignal(0);

counter((count) => count + 1);

counter(); // 1
```
