---
sidebar_position: 2
---

# Connect with component

React Tagged State use hooks for connecting signals with components.

We can use useSelector hook for this:

```tsx
import {
  createSignal,
  useSelector
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSelector(counter);

  return <div>{count}</div>;
};
```

Component will be re-rendered anytime when signal value was changed.
