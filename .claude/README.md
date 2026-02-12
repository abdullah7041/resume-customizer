# Claude Code Configuration

This folder contains all Claude Code-specific configuration for the Watheq project.

## Structure

```
.claude/
├── README.md           # This file
├── settings.json       # Claude Code settings (auto-loaded)
├── settings.local.json # Local overrides (gitignored)
├── skills/            # Invocable skills (use with /skill-name)
│   ├── debug-score.md       # Systematic scoring bug debugging
│   ├── vibe-coding.md       # High-velocity development patterns
│   ├── mcp-toolbox.md       # MCP server reference
│   ├── typescript-strict.md # TypeScript standards
│   ├── tailwind-patterns.md # Tailwind CSS patterns
│   └── react-best-practices.md # React conventions
├── commands/          # Simple commands
│   ├── fix-lint.md         # Auto-fix linting issues
│   └── test-component.md   # Test component workflow
└── plans/             # Implementation plans (historical)
    └── ...
```

## Settings Configuration

### Current Settings (`settings.json`)

**Auto-loaded Files**:
- `CLAUDE.md` - Main project documentation
- `CLAUDE_CODE_BEST_PRACTICES.md` - 2026 best practices
- `.agent/AUTOMATIC_PROTOCOLS.md` - Quick reference protocols

**Hooks**:
- **preCommit**: Run TypeScript + linting checks before commits
- **postTask**: Run `quality:parallel` after code modifications

### Local Overrides (`settings.local.json`)

Create this file for personal preferences (gitignored):

```json
{
  "postTask": {
    "commands": [
      {
        "command": "npm run quality:parallel",
        "description": "Quality checks",
        "enabled": false
      }
    ]
  }
}
```

## Skills Reference

### Invoke with `/skill-name`

| Skill | Command | Use Case |
|-------|---------|----------|
| **debug-score** | `/debug-score` | Systematic scoring bug debugging with root cause analysis |
| **vibe-coding** | `/vibe-coding` | High-velocity development patterns |
| **mcp-toolbox** | `/mcp-toolbox` | MCP server reference and optimization |

**Note**: Skills are NOT automatically invoked. You must explicitly use `/skill-name` or reference them manually.

### Built-in Commands

| Command | Use Case |
|---------|----------|
| `/fix-lint` | Auto-fix linting issues |
| `/test-component` | Run tests for specific component |

## How Claude Uses This Folder

### Automatic Loading
Claude Code automatically:
1. Reads files listed in `settings.json` → `files.read[]`
2. Executes hooks based on lifecycle events
3. Makes skills available via `/skill-name` commands

### Manual Invocation Required
Skills are NOT auto-loaded into context. To use them:
- Type `/debug-score` to invoke the debug-score skill
- Type `/vibe-coding` to invoke vibe-coding patterns
- Reference them in prompts: "Follow the debug-score protocol"

## Token Optimization

**Current Context Usage**:
- Settings + auto-loaded files: ~2k tokens
- MCP servers (Context7 + Supabase): ~4k tokens
- **Total overhead**: ~6k tokens (3% of 200k context)

**Best Practices**:
- Keep `files.read[]` minimal (only essential docs)
- Don't auto-load all skills (invoke on-demand)
- Monitor with `/context` command
- Target: Keep configuration under 10k tokens

## Adding New Skills

1. Create `SKILL_NAME.md` in `.claude/skills/`
2. Use frontmatter:
```markdown
---
name: skill-name
description: Brief description of what this skill does
---

# Skill Name

Content here...
```

3. Invoke with `/skill-name` when needed

## Adding New Hooks

Edit `.claude/settings.json`:

```json
{
  "hooks": {
    "preCommit": [
      {
        "command": "npm run custom-check",
        "description": "Custom pre-commit check",
        "enabled": true
      }
    ],
    "postTask": [
      {
        "command": "npm run quality:parallel",
        "description": "Quality checks",
        "enabled": true
      }
    ]
  }
}
```

**Available Hooks**:
- `preCommit` - Before git commits
- `postTask` - After completing tasks
- `preTask` - Before starting tasks (rarely used)

## Comparison: .claude vs .agent

| Folder | Purpose | Auto-loaded | Token Usage |
|--------|---------|-------------|-------------|
| `.claude/` | Official Claude Code config | Yes (via settings.json) | ~6k tokens |
| `.agent/` | Legacy custom organization | No (unless referenced) | 0 tokens |

**Recommendation**: Use `.claude/` for all Claude Code configuration. The `.agent/` folder is not recognized by Claude Code natively.

## Migration from .agent to .claude

**Completed**:
- ✅ Moved `vibe-coding` skill to `.claude/skills/`
- ✅ Moved `mcp-toolbox` reference to `.claude/skills/`
- ✅ Consolidated `best-practices` into auto-loaded protocols
- ✅ Created new `debug-score` skill based on insights report

**Remaining .agent/ files**:
- `.agent/AUTOMATIC_PROTOCOLS.md` - Still referenced in settings.json (keeping for now)
- `.agent/workflow-diagram.md` - Historical reference (can delete)
- `.agent/skills/` - Legacy folder (can delete after verification)

## Quality Checks

All hooks are configured to enforce quality standards:

```bash
# Pre-commit checks
npm run type:check  # TypeScript validation
npm run lint        # ESLint validation

# Post-task checks
npm run quality:parallel  # All checks in parallel (2-3x faster)
```

**Standards**:
- ✅ ESLint: 0 warnings
- ✅ TypeScript: 0 errors
- ✅ Vitest: 0 failures

## Troubleshooting

### Skills Not Available
**Problem**: `/skill-name` doesn't work
**Solution**:
1. Check frontmatter has `name: skill-name`
2. Verify file is in `.claude/skills/` or `.claude/commands/`
3. Restart Claude Code CLI

### Hooks Not Running
**Problem**: Post-task hook not executing
**Solution**:
1. Check `settings.json` has `"enabled": true`
2. Verify command exists: `npm run quality:parallel`
3. Check `.claude/settings.local.json` for overrides

### Token Budget Exceeded
**Problem**: Context usage too high
**Solution**:
1. Run `/context` to see usage
2. Remove non-essential files from `settings.json`
3. Disable heavy MCP servers (Notion, Canva)
4. Keep MCP under 10k tokens

## References

- [Claude Code Documentation](https://github.com/anthropics/claude-code)
- [CLAUDE.md](../CLAUDE.md) - Main project guide
- [CLAUDE_CODE_BEST_PRACTICES.md](../CLAUDE_CODE_BEST_PRACTICES.md) - Best practices
- [TASK_DECOMPOSITION.md](../TASK_DECOMPOSITION.md) - Task decomposition patterns

---

**Last Updated**: 2026-02-05 (after insights report recommendations)
