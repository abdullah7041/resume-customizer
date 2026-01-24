# Claude Code Best Practices (2026 Edition)

Quick reference for optimized Claude Code workflows based on latest features and research.

---

## 🚀 Quick Wins (Do These First)

### 1. MCP Server Optimization (91% Token Savings)
```json
// .claude/settings.local.json
{
  "enableAllProjectMcpServers": false,
  "enabledMcpjsonServers": ["supabase", "context7"]
}
```

**Result**: 47.9k → 4k tokens (43.9k savings per session)

**Rule**: Only enable servers you actively need. Disable heavy ones:
- ❌ Notion (21k tokens) - unless you integrate Notion
- ❌ Canva (14k tokens) - unless you use Canva API
- ❌ Sentry (9k tokens) - use SDK, not MCP for development

---

### 2. Task Decomposition (For Complex Work)

**When**: 3+ step tasks (auth, refactors, performance optimization)

**Pattern**:
1. Break into 2-3 independent subtasks
2. Launch Explore agents in parallel
3. Consolidate in Plan mode
4. Execute with quality checks

**Usage**: Type `/decompose-task` or reference [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md)

**Example**:
```
User: "Add authentication to the app"

Claude launches 3 agents in parallel:
- Agent 1: Explore Supabase auth patterns
- Agent 2: Explore state management (Zustand)
- Agent 3: Explore API route protection
```

---

### 3. Parallel Quality Checks (2-3x Faster)

```bash
# Instead of sequential:
npm run quality:check  # lint → type:check → test (slow)

# Use parallel:
npm run quality:parallel  # All run simultaneously (fast)
```

**Setup**: Already configured in your `package.json:17`

---

### 4. Model Selection Strategy

| Task Complexity | Model | Why |
|----------------|-------|-----|
| Simple edits, explanations | **Haiku** | Fast, cheap, sufficient |
| Feature implementation, debugging | **Sonnet** | Best balance |
| Architecture, complex refactors | **Opus** | Highest reasoning |

**Cost Impact** ($5 budget):
- Sonnet: 9 sessions
- Sonnet + thinking: 4 sessions
- Opus + thinking: 0.6 sessions ❌

---

## 📋 Pre-Task Checklist

Before starting ANY coding task:

1. **Check Context**: Run `/context` to see token usage
2. **Research First**: Use `context7 mcp` → `resolve-library-id` → `query-docs`
3. **Plan Complex Tasks**: Use EnterPlanMode for 3+ file changes
4. **Decompose if Needed**: For multi-domain tasks (frontend + backend + tests)

---

## 🎯 During Development

### Always Use These Tools

```bash
# Research library best practices
context7 → resolve-library-id("react-pdf") → query-docs

# Search for 2026 trends
search_web("React 19 best practices 2026")

# Monitor your session cost
/context  # Check token usage
```

### Never Do This

- ❌ Skip research for unfamiliar libraries
- ❌ Enable all MCP servers "just in case"
- ❌ Use Opus for simple bug fixes
- ❌ Forget to run quality checks

---

## ✅ Post-Task Protocol (Non-Negotiable)

Your `.claude/settings.json` **automatically** runs:
```bash
npm run quality:check  # After every code modification
```

**Must pass**:
- ✅ ESLint (0 warnings)
- ✅ TypeScript (0 errors)
- ✅ Vitest (0 failures)

**If fails**: Fix immediately, don't ask permission.

---

## 🔧 Context Window Management

### Your Current Breakdown (After Optimization)

| Category | Tokens | % of Window |
|----------|--------|-------------|
| System + Tools | 20k | 10% |
| **MCP Tools** | **4k** | **2%** (was 23.9%) |
| Memory Files | 4.6k | 2% |
| **Free Space** | **126k** | **63%** |
| Autocompact Buffer | 45k | 23% |

**Goal**: Keep MCP under 10k tokens (5% of window)

### How to Monitor

```bash
# In Claude Code chat:
/context

# Expected after optimization:
# MCP tools: ~4k tokens
# - mcp__supabase__* (20 tools)
# - mcp__context7__* (2 tools)
```

---

## 🎨 Premium UI Standards (From best-practices Skill)

### Always Apply

```css
/* Glassmorphism */
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.2);

/* Micro-interactions */
transition: transform 0.2s ease;
&:hover { transform: translateY(-2px); }

/* HSL Gradients (not flat colors) */
background: linear-gradient(135deg, hsl(240, 80%, 60%), hsl(280, 90%, 50%));
```

### Accessibility Checklist

- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast >= 4.5:1

---

## 💰 Cost Optimization (API Usage)

### Prompt Caching (Automatic)

**First message**: Full context cost
**Subsequent messages**: 90% cached (10x cheaper)

**Impact**:
- Without caching: $1.15/session
- With caching: $0.53/session (54% savings)

### Smart Model Switching

```
Simple tasks → Haiku ($0.05/session)
Regular coding → Sonnet ($0.53/session)
Architecture → Opus ($2.67/session)
```

**$5 Budget Strategy**:
- 8 Sonnet sessions
- 20 Haiku queries for simple stuff
- Save 1 Opus session for critical decisions

---

## 🔄 Tasks vs Todos (New Feature - 2026)

### What Changed

**Old (TodoWrite)**: Simple tracking for current session
**New (Tasks)**: Persistent across sessions, supports blocking, collaboration

### When to Use Tasks (Plan Mode)

```
User: "Help me implement feature X"

Claude enters Plan Mode:
1. Creates Tasks (not Todos)
2. Tasks persist across sessions
3. Can mark dependencies (#1 blocks #2)
4. Tracks progress long-term
```

**Screenshot shows**: Tasks with blocking relationships (dinner party example)

### Testing Tasks Feature

