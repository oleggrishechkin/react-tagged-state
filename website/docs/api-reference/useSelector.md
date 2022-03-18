---
sidebar_position: 9
---

# useSelector

```typescript
interface useSelector {
  <T>(
    obj: Signal<T> | Computed<T> | (() => T)
  ): T;
}
```

This hook will re-render Component anytime when selected value was changed.

With selector:

Hook returns selected value.

```tsx
import {
  createSignal,
  useSelector
} from 'react-tagged-state';

const users = createSignal({
  id1: { id: 'id1', fullName: 'Adam Sandler' },
  id2: { id: 'id2', fullName: 'Oleg Grishechkin' }
  // ...
});

const UserCard = ({ userId }) => {
  const userFullName = useSelector(
    () => users()[userId].fullName
  );

  return <div>{userFullName}</div>;
};
```

It works well with signals and computed because they are "selectors" too. But you should prefer useSignal for signals and computed - it's cleaner and more performant.

With signal:

Hook returns signal value.

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

With computed:

Hook returns computed value.

```tsx
import {
  createSignal,
  createComputed,
  useSelector
} from 'react-tagged-state';

const counter = createSignal(0);

const roundedCounter = createComputed(() =>
  Math.floor(counter() / 10)
);

const Counter = () => {
  const roundedCount = useSelector(
    roundedCounter
  );

  return <div>{roundedCount}</div>;
};
```
