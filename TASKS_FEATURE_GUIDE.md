# Claude Code Tasks Feature Guide (2026)

Understanding the new Tasks primitive that replaces Todos for complex project management.

---

## 🆕 What Changed (January 2026)

**From Anthropic's Announcement**:
> "We're upgrading Todos in Claude Code to Tasks. Tasks are a new primitive that help Claude Code track and complete more complicated projects and collaborate on them across multiple sessions or subagents."

### Old: TodoWrite Tool
- ✅ Simple task tracking
- ✅ Current session only
- ❌ No persistence across sessions
- ❌ No dependency management
- ❌ No collaboration features

### New: Tasks System
- ✅ Persistent across sessions
- ✅ Dependency tracking (`blocked by #1, #2`)
- ✅ Multi-agent collaboration
- ✅ Long-running project support
- ✅ Better state tracking (Opus 4.5 optimized)

---

## 📸 Screenshot Analysis

Based on your screenshot, here's what the Tasks interface shows:

```
Tasks (4 done, 6 open) · ctrl+t to hide tasks

□ #1 Buy fresh pasta and marinara sauce
✓ #2 Buy chicken breasts and spice rub
□ #3 Buy salad greens, croutons, and Caesar dressing
✓ #4 Buy sourdough bread and butter
✓ #5 Buy lemons and olive oil
✓ #6 Marinate chicken for grilling
□ #7 Make garlic bread
□ #8 Prepare Caesar salad › blocked by #3
□ #9 Grill marinated chicken
□ #10 Host dinner party › blocked by #1, #7, #8, #9
```

### Key Features Visible

1. **Task Counter**: `4 done, 6 open` - Progress tracking
2. **Numbered Tasks**: `#1, #2, #3...` - Easy reference
3. **Checkboxes**: `□` (pending) vs `✓` (completed)
4. **Blocking Dependencies**: `› blocked by #3` - Task #8 can't start until #3 completes
5. **Multiple Dependencies**: `#10` blocked by 4 tasks - Complex dependency chains
6. **Keyboard Shortcut**: `ctrl+t` to toggle visibility

---

## 🎯 When to Use Tasks vs Todos

### Use Tasks (New System)
- ✅ Multi-session projects (authentication, refactoring)
- ✅ Complex dependencies (Task B needs Task A done first)
- ✅ Long-running features (spanning days/weeks)
- ✅ Collaboration across subagents
- ✅ Projects requiring state tracking

**Example**: "Implement user authentication system"
```
□ #1 Research Supabase auth patterns
□ #2 Design auth state management › blocked by #1
□ #3 Implement login UI › blocked by #2
□ #4 Add API route protection › blocked by #2
□ #5 Write integration tests › blocked by #3, #4
□ #6 Deploy to production › blocked by #5
```

### Use Todos (Legacy, Simple Tasks)
- ✅ Single-session work
- ✅ No dependencies
- ✅ Quick fixes, simple features
- ✅ When you don't need persistence

**Example**: "Fix typo in README"
```
1. Read README.md
2. Fix typo
3. Commit changes
```

---

## 🧪 How to Test the Tasks Feature

### Method 1: Trigger via Plan Mode

**Best way to see Tasks in action:**

```
User: "I need to add a complete user authentication system to my app.
       Please plan this out step by step with all dependencies."

Claude will:
1. Enter Plan Mode
2. Create Tasks (not Todos)
3. Show dependency chains
4. Persist across sessions
```

**Expected Output**:
```
Tasks (0 done, 8 open)

□ #1 Audit current authentication setup
□ #2 Research Supabase auth best practices 2026 › blocked by #1
□ #3 Design authentication state flow › blocked by #2
□ #4 Implement Zustand auth store › blocked by #3
□ #5 Create login/signup UI components › blocked by #3
□ #6 Add protected route middleware › blocked by #4
□ #7 Write authentication tests › blocked by #5, #6
□ #8 Document authentication flow › blocked by #7
```

---

### Method 2: Directly Request Tasks

**Simple approach:**