```bash
# 1. Enter Plan Mode for complex task
"Plan how to add user authentication"

# 2. Claude creates Tasks (not Todos)
# Tasks will show:
# □ #1 Research Supabase auth patterns
# □ #2 Set up auth context › blocked by #1
# □ #3 Implement login UI › blocked by #2

# 3. Tasks persist across sessions
# Close and reopen Claude Code
# Tasks remain, you can continue where you left off
```

**Key Difference**:
- **Todos**: Simple, session-only, no dependencies
- **Tasks**: Advanced, persistent, supports blocking, collaboration

---

## 🛠️ Tool Priority Order

### For Library Research
1. **context7** - Latest docs (always first)
2. **search_web** - 2026 trends, examples
3. **Read files** - Existing patterns in your codebase

### For Debugging
1. **Explore agent** - Find related code
2. **Grep** - Search error patterns
3. **Read** - Understand implementation
4. **context7** - Check if library has known issues

### For Implementation
1. **Plan Mode** - For 3+ file changes
2. **Decompose** - For multi-domain tasks
3. **Write/Edit** - Make changes
4. **quality:parallel** - Verify correctness

---

## 📊 Success Metrics

### Track These Weekly

```bash
# 1. Context usage trend
/context  # Should stay under 40k tokens

# 2. Quality check pass rate
npm run quality:parallel  # Should be 100%

# 3. Session efficiency
# Sessions per task (lower = better decomposition)

# 4. Cost per session (API users)
# Target: <$0.60 for Sonnet sessions
```

---

## 🚨 Common Pitfalls

### ❌ Anti-Patterns

1. **Enabling all MCP servers** → 47k token waste
2. **Skipping research** → Outdated patterns
3. **Using Opus for everything** → Budget blown in 2 sessions
4. **Not using Plan Mode** → Incomplete complex tasks
5. **Ignoring quality failures** → Technical debt accumulates

### ✅ Best Practices

1. **Selective MCP enabling** → 4k tokens, lean context
2. **context7 first** → Latest library docs
3. **Right model for task** → Cost-effective
4. **Plan for 3+ files** → Comprehensive approach
5. **Auto-fix on save** → Zero-error policy

---

## 🎓 Learning Resources

### Created for This Project

1. **[TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md)** - Parallel agent workflows
2. **[AI_ALTERNATIVES.md](AI_ALTERNATIVES.md)** - Cline, Continue.dev, Aider comparison
3. **[API_COST_ANALYSIS.md](API_COST_ANALYSIS.md)** - Budget planning for API usage
4. **[Plan](~/.claude/plans/ticklish-brewing-rossum.md)** - Full research findings

### Agent Skills (In `.agent/skills/`)

1. **best-practices** - Research protocol, UI standards, MCP optimization
2. **vibe-coding** - High-velocity development patterns
3. **mcp-toolbox** - MCP server reference guide

### Project Skills (In `.claude/skills/`)

1. **typescript-strict** - Type safety enforcement
2. **tailwind-patterns** - Watheq design system (Saudi Green theme)
3. **react-best-practices** - React 19 + Zustand patterns

---

## 🎯 Quick Command Reference

```bash
# Context management
/context                    # Check token usage
/decompose-task            # Break complex tasks into parallel agents

# Quality checks
npm run quality:parallel   # Fast parallel checks
npm run quality:check      # Sequential (slower)
npm run lint:fix           # Auto-fix linting issues

# Development
npm run dev                # Vite dev server (port 5173)
npm run dev:netlify        # Netlify dev (port 8888, includes functions)
npm run build              # Production build
npm run test:watch         # Watch mode for tests
```

---

## 🏆 Daily Workflow (Recommended)

### Morning Setup
1. Check `/context` to verify MCP optimization
2. Review Tasks from previous session (if using Plan Mode)
3. Run `npm run quality:check` to ensure clean state

### During Coding
1. Use `context7` for library research
2. Enter Plan Mode for complex features (3+ files)
3. Decompose multi-domain tasks into parallel agents
4. Run `quality:parallel` after significant changes

### Before Committing
1. `npm run quality:fix` - Auto-fix what can be fixed
2. Manually fix remaining TypeScript errors
3. Verify all tests pass
4. Pre-commit hook runs automatically (Husky)

### End of Day
1. Review `/context` usage trends
2. Note any MCP servers that could be disabled
3. Update Tasks status if working on long-term features

---

## 📈 Optimization Roadmap

### Week 1 (Done ✅)
- ✅ Optimize MCP servers (47.9k → 4k tokens)
- ✅ Add parallel quality checks
- ✅ Create task decomposition template
- ✅ Document AI alternatives

### Week 2-4 (Next Steps)
- [ ] Test new Tasks feature in Plan Mode
- [ ] Try Cline in VS Code (compare with Claude Code)
- [ ] Measure cost savings with API approach
- [ ] Set up budget tracker for API usage

### Month 2-3 (Future)
- [ ] Install Sequential Thinking MCP server
- [ ] Set up Puppeteer MCP for E2E tests
- [ ] Evaluate hybrid Claude Code + Cline workflow
- [ ] Train team on parallel agent patterns

---

## 🎉 Key Takeaways

1. **MCP Optimization**: Biggest win - 91% token reduction
2. **Task Decomposition**: 2-3x faster for complex work
3. **Parallel Quality**: No excuse for failing checks
4. **Model Selection**: Right tool for the job saves money
5. **Prompt Caching**: 54% cost savings automatically
6. **Tasks Feature**: Use Plan Mode for persistent tracking
7. **Open Source Tools**: Cline/Continue.dev for flexibility

---

**Remember**: These practices compound. Small optimizations (MCP servers, caching, model selection) add up to 10x efficiency gains over time.

**Next Action**: Run `/context` to verify your MCP optimization worked!
