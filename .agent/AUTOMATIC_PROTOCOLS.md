# Claude's Automatic Protocols (Internal Reference)

**This file is Claude's quick reference for automatic behaviors. User never needs to prompt for these.**

---

## 🔄 Every Session Start

✅ Load CLAUDE.md and CLAUDE_CODE_BEST_PRACTICES.md
✅ Remember MCP setup: Supabase (3.2k) + Context7 (0.9k) only
✅ Ready to use context7 for research
✅ Ready to enter Plan Mode for complex tasks
✅ Ready to decompose multi-domain work

---

## 🎯 Before Writing Code

**ALWAYS (no exceptions):**
1. Use `context7 mcp` → `resolve-library-id` → `query-docs` for unfamiliar libraries
2. Read `.agent/skills/best-practices/SKILL.md` if uncertain
3. Check `/context` if task seems large (monitor token usage)

---

## 📋 Task Classification (Automatic)

### Use Plan Mode + Tasks:
- 3+ files will be modified
- Architecture decisions needed
- Multi-session projects
- Complex features (auth, payments, etc.)

### Use Task Decomposition:
- Multi-domain work (frontend + backend + tests)
- Complex refactoring
- New major features

### Use Simple Todos:
- Single file edits
- Quick fixes
- Simple implementations

---

## ✅ After Writing Code (Automatic)

**Post-task hook runs automatically:**
```bash
npm run quality:parallel  # Lint + TypeScript + Tests in parallel
```

**If fails:**
1. Run `npm run lint:fix` to auto-fix
2. Manually fix remaining TypeScript errors
3. Re-run `quality:parallel`
4. Never ask permission - just fix it

---

## 🤖 Model Recommendations (Automatic)

| Task Type | Model | Why |
|-----------|-------|-----|
| Simple edits, reading files | Haiku | Fast, cheap |
| Feature implementation | Sonnet | Best balance |
| Architecture, complex refactors | Opus | Highest reasoning |

**Alert user if Opus recommended and they have budget constraints ($5 = only 0.6 Opus sessions)**

---

## 🚫 Never Do This (Anti-Patterns)

- ❌ Skip context7 research for libraries
- ❌ Suggest enabling Notion/Canva/Sentry MCPs
- ❌ Ask permission to fix linting/TypeScript errors
- ❌ Mark task complete with failing tests
- ❌ Use Todos for multi-session projects (use Tasks)
- ❌ Use Opus for simple bug fixes

---

## 📊 MCP Context Awareness

**Current optimized setup:**
- Enabled: Supabase (3.2k) + Context7 (0.9k) = ~4k tokens
- Disabled: Notion (21k), Canva (14k), Sentry (9k)
- Target: Keep total MCP under 10k tokens

**If user requests new MCP server:**
- Warn about token cost
- Suggest disabling if not actively needed

---

## 🎯 Tasks Feature (2026)

**Use numbered Tasks (#1, #2, #3) for:**
- Multi-session projects
- Dependencies (`blocked by #1`)
- Long-running features

**Syntax:**
```
□ #1 Research patterns
□ #2 Implement feature › blocked by #1
□ #3 Write tests › blocked by #2
```

**Use simple Todos for:**
- Single-session work
- No dependencies
- Quick fixes

---

## 🔍 Quality Standards (Non-Negotiable)

**Must pass before task complete:**
- ✅ ESLint: 0 warnings
- ✅ TypeScript: 0 errors
- ✅ Vitest: 0 failures

**Auto-fix immediately:**
- Missing types → Add interfaces
- Unused imports → Remove
- Missing keys → Add unique keys
- `any` types → Replace with proper types

---

## 📚 Reference Documentation

**Auto-loaded:**
- `CLAUDE.md` - Main project guide
- `CLAUDE_CODE_BEST_PRACTICES.md` - Complete 2026 practices
- `.agent/skills/best-practices/SKILL.md` - Research protocol

**User can reference:**
- `TASK_DECOMPOSITION.md` - Parallel agent workflows
- `TASKS_FEATURE_GUIDE.md` - Tasks vs Todos
- `API_COST_ANALYSIS.md` - Budget optimization
- `AI_ALTERNATIVES.md` - Alternative tools

---

**Remember: These are AUTOMATIC. User never needs to ask for any of these behaviors.**
