# React Best Practices

## Component Design
- Prefer functional components with hooks over class components
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use composition over inheritance

## State Management
- Use local state (useState) for UI-only state
- Use Zustand store for shared/global state
- Avoid prop drilling - use context or stores
- Keep state as close to where it's used as possible

## Performance
- Memoize expensive calculations with useMemo
- Memoize callbacks passed to children with useCallback
- Use React.memo for components that render often with same props
- Avoid inline object/array creation in render
- Use lazy loading for route-level code splitting

## Hooks Rules
- Only call hooks at the top level
- Only call hooks from React functions
- Name custom hooks with "use" prefix
- Keep dependency arrays accurate and complete

## Event Handlers
- Name handlers with "handle" prefix: handleClick, handleSubmit
- Prefer controlled components for forms
- Debounce/throttle expensive handlers

## Component Structure
```tsx
// 1. Imports
import { useState, useCallback } from 'react';

// 2. Types/Interfaces
interface Props {
  title: string;
  onAction: () => void;
}

// 3. Component
export function MyComponent({ title, onAction }: Props) {
  // 4. Hooks first
  const [state, setState] = useState(false);

  // 5. Derived state/memos
  const derivedValue = useMemo(() => compute(state), [state]);

  // 6. Callbacks
  const handleClick = useCallback(() => {
    onAction();
  }, [onAction]);

  // 7. Effects (if needed)
  useEffect(() => {
    // side effects
  }, []);

  // 8. Early returns for loading/error
  if (!title) return null;

  // 9. Render
  return <div onClick={handleClick}>{title}</div>;
}
```

## Project-Specific Rules
- All text must use i18n (useTranslation hook)
- Support RTL with useDirection hook
- Follow component path: src/components/
- Follow utility path: src/lib/
