---
type: command
name: decompose-task
description: Break complex tasks into parallel subtasks for better execution
---

# Task Decomposition Protocol

Use this command when facing complex, multi-step tasks that can benefit from parallel execution.

## When to Use

- ✅ Complex refactors affecting multiple files
- ✅ Adding features that touch frontend + backend + tests
- ✅ Investigating bugs across multiple systems
- ✅ Migrating code patterns across the codebase
- ❌ Simple single-file edits
- ❌ Straightforward bug fixes

## How It Works

1. **Identify Independent Subtasks** - Break the main task into 2-3 parallel work streams
2. **Launch Explore Agents** - Spawn agents in parallel (max 3 for optimal performance)
3. **Consolidate Findings** - Use Plan agent to merge insights
4. **Execute with Quality Checks** - Implement with automated quality hooks

## Example Workflows

### Adding Authentication

**Main Task**: "Add authentication to the Watheq project"

**Decomposition**:
- Agent 1: Explore Supabase auth patterns in existing code
- Agent 2: Explore frontend state management (Zustand store patterns)
- Agent 3: Explore API route protection in Netlify functions

### Optimizing Performance

**Main Task**: "Optimize bundle size and loading speed"

**Decomposition**:
- Agent 1: Analyze current bundle composition (Vite build output)
- Agent 2: Explore code splitting opportunities in React components
- Agent 3: Research lazy loading patterns for templates

### Bug Investigation

**Main Task**: "Fix inconsistent resume parsing"

**Decomposition**:
- Agent 1: Explore parsing logic in `parse-resume.ts` and `extract-resume-json.ts`
- Agent 2: Explore validation schemas in `src/lib/validation/`
- Agent 3: Explore error handling in frontend upload components

## Benefits

- **Faster Discovery**: Parallel agents explore different areas simultaneously
- **Better Context**: Each agent focuses on one domain, avoiding context overload
- **Comprehensive Plans**: Consolidated findings lead to better architectural decisions
- **Quality Assurance**: Automated quality checks after implementation

## Usage Pattern

```
// In Claude Code chat:
/decompose-task

// Or reference this file when starting complex tasks:
// "Let's use task decomposition for this authentication feature"
```

## Integration with Quality Checks

After implementing the decomposed tasks, your post-task hook automatically runs:
```bash
npm run quality:check  # Lint + TypeScript + Tests
```

This ensures all parallel work streams maintain code quality.

---

**Remember**: This is for *complex* tasks. Simple changes don't need decomposition!
