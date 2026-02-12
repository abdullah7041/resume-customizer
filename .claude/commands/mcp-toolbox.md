---
name: mcp-toolbox
description: Quick reference for MCP servers currently enabled and optimization guidelines
---

# MCP Toolbox

Quick reference for Model Context Protocol servers and usage optimization.

## Current MCP Setup (Optimized)

**Enabled Servers** (~4k tokens):
- ✅ **Context7** (0.9k) - Library documentation
- ✅ **Supabase** (3.2k) - Database, auth, storage

**Disabled for Token Efficiency**:
- ❌ Notion (21k) - Heavy token cost
- ❌ Canva (14k) - Not needed for this project
- ❌ Sentry (9k) - Use SDK instead

**Token Budget**: Keep MCP servers under 10k tokens (~5% of context)

## Essential MCP Operations

### Context7 (Documentation)

**Use this BEFORE implementing any library feature:**

```typescript
// Step 1: Find the library
mcp_context7_resolve-library-id({
  libraryName: "react",
  query: "how to use useEffect"
})

// Step 2: Query specific docs
mcp_context7_query-docs({
  libraryId: "/facebook/react",
  query: "useEffect cleanup function examples"
})
```

**When to use:**
- Implementing unfamiliar library features
- Debugging library-specific issues
- Checking latest API syntax/patterns
- Preventing hallucinations about library usage

**Limits**: Max 3 calls per question (use best result if no match found)

### Supabase MCP (Backend)

**Common operations:**

```typescript
// List tables
mcp_supabase_list_tables({
  project_id: "watheq-project",
  schemas: ["public"]
})

// Execute SQL
mcp_supabase_execute_sql({
  project_id: "watheq-project",
  query: "SELECT * FROM users WHERE id = $1",
  params: [userId]
})

// Run migration
mcp_supabase_apply_migration({
  project_id: "watheq-project",
  migration: "ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0"
})

// Check health
mcp_supabase_get_advisors({
  project_id: "watheq-project"
})
```

**Best practices:**
- Always `list_tables` before writing queries
- Use `get_advisors` after DDL changes
- Parameterize queries to prevent SQL injection

## MCP Usage Patterns

### Before Any Implementation
```
1. Context7: resolve-library-id → query-docs
2. Verify latest syntax/patterns
3. Implement with confidence
4. Run quality:parallel
```

### Debugging External Library Issues
```
1. Context7: query-docs for the specific error
2. Check if API has changed
3. Apply fix based on latest docs
```

### Database Work
```
1. Supabase: list_tables to check schema
2. Supabase: execute_sql for queries
3. Verify with get_advisors for health check
```

## Token Optimization Guidelines

### When to Enable Additional MCPs
**Only enable if:**
- Actively needed for current task
- Benefit outweighs 10k+ token cost
- User explicitly requests it

**Otherwise:**
- Use SDKs directly (Sentry SDK, not MCP)
- Use web APIs (GitHub CLI, not GitHub MCP)
- Use local tools (file operations)

### Monitoring Token Usage
```bash
# Check current context usage
/context

# Alert user if MCP tools > 10k tokens
```

### Cost-Benefit Analysis
| MCP Server | Token Cost | When Worth It |
|------------|-----------|---------------|
| Context7 | 0.9k | Always (prevents hallucinations) |
| Supabase | 3.2k | Database operations |
| Notion | 21k | Only if specs/docs live there |
| GitHub | ~5k | Extensive PR automation needed |
| Puppeteer | ~6k | Complex browser testing |

## Quick Reference: Common Tasks

### Research Library Syntax
```bash
# Pattern
context7: resolve-library-id("react") → query-docs("/facebook/react", "hooks")
```

### Check Supabase Schema
```bash
# Pattern
supabase: list_tables(project, ["public"]) → execute_sql("SELECT...")
```

### Verify Database Health
```bash
# Pattern
supabase: get_advisors(project) → check for warnings
```

## Watheq-Specific Integrations

### Credits System
- Use Supabase MCP for credit operations
- Table: `user_credits` (user_id, credits, last_updated)
- Sync with CreditsContext.tsx

### Resume Storage
- Table: `resumes` (user_id, resume_data, created_at)
- Use execute_sql for CRUD operations

### Referral Tracking
- Table: `referrals` (referrer_id, referred_id, reward_credits)
- Query via Supabase MCP for analytics

---

> **Remember**: Always use Context7 before implementing library features. Keep MCP token usage under 10k for optimal performance.
