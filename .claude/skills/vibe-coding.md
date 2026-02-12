---
name: vibe-coding
description: High-velocity, intent-driven development using agentic workflows and MCP servers
---

# Vibe Coding Skill

Operate as a high-velocity coder: express intent, orchestrate tools, build fast.

## When to Use
- Rapid prototyping
- Intent-based requests ("make it feel modern")
- Complex multi-step implementations
- When user wants minimal back-and-forth

## 1. Core Principles

- **Intent over Implementation**: Focus on outcome, not every CSS property
- **Agentic Orchestration**: Break complex tasks into sub-tasks
- **Zero Friction**: Resolve trivial blockers proactively

## 2. Tool Priority

| Tool | When to Use |
|------|-------------|
| `context7` | Always—verify library docs before coding |
| `WebSearch` | Find "best-in-class" examples and trends |
| `supabase-mcp-server` | Database operations, auth, storage |
| `Bash` | Build, lint, test after significant changes |

## 3. Engagement Patterns

```tsx
// Instant Feedback Example
<button
  onClick={handleSave}
  className="btn-primary"
  disabled={isSaving}
>
  {isSaving ? <Spinner /> : <CheckIcon />}
  {isSaving ? 'Saving...' : 'Saved!'}
</button>

// Micro-onboarding Tooltip
<Tooltip content="Click here to get started">
  <InfoIcon />
</Tooltip>
```

### Quick Wins
- Glowing buttons on success
- Progress indicators for async ops
- Subtle tooltips for new features
- Empty states that guide users

## 4. Automation

After significant changes, run project quality checks:
```bash
npm run quality:parallel  # 2-3x faster than sequential
```

## 5. Code Style

- Prefer fewer lines of code
- Use latest stable ES features
- Self-documenting variable names
- Extract repeated logic into helpers

## 6. Watheq-Specific Patterns

### Saudi Green Theme Integration
```typescript
// Use brand colors consistently
const colors = {
  primary: '#006C35',  // Saudi Green
  accent: '#D4AF37',   // Warm Gold
  surface: 'rgba(0, 108, 53, 0.1)', // Glassmorphism
};
```

### Credit-Aware Components
```tsx
import { useCredits } from '@/contexts/CreditsContext';

function FeatureButton() {
  const { credits, deductCredits } = useCredits();

  return (
    <button
      onClick={() => deductCredits(1, 'feature_name')}
      disabled={credits < 1}
    >
      Use Feature ({credits} credits)
    </button>
  );
}
```

### RTL Support
```tsx
// Automatic RTL detection for Arabic resumes
const dir = resume.basics?.language === 'ar' ? 'rtl' : 'ltr';
return <div dir={dir}>...</div>;
```

---

> **Cross-reference**: See `debug-score` for scoring bug protocols, `best-practices` for UI/UX standards.
