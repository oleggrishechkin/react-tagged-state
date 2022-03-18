---
sidebar_position: 10
---

# useSignalEffect

```typescript
interface useSignalEffect {
  (
    effect: () => void | (() => void),
    deps?: DependencyList
  ): void;
}
```

This hook will re-call effect anytime when related signals or computed were changed.

It's like useEffect but with deps auto tracking.

```tsx
import {
  createSignal,
  useSignal
} from 'react-tagged-state';

const counter = createSignal(0);

const Counter = () => {
  useSignalEffect(
    () => console.log(counter()),
    []
  );

  return null;
};
```
