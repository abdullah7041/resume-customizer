# Claude Code Quick Reference

Fast reference for common workflows and commands.

---

## 🔧 Available Skills & Commands

### Debugging
```bash
/debug-score        # Systematic scoring bug analysis with root cause tracing
/fix-lint          # Auto-fix linting issues
/test-component    # Run tests for specific component
```

### Development
```bash
/vibe-coding       # High-velocity development patterns
/decompose-task    # Break complex tasks into parallel subtasks
```

### Reference
```bash
/mcp-toolbox       # MCP server optimization guide
```

---

## 🚀 Common Workflows

### Fix a Scoring Bug
```bash
1. /debug-score
2. Provide: Expected score, actual score, repro steps
3. Claude traces complete data flow
4. Writes failing test first
5. Implements fix at root cause
6. Verifies test passes
```

### Add a Complex Feature
```bash
1. /decompose-task
2. Claude explores in parallel (frontend, backend, tests)
3. Consolidates findings
4. Creates implementation plan
5. Executes with quality checks
```

### Quick Quality Check
```bash
npm run quality:parallel  # 2-3x faster than sequential
```

---

## 📋 Quality Standards

**Must pass before commit**:
```bash
npm run type:check  # TypeScript: 0 errors
npm run lint        # ESLint: 0 warnings
npm run test        # Vitest: 0 failures
```

**Auto-fix available**:
```bash
npm run lint:fix    # Fix auto-fixable linting issues
npm run quality:fix # Auto-fix + run all checks
```

---

## 🎯 Automatic Behaviors (No Prompt Needed)

Claude automatically:
- ✅ Uses Context7 before implementing library features
- ✅ Runs `quality:parallel` after code modifications
- ✅ Fixes linting/TypeScript errors without asking
- ✅ Enters Plan Mode for 3+ file changes
- ✅ Creates Tasks (not Todos) for multi-session work
- ✅ Traces root causes for scoring bugs (if using /debug-score)

---

## 🔍 MCP Optimization

**Enabled** (~4k tokens):
- Context7 (0.9k) - Library docs
- Supabase (3.2k) - Database/auth

**Disabled** (token efficiency):
- Notion (21k)
- Canva (14k)
- Sentry (9k) - Use SDK instead

**Check usage**:
```bash
/context  # View current token usage
```

---

## 📁 File Locations

### Configuration
```
.claude/settings.json       # Hooks, auto-loaded files
.claude/settings.local.json # Personal overrides (gitignored)
```

### Documentation
```
CLAUDE.md                       # Main project guide
CLAUDE_CODE_BEST_PRACTICES.md   # 2026 best practices
.claude/README.md               # Configuration guide
.claude/QUICK_REFERENCE.md      # This file
```

### Skills
```
.claude/skills/debug-score.md       # Scoring bug protocol
.claude/skills/vibe-coding.md       # High-velocity patterns
.claude/skills/mcp-toolbox.md       # MCP reference
.claude/skills/typescript-strict.md # Type standards
```

---

## 🐛 Debugging Checklist

**Before implementing any fix**:
- [ ] Traced complete data flow (source → display)
- [ ] Identified root cause (not symptom)
- [ ] Wrote failing test capturing expected behavior
- [ ] Confirmed fix addresses ROOT CAUSE
- [ ] Verified test passes after fix
- [ ] Ran `quality:parallel` with 0 errors

---

## 🎨 Watheq-Specific Patterns

### Brand Colors
```typescript
const colors = {
  primary: '#006C35',  // Saudi Green
  accent: '#D4AF37',   // Warm Gold
};
```

### Storage Keys
```typescript
localStorage.setItem('watheq:resumeData', ...);
localStorage.getItem('watheq:lastJobDescription');
```

### Credit Operations
```typescript
import { useCredits } from '@/contexts/CreditsContext';
const { credits, deductCredits } = useCredits();
```

---

## 📊 Project Stats (As of 2026-02-05)

- **Sessions**: 1,397 total
- **Commits**: 190 made by Claude
- **Tests**: 298 (100% passing)
- **Bug Focus**: 810 bug_fix sessions (97% of work)
- **Context Usage**: ~7k / 200k tokens (3.5%)

---

## 🚫 Anti-Patterns (Don't Do This)

| ❌ Wrong | ✅ Right |
|---------|---------|
| Fix display without checking calculation | Use `/debug-score` to trace root cause |
| Enable Notion MCP "just in case" | Only enable if actively needed |
| Use Opus for simple bug fixes | Use Sonnet (10x cheaper) |
| Ask permission to fix lint errors | Auto-fix immediately |
| Use `any` type | Define proper interfaces |
| Create Todos for complex features | Create Tasks with dependencies |

---

## 💡 Pro Tips

1. **Use shortcuts**: `/debug-score` instead of "debug the scoring issue"
2. **Batch changes**: Ask for multiple files in one prompt (50% fewer tokens)
3. **Check hooks**: `git commit` will auto-run type:check and lint
4. **Monitor context**: Run `/context` before large tasks
5. **Trust the process**: Follow `/debug-score` protocol even if it feels slow upfront

---

## 🆘 Troubleshooting

### Skills Not Working
```bash
# Verify skill exists
ls .claude/skills/

# Check frontmatter has "name: skill-name"
cat .claude/skills/SKILL_NAME.md
```

### Hooks Not Running
```bash
# Check settings
cat .claude/settings.json

# Verify command exists
npm run type:check
npm run lint
```

### Tests Failing
```bash
# Run specific test file
npm run test -- src/__tests__/COMPONENT.test.jsx

# Watch mode for debugging
npm run test:watch
```

---

## 📚 Full Documentation

For complete details, see:
- [.claude/README.md](.claude/README.md) - Configuration guide
- [.claude/IMPLEMENTATION_SUMMARY.md](.claude/IMPLEMENTATION_SUMMARY.md) - What was implemented
- [CLAUDE.md](../CLAUDE.md) - Main project documentation
- [Insights Report](file://C:\Users\NoteBook Pc\.claude\usage-data\report.html) - Usage analysis

---

**Last Updated**: 2026-02-05
**Quick Start**: Try `/debug-score` on your next scoring bug!
