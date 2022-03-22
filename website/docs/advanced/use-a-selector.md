---
sidebar_position: 5
---

# Use a selector

## Usage

What if we need to some computation with props? Or re-render our component when only deep object property changed?

We can use useSelector hook!

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

Component will be re-rendered anytime when selected value was changed.

## Is useSignal useless?

Short answer - No. We should prefer useSignal for signals and computed. It's faster and clearer.
