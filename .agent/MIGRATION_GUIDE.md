# .agent → .claude Migration Guide

This folder (`.agent/`) was a custom organization structure that is NOT natively recognized by Claude Code. All useful content has been migrated to `.claude/` folder.

---

## Migration Status

### ✅ Migrated to .claude/

| Original File | New Location | Status |
|---------------|--------------|--------|
| `.agent/skills/vibe-coding/SKILL.md` | `.claude/skills/vibe-coding.md` | ✅ Migrated + Enhanced |
| `.agent/skills/mcp-toolbox/SKILL.md` | `.claude/skills/mcp-toolbox.md` | ✅ Migrated + Enhanced |
| `.agent/skills/best-practices/SKILL.md` | Consolidated into CLAUDE.md | ✅ Integrated |

### ⚠️ Still Referenced

| File | Referenced In | Action |
|------|--------------|--------|
| `.agent/AUTOMATIC_PROTOCOLS.md` | `.claude/settings.json` line 6 | Keep for now |

### 🗑️ Can Be Deleted

| File | Reason |
|------|--------|
| `.agent/skills/` | All skills migrated to `.claude/skills/` |
| `.agent/workflow-diagram.md` | Historical reference, no longer needed |

---

## Cleanup Commands

**Option 1: Delete Safely (Recommended)**

```bash
# 1. Verify everything works with new structure
cd C:\Users\NoteBook Pc\Desktop\resume-customizer

# 2. Test skills are working
# (Try /debug-score, /vibe-coding, /decompose-task)

# 3. Delete migrated content
rm -rf .agent/skills/

# 4. Delete historical files
rm .agent/workflow-diagram.md

# 5. Keep .agent/AUTOMATIC_PROTOCOLS.md for now
# (still referenced in .claude/settings.json)
```

**Option 2: Archive Instead of Delete**

```bash
# Create archive
mkdir -p .archive
mv .agent/skills/ .archive/agent-skills-backup-2026-02-05/
mv .agent/workflow-diagram.md .archive/

# .agent/AUTOMATIC_PROTOCOLS.md stays
```

---

## What Happens After Cleanup

### Before
```
.agent/
├── AUTOMATIC_PROTOCOLS.md        # Referenced in settings.json
├── workflow-diagram.md            # Not used
└── skills/
    ├── best-practices/SKILL.md    # Not auto-loaded
    ├── vibe-coding/SKILL.md       # Not auto-loaded
    └── mcp-toolbox/SKILL.md       # Not auto-loaded
```

### After
```
.agent/
└── AUTOMATIC_PROTOCOLS.md        # Still referenced (keep)
```

All skills now accessible via `.claude/skills/` with `/skill-name` commands.

---

## Why .agent/ Wasn't Working

**Issue**: Claude Code does NOT automatically recognize `.agent/` folder.

**Evidence**:
- Skills in `.agent/skills/` were NOT invocable via `/skill-name`
- Only `.agent/AUTOMATIC_PROTOCOLS.md` was loaded (explicitly referenced in settings.json)
- No native support in Claude Code CLI for `.agent/` structure

**Solution**: Use `.claude/` folder (official Claude Code configuration directory)

---

## How to Reference .agent/AUTOMATIC_PROTOCOLS.md Going Forward

**Current Setup** (Keep as-is):
```json
// .claude/settings.json
{
  "files": {
    "read": [
      "CLAUDE.md",
      "CLAUDE_CODE_BEST_PRACTICES.md",
      ".agent/AUTOMATIC_PROTOCOLS.md"  // Still referenced
    ]
  }
}
```

**Future Option** (Consolidate):
1. Copy content from `.agent/AUTOMATIC_PROTOCOLS.md` to `CLAUDE.md`
2. Remove `.agent/AUTOMATIC_PROTOCOLS.md` from settings.json
3. Delete `.agent/` folder completely

**Pros of consolidation**:
- Single source of truth (CLAUDE.md)
- Simpler folder structure
- Easier maintenance

**Cons of consolidation**:
- CLAUDE.md gets longer (but it's already long)
- Loses separation of "project docs" vs "Claude protocols"

**Recommendation**: Keep current setup unless CLAUDE.md becomes unwieldy.

---

## Token Impact

### Before Migration
- `.agent/AUTOMATIC_PROTOCOLS.md`: ~2k tokens (auto-loaded)
- `.agent/skills/`: 0 tokens (not auto-loaded)

### After Migration
- `.agent/AUTOMATIC_PROTOCOLS.md`: ~2k tokens (still auto-loaded)
- `.claude/skills/`: 0 tokens (invoked on-demand)

**No token difference** - Skills were never auto-loaded before or after migration.

---

## Verification Checklist

Before deleting `.agent/skills/`:

- [ ] `/vibe-coding` command works
- [ ] `/debug-score` command works (new)
- [ ] `/decompose-task` command works (new)
- [ ] `/mcp-toolbox` reference is available
- [ ] All skills listed in `/context` or skill help

If all checked, safe to delete `.agent/skills/`.

---

## Rollback Plan

If something breaks after deletion:

```bash
# 1. Restore from git
git checkout .agent/skills/

# 2. Or restore from archive
cp -r .archive/agent-skills-backup-2026-02-05/ .agent/skills/
```

---

## Summary

**Safe to delete NOW**:
- ✅ `.agent/skills/` folder (all content migrated)
- ✅ `.agent/workflow-diagram.md` (historical)

**Keep for now**:
- ⚠️ `.agent/AUTOMATIC_PROTOCOLS.md` (referenced in settings.json)

**Future consideration**:
- Consolidate `.agent/AUTOMATIC_PROTOCOLS.md` into `CLAUDE.md`
- Delete entire `.agent/` folder

---

**Last Updated**: 2026-02-05
**Migration Completed**: All skills now in `.claude/skills/`
