---
sidebar_position: 2
---

# Connect with component

React Tagged State use two hooks - useSignal and useSelector.

## Use a signal

You can bind your component with signal or computed by useSignal.

Component will be re-rendered anytime when signal or computed was changed.

```tsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  const count = useSignal(counter);

  return <div>{count}</div>;
};
```

## Use a selector

You also can use selector by useSelector.

Component will be re-rendered anytime when selected value was changed.

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