```
User: "Create Tasks for implementing the resume optimization feature
       with proper dependencies"

Claude will:
1. Break down the feature
2. Create Tasks with numbers (#1, #2, etc.)
3. Mark blocking relationships
4. You can continue across sessions
```

---

### Method 3: Complex Project with Subagents

**Advanced scenario:**

```
User: "I want to migrate from Gemini API to OpenRouter across the entire
       codebase. This affects 10+ files. Use task decomposition and track
       progress with Tasks."

Claude will:
1. Enter Plan Mode
2. Launch multiple Explore agents in parallel
3. Create Tasks for each migration step
4. Mark dependencies (e.g., "Update types" blocks "Update function calls")
5. Track which agents completed which tasks
```

---

## 📊 Tasks UI Features

### Task States

```
□ #1 Pending task
▶ #2 In progress task (currently active)
✓ #3 Completed task
```

### Dependency Syntax

```
□ #5 Task name › blocked by #3
          ↑                    ↑
      Visual indicator    Blocking task number(s)

□ #10 Complex task › blocked by #1, #7, #8, #9
                         ↑
                   Multiple blockers
```

### Keyboard Shortcuts

```
ctrl+t    Toggle tasks panel visibility
```

---

## 🔧 How Tasks Work Internally

### Persistence Mechanism

**Unlike Todos** (which disappear when session ends):

1. Tasks saved to persistent storage
2. Linked to project context
3. Survive Claude Code restarts
4. Can be resumed in new sessions

**Storage Location** (likely):
```
~/.claude/tasks/
  └── {project-hash}/
      └── tasks.json
```

### Dependency Resolution

When you mark `#3` as complete:
```
Before:
□ #3 Buy salad ingredients
□ #8 Prepare Caesar salad › blocked by #3

After marking #3 done:
✓ #3 Buy salad ingredients
□ #8 Prepare Caesar salad  (blocker removed, now actionable)
```

### State Tracking (Opus 4.5 Optimization)

**Why Opus 4.5 is mentioned**:
> "Opus 4.5 is able to run autonomously for longer and keep track of its state better."

Tasks leverage Opus 4.5's improved:
- Long-term memory
- State consistency
- Autonomous execution
- Multi-step planning

---

## 🎮 Interactive Testing Script

Try this exact prompt to see Tasks in action:

```
I want to test the new Tasks feature. Please create a realistic
software engineering project plan with:

1. 10-15 tasks total
2. At least 5 dependency relationships (use "blocked by")
3. Break it into phases (research, implementation, testing, deployment)
4. Make it something realistic for this resume-customizer project

Use the Tasks system (not Todos) so we can track this across sessions.
```

**Claude should respond with**:
```
Tasks (0 done, 12 open)

Research Phase:
□ #1 Analyze current resume parsing accuracy
□ #2 Research 2026 ATS best practices › blocked by #1
□ #3 Benchmark competitor tools › blocked by #1

Implementation Phase:
□ #4 Update parsing logic based on research › blocked by #2
□ #5 Enhance ATS optimization algorithms › blocked by #2
□ #6 Add new resume templates › blocked by #3

Testing Phase:
□ #7 Write unit tests for new parser › blocked by #4
□ #8 Create integration tests › blocked by #5, #6
□ #9 Run ATS simulation tests › blocked by #8

Deployment Phase:
□ #10 Update documentation › blocked by #7, #8, #9
□ #11 Deploy to staging › blocked by #10
□ #12 Deploy to production › blocked by #11
```

---

## 💡 Best Practices for Tasks

### 1. Keep Tasks Atomic
```
✅ Good:
□ #1 Add login form component
□ #2 Implement form validation
□ #3 Connect to Supabase auth

❌ Bad:
□ #1 Add complete authentication system (too broad)
```

### 2. Use Dependencies Wisely
```
✅ Good:
□ #2 Write tests › blocked by #1 (clear dependency)

❌ Bad:
□ #5 Deploy › blocked by #1, #2, #3, #4 (too many blockers, hard to track)
```

### 3. Group by Phases
```
Research:
□ #1-3 Research tasks

Implementation:
□ #4-7 Implementation tasks

Testing:
□ #8-10 Testing tasks
```

