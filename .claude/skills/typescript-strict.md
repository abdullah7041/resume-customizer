# TypeScript Strict Mode Guidelines

> **Goal:** Zero `any` types, zero implicit types, zero TypeScript errors.

## Project Configuration

This project uses TypeScript 5.x with strict mode. All code must pass:
```bash
npm run type:check  # tsc --noEmit
```

---

## Type Safety Rules

### Rule 1: Never Use `any`
```typescript
// ❌ FORBIDDEN
function processData(data: any) { ... }
const response: any = await fetch(...);

// ✅ CORRECT
function processData(data: ResumeSchema) { ... }
const response: ApiResponse<ResumeSchema> = await fetch(...);
```

**If you don't know the type:**
```typescript
// Use `unknown` and narrow it
function processUnknown(data: unknown): ResumeSchema {
  if (!isResumeSchema(data)) {
    throw new Error('Invalid data structure');
  }
  return data; // Now typed as ResumeSchema
}
```

### Rule 2: All Function Parameters Must Have Types
```typescript
// ❌ FORBIDDEN - implicit any
const handleClick = (e) => { ... }
const formatDate = (date) => { ... }

// ✅ CORRECT
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
const formatDate = (date: Date | string): string => { ... }
```

### Rule 3: All Functions Must Have Return Types
```typescript
// ❌ FORBIDDEN - implicit return
function getUser(id: string) {
  return users.find(u => u.id === id);
}

// ✅ CORRECT - explicit return
function getUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}
```

---

## Project Type Locations

| Type Category | Location | Example |
|---------------|----------|---------|
| Resume data | `src/types/resume.ts` | `ResumeSchema`, `Work`, `Education` |
| API responses | `src/types/api.ts` | `ApiResponse<T>`, `OptimizeResponse` |
| Component props | Co-located | `interface ButtonProps { ... }` |
| Store state | Within store | `interface ResumeState { ... }` |
| Utility types | `src/types/index.ts` | `Nullable<T>`, `DeepPartial<T>` |

---

## Common Patterns

### API Response Typing
```typescript
// src/types/api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface OptimizeResponse {
  optimizedResume: ResumeSchema;
  changes: string[];
  score: number;
}

// Usage
const response = await api.optimize(resume) as ApiResponse<OptimizeResponse>;
if (response.success && response.data) {
  setResume(response.data.optimizedResume);
}
```

### Event Handler Types
```typescript
// Form events
onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
onSubmit: (e: React.FormEvent<HTMLFormElement>) => void

// Mouse events
onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void

// Keyboard events
onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void

// Custom handlers (no event)
onSelect: (value: string) => void
onResumeChange: (resume: ResumeSchema) => void
```

### React 19 Ref Typing
```typescript
// React 19 - refs are now props, not forwardRef
interface InputProps {
  ref?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
}

function Input({ ref, value, onChange }: InputProps) {
  return <input ref={ref} value={value} onChange={e => onChange(e.target.value)} />;
}
```

### Discriminated Unions (for State)
```typescript
type OptimizeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ResumeSchema }
  | { status: 'error'; error: string };

// Usage with exhaustive checking
function renderState(state: OptimizeState) {
  switch (state.status) {
    case 'idle': return <IdleView />;
    case 'loading': return <LoadingSpinner />;
    case 'success': return <ResumePreview data={state.data} />;
    case 'error': return <ErrorMessage message={state.error} />;
  }
}
```

### Type Guards
```typescript
// Type guard for runtime validation
function isResumeSchema(value: unknown): value is ResumeSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    'basics' in value &&
    typeof (value as ResumeSchema).basics?.name === 'string'
  );
}

// Usage
const parsed = JSON.parse(response);
if (isResumeSchema(parsed)) {
  setResume(parsed); // TypeScript knows it's ResumeSchema
}
```

---

## Null Safety
```typescript
// ✅ Optional chaining
const name = resume?.basics?.name;

// ✅ Nullish coalescing
const displayName = resume?.basics?.name ?? 'Unknown';

// ✅ Early return pattern
function getWorkExperience(resume: ResumeSchema | null): Work[] {
  if (!resume?.work) return [];
  return resume.work;
}

// ❌ AVOID non-null assertion without certainty
const name = resume!.basics!.name; // Dangerous
```

---

## Quick Reference: Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Parameter 'x' implicitly has an 'any' type` | Add type annotation: `(x: Type)` |
| `Object is possibly 'undefined'` | Add optional chaining: `obj?.prop` or null check |
| `Type 'any' is not assignable` | Define proper interface |
| `Property 'x' does not exist on type 'y'` | Extend interface or use type guard |
| `Argument of type 'X' is not assignable to 'Y'` | Check interface compatibility, add missing props |

---

## Pre-Commit Checklist

- [ ] `npm run type:check` passes with 0 errors
- [ ] No `any` types in changed files
- [ ] All new functions have explicit return types
- [ ] All event handlers are properly typed
- [ ] New interfaces added to `src/types/`