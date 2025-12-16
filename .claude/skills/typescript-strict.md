# TypeScript Strict Mode Guidelines

## Type Safety
- Enable strict mode in tsconfig.json
- Never use `any` - use `unknown` and narrow types
- Prefer interfaces for object shapes, types for unions/primitives
- Use const assertions for literal types

## Null Safety
- Always handle null/undefined explicitly
- Use optional chaining (?.) for safe property access
- Use nullish coalescing (??) for defaults
- Prefer early returns over nested conditionals

## Type Inference
- Let TypeScript infer when obvious (don't over-annotate)
- Always annotate function return types
- Always annotate function parameters
- Use generics for reusable type patterns

## Best Practices
```typescript
// Good: Explicit return type
function getUser(id: string): User | null {
  return users.find(u => u.id === id) ?? null;
}

// Good: Discriminated unions
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Good: Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Good: Type guards
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value;
}
```

## Avoid
- `any` type (use `unknown` instead)
- Type assertions without validation (`as Type`)
- Non-null assertions (`!`) without certainty
- Implicit any in function parameters
- `@ts-ignore` comments (use `@ts-expect-error` if truly needed)

## Project Types Location
- Domain types: src/types/
- Component props: co-located with component
- API types: src/lib/api/types.ts
- Store types: within store files

## JSON Resume Schema
This project uses JSON Resume schema. Always import from:
```typescript
import type { ResumeSchema, Work, Education } from '../types/resume';
```