### 4. Update Status Immediately
```
When you complete a task:
- Mark it as ✓ immediately
- Check if any blockers were removed
- Start next available task
```

---

## 🔬 Verifying Tasks vs Todos

### How to Tell What You're Using

**Todos (Old System)**:
- Created with `TodoWrite` tool
- No task numbers (#1, #2, etc.)
- No "blocked by" syntax
- Disappear when session ends

**Tasks (New System)**:
- Created in Plan Mode or complex projects
- Has task numbers (#1, #2, ...)
- Supports "blocked by" dependencies
- Persists across sessions
- Shows counter "(X done, Y open)"

### Test Persistence

```bash
# 1. Create Tasks in current session
"Create Tasks for adding dark mode feature"

# 2. Close Claude Code completely
exit

# 3. Reopen Claude Code in same project

# 4. Check if Tasks are still there
# If Tasks → They persist ✅
# If gone → Were Todos ❌
```

---

## 🚀 Real-World Example: Your Project

Let's create Tasks for a realistic feature in your **Watheq** resume project:

**Prompt**:
```
I want to add AI-powered cover letter generation to Watheq.
Please create Tasks with proper dependencies to track this multi-session project.
```

**Expected Tasks Output**:
```
Tasks (0 done, 11 open)

Planning & Research:
□ #1 Research 2026 cover letter best practices
□ #2 Analyze user requirements for cover letter feature
□ #3 Design cover letter schema (JSON Resume compatible) › blocked by #2

Backend Implementation:
□ #4 Create generate-cover-letter.ts Netlify function › blocked by #3
□ #5 Add OpenRouter integration for cover letter AI › blocked by #4
□ #6 Implement caching strategy (5-min TTL) › blocked by #4

Frontend Implementation:
□ #7 Add CoverLetterSection component › blocked by #3
□ #8 Integrate with Zustand store › blocked by #7
□ #9 Add cover letter preview and PDF export › blocked by #8

Testing & Deployment:
□ #10 Write unit + integration tests › blocked by #6, #9
□ #11 Deploy and monitor › blocked by #10
```

You can now close Claude Code, work on other things, and return days later - Tasks will still be there!

---

## 📈 Tasks vs Todos Feature Comparison

| Feature | Todos (Old) | Tasks (New) |
|---------|-------------|-------------|
| **Persistence** | ❌ Session only | ✅ Cross-session |
| **Dependencies** | ❌ No support | ✅ Blocked by #X |
| **Numbering** | ❌ No numbers | ✅ #1, #2, #3... |
| **Subagent Collaboration** | ❌ No | ✅ Yes |
| **Progress Tracking** | Basic list | ✅ X done, Y open |
| **Keyboard Shortcuts** | None | ✅ ctrl+t |
| **Long-term Projects** | ❌ Not suitable | ✅ Designed for it |
| **State Management** | Simple | ✅ Opus 4.5 optimized |

---

## 🎯 Next Steps

1. **Try the Testing Script** (above) to see Tasks in action
2. **Use Plan Mode** for next complex feature - Tasks will auto-generate
3. **Close and Reopen** Claude Code to verify persistence
4. **Check Task Numbers** - If you see `#1, #2, #3`, you're using Tasks
5. **Monitor Dependencies** - Watch blockers get removed as tasks complete

---

## 📚 Additional Resources

### Official Announcement
- [Anthropic: We're turning Todos into Tasks](https://www.anthropic.com/engineering/turning-todos-into-tasks)

### Related Features
- **Plan Mode**: Enhanced for Tasks (better dependency planning)
- **Opus 4.5**: Improved state tracking for long-running Tasks
- **Subagents**: Can collaborate on shared Task lists

### Your Project Setup
- **Quality Hook**: Tasks + `npm run quality:check` = Verified progress
- **MCP Optimization**: Lean context = More room for Task tracking
- **Decomposition**: `/decompose-task` → Creates Tasks automatically

---

**Summary**: Tasks are the evolution of Todos for serious project management. Use them for any multi-step feature that takes >1 session or has dependencies.

**Try it now**: Ask Claude to plan a complex feature and watch Tasks appear!
