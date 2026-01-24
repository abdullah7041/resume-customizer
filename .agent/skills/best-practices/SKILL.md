---
name: best-practices
description: Ensure code and design follow the latest industry standards, premium UI/UX trends, and library documentation.
---

# Best Practices Skill

Proactively research latest standards before implementation.

## When to Use
- Adding new UI components
- Fixing bugs in libraries
- Refactoring existing code
- Performance optimization

## 1. Research Protocol

Before writing code, you MUST:

1. **Library Check**: Use `context7 mcp` → `resolve-library-id` → `query-docs`
2. **Design Trends**: Use `search_web` for "2025/2026 [component] trends"
3. **Performance**: Check for modern optimizations (lazy loading, CSS-only animations)

## 2. Premium UI Standards

```css
/* Glassmorphism Example */
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}

/* Vibrant Gradient */
.gradient-bg {
  background: linear-gradient(135deg, hsl(240, 80%, 60%), hsl(280, 90%, 50%));
}

/* Micro-interaction */
.btn-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.btn-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
```

### Checklist
- [ ] Glassmorphism with blur + semi-transparent borders
- [ ] Micro-interactions (hover, focus, active states)
- [ ] HSL gradients, avoid flat colors
- [ ] Engagement loops (progress bars, success states)
- [ ] WCAG accessibility compliance

## 3. MCP Optimization (2026 Best Practice)

**Context Management**:
- Monitor token usage with `/context` command
- Only enable MCP servers actively needed for task
- Disable heavy servers (Notion: 21k, Canva: 14k tokens)
- Target: Keep MCP tools under 10k tokens (5% of context)

**For This Project**:
- ✅ Keep: `supabase` (3.2k), `context7` (0.9k)
- ❌ Disable: Notion, Canva, Sentry (use SDK instead)

## 4. Task Decomposition (2026 Pattern)

**For Complex Tasks** (3+ steps):
1. Break into parallel subtasks (max 3)
2. Launch Explore agents simultaneously
3. Consolidate in Plan mode
4. Execute with quality checks

**Example**: "Add authentication"
- Agent 1: Explore Supabase patterns
- Agent 2: Explore state management
- Agent 3: Explore API protection

**Use**: `/decompose-task` or reference `.claude/commands/decompose-task.md`

## 5. Execution Flow

1. **Discover**: Research using context7 + search_web
2. **Propose**: Explain WHY it's best practice
3. **Implement**: Use latest syntax
4. **Validate**: Test against research findings
5. **Quality**: Run `npm run quality:parallel` (2-3x faster)

## 6. Code Style

- Prefer fewer lines of code
- Use modern JS/TS: optional chaining (`?.`), nullish coalescing (`??`)
- Graceful degradation for unsupported features
- Always run quality checks after significant changes
