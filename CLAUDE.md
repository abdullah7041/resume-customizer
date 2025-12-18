# CLAUDE.md - Project Intelligence

## MANDATORY: Post-Task Quality Protocol

> [!IMPORTANT]
> **THIS IS NON-NEGOTIABLE:** After completing ANY code modification, you MUST run quality checks and fix all errors before marking the task complete.

### Automated Quality Checks

**1. Post-Task Hook (Automatic)**
- `.claude/settings.json` is configured to automatically run `npm run quality:check` after every task
- This check runs ESLint and TypeScript compiler
- Task is NOT complete until this passes with zero errors

**2. Pre-Commit Hook (Automatic)**
- Husky + lint-staged runs on every Git commit
- Automatically fixes fixable linting issues
- Blocks commits if TypeScript errors exist

### Manual Quality Commands

```bash
# Run full quality check (lint + types)
npm run quality:check

# Auto-fix linting issues + check types
npm run quality:fix

# Individual checks
npm run lint          # Check linting
npm run lint:fix      # Fix linting issues
npm run type:check    # Check TypeScript
```

## Enforcement Rules

1. **Never ask the user** if you should fix quality issues - FIX THEM IMMEDIATELY
2. **Do not mark tasks complete** while `quality:check` has errors
3. **Common fixes to apply automatically:**
   - Missing types → Add explicit TypeScript interfaces
   - Unused imports → Remove them
   - Missing React keys → Add unique keys to mapped elements
   - `any` type warnings → Replace with proper typed interfaces
   - ESLint rule violations → Follow the suggested fix

## TypeScript Standards

- **Never use `any`** - always define proper interfaces in `src/types/`
- **All function parameters** must have explicit types
- **All API responses** must have typed interfaces
- **All component props** must be typed with interfaces
- **React hooks** must have properly typed return values

## Quality Checklist (Must Pass)

Before completing ANY code task, ensure:
- [ ] `npm run lint` passes with 0 warnings
- [ ] `npm run type:check` passes with 0 errors
- [ ] All new interfaces added to `src/types/`
- [ ] No `any` types used anywhere
- [ ] All imports are actually used
- [ ] React components have unique keys in `.map()`

## Auto-Fix Workflow

```bash
# 1. Auto-fix what can be fixed
npm run lint:fix

# 2. Check what remains
npm run quality:check

# 3. Manually fix TypeScript errors
# (ESLint errors should be gone after step 1)

# 4. Verify everything passes
npm run quality:check
```

---

**Remember:** Quality checks are automated and enforced. There is no "skipping" this step.
