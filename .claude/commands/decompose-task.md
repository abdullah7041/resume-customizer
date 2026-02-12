# Decompose Complex Task

Break down a complex task into parallel subtasks using specialized agents.

## When to Use

- Tasks affecting 3+ files
- Multi-domain work (frontend + backend + tests)
- Complex refactoring or new features
- Uncertain about full scope

## Protocol

### Step 1: Analyze Task Complexity

Identify domains involved:
- [ ] Frontend (UI components, state management)
- [ ] Backend (API functions, database)
- [ ] Testing (unit tests, integration tests)
- [ ] Documentation (types, schemas, comments)

### Step 2: Create Parallel Subtasks

**Maximum 3 subtasks** to avoid coordination overhead:

```
Subtask 1: [Domain A - Exploration]
- Goal: Understand existing patterns
- Agent: Explore agent
- Output: File list + pattern summary

Subtask 2: [Domain B - Exploration]
- Goal: Identify integration points
- Agent: Explore agent
- Output: Architecture diagram

Subtask 3: [Domain C - Research]
- Goal: Research best practices
- Agent: General-purpose agent
- Output: Implementation recommendations
```

### Step 3: Launch Agents Simultaneously

Use Task tool with parallel invocations:

```typescript
// Launch 3 agents in parallel
Task(subagent_type: "Explore", prompt: "Find all scoring-related files...")
Task(subagent_type: "Explore", prompt: "Map state management flow...")
Task(subagent_type: "general-purpose", prompt: "Research Zustand patterns...")
```

### Step 4: Consolidate Findings

After agents complete:
1. Review all agent outputs
2. Identify conflicts/overlaps
3. Create unified implementation plan
4. Enter Plan Mode if architecture decisions needed

### Step 5: Execute with Quality Checks

1. Implement based on consolidated plan
2. Run `quality:parallel` after each file modification
3. Track progress with Tasks (not Todos)

## Example: "Add Authentication"

**Decomposition**:
```
Subtask #1: Explore Supabase Auth Patterns
- Agent: Explore
- Task: Find all auth-related code, check current setup
- Output: List of files, current auth flow

Subtask #2: Research State Management for Auth
- Agent: general-purpose + context7
- Task: Research best practices for auth state with Zustand
- Output: Recommended patterns, code examples

Subtask #3: Explore API Protection Patterns
- Agent: Explore
- Task: Find all API functions, check current protection
- Output: List of unprotected endpoints
```

**Consolidation**:
- Supabase is already integrated (from subtask 1)
- Use Zustand middleware pattern (from subtask 2)
- Protect 12 endpoints identified (from subtask 3)

**Implementation Plan**:
1. Add auth middleware to Zustand store
2. Wrap protected routes with AuthGate
3. Add auth checks to 12 API functions
4. Add tests for auth flows

## Anti-Patterns (Avoid)

❌ **Too many subtasks**: More than 3 creates coordination overhead
❌ **Sequential exploration**: Launch agents in parallel, not one-by-one
❌ **Skipping consolidation**: Always review and synthesize findings
❌ **Using Todos instead of Tasks**: Complex work needs persistence

## Success Criteria

- ✅ All domains explored in parallel
- ✅ Findings consolidated before implementation
- ✅ Plan Mode used for architecture decisions
- ✅ Quality checks pass (`quality:parallel`)
- ✅ Tasks created for multi-session work

---

> **Reference**: See [TASK_DECOMPOSITION.md](../../TASK_DECOMPOSITION.md) for complete guide.
