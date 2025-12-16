# Test Component

1. Run tests for the specified component
2. If tests fail, analyze and fix
3. If no tests exist, create them
```bash
npm run test -- --filter=$COMPONENT_NAME
```
```

---

### 3. Tricks to reduce Opus usage?

**Yes, several:**

| Trick | How | Savings |
|-------|-----|---------|
| **Use Sonnet for simple tasks** | Prefix prompts with `@sonnet` in Claude Code | 10x cheaper |
| **Batch related changes** | Ask for multiple files in one prompt instead of one-by-one | 50% fewer tokens |
| **Provide context upfront** | Paste relevant code snippets instead of making Claude search | Fewer tool calls |
| **Use `/compact` mode** | Reduces verbosity | ~30% fewer output tokens |
| **Create templates** | Save common prompts in `.claude/commands/` | Consistent, minimal prompts |

**Specific to your workflow:**
```
# Instead of:
"Fix the template toggle"
"Now fix the merge function"
"Now update the types"

# Do this:
"Fix the template system: 
1. Make toggle work (connect state to renderer)
2. Fix merge function (combine original + optimized)
3. Update TypeScript types
Show me all files in one response."