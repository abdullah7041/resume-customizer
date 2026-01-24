# API Cost Analysis for $5 Budget

Based on your context usage (72.5k tokens per session), here's a detailed cost breakdown for using Claude API directly instead of Claude Pro subscription.

---

## Current Anthropic API Pricing (January 2026)

### Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
- **Input**: $3.00 per million tokens
- **Output**: $15.00 per million tokens
- **Cache Writes**: $3.75 per million tokens
- **Cache Reads**: $0.30 per million tokens (10x cheaper)

### Claude Opus 4.5 (claude-opus-4-5-20251101)
- **Input**: $15.00 per million tokens
- **Output**: $75.00 per million tokens
- **Cache Writes**: $18.75 per million tokens
- **Cache Reads**: $1.50 per million tokens

### Extended Thinking (Sonnet/Opus)
- **Input**: Same as base model
- **Output**: Same as base model
- **Thinking tokens**: Counted as output tokens

**Source**: [Anthropic Pricing](https://www.anthropic.com/pricing)

---

## Your Current Usage Pattern

Based on your `/context` output:

| Category | Tokens | Percentage |
|----------|--------|------------|
| System prompt | 3.3k | 1.6% |
| System tools | 16.7k | 8.4% |
| MCP tools | 47.9k → 4k | 23.9% → 2% (after optimization) |
| Memory files | 4.6k | 2.3% |
| Skills | 13 | 0.0% |
| Messages | 8 | 0.0% |
| **Total Input** | **72.5k → 28.6k** | **36% → 14%** |

**After MCP Optimization**: ~28.6k tokens per session start

---

## Cost Estimates for $5 Budget

### Scenario 1: Sonnet 4.5 (No Extended Thinking)

**Assumptions**:
- Input: 28.6k tokens per session (after MCP optimization)
- Output: 2k tokens per response (average coding response)
- 10 messages per session
- Prompt caching enabled (90% cache hit rate after first message)

**First Message** (no cache):
- Input: 28.6k tokens × $3.00/1M = $0.0858
- Output: 2k tokens × $15.00/1M = $0.0300
- **Total**: $0.1158

**Subsequent 9 Messages** (with caching):
- Cache reads: 28.6k × 0.9 = 25.7k tokens × $0.30/1M = $0.0077
- Fresh input: 28.6k × 0.1 = 2.9k tokens × $3.00/1M = $0.0087
- Output: 2k tokens × $15.00/1M = $0.0300
- **Per message**: $0.0464
- **9 messages**: $0.4176

**Total per session**: $0.1158 + $0.4176 = **$0.5334**

**Sessions per $5**: $5 ÷ $0.5334 = **9.37 sessions** (~94 messages)

---

### Scenario 2: Sonnet 4.5 with Extended Thinking

**Assumptions**:
- Input: 28.6k tokens
- Output: 2k tokens (response)
- Thinking: 4k tokens (average extended thinking)
- 10 messages per session
- Caching enabled (90% hit rate)

**First Message**:
- Input: 28.6k × $3.00/1M = $0.0858
- Output: 2k × $15.00/1M = $0.0300
- Thinking: 4k × $15.00/1M = $0.0600
- **Total**: $0.1758

**Subsequent 9 Messages** (with caching):
- Cache reads: 25.7k × $0.30/1M = $0.0077
- Fresh input: 2.9k × $3.00/1M = $0.0087
- Output: 2k × $15.00/1M = $0.0300
- Thinking: 4k × $15.00/1M = $0.0600
- **Per message**: $0.1064
- **9 messages**: $0.9576

**Total per session**: $0.1758 + $0.9576 = **$1.1334**

**Sessions per $5**: $5 ÷ $1.1334 = **4.41 sessions** (~44 messages)

---

### Scenario 3: Opus 4.5 (No Extended Thinking)

**First Message**:
- Input: 28.6k × $15.00/1M = $0.4290
- Output: 2k × $75.00/1M = $0.1500
- **Total**: $0.5790

**Subsequent 9 Messages** (with caching):
- Cache reads: 25.7k × $1.50/1M = $0.0386
- Fresh input: 2.9k × $15.00/1M = $0.0435
- Output: 2k × $75.00/1M = $0.1500
- **Per message**: $0.2321
- **9 messages**: $2.0889

**Total per session**: $0.5790 + $2.0889 = **$2.6679**

**Sessions per $5**: $5 ÷ $2.6679 = **1.87 sessions** (~19 messages)

---

### Scenario 4: Opus 4.5 with Extended Thinking

**First Message**:
- Input: 28.6k × $15.00/1M = $0.4290
- Output: 2k × $75.00/1M = $0.1500
- Thinking: 8k × $75.00/1M = $0.6000 (Opus thinks deeper)
- **Total**: $1.1790

**Subsequent 9 Messages** (with caching):
- Cache reads: 25.7k × $1.50/1M = $0.0386
- Fresh input: 2.9k × $15.00/1M = $0.0435
- Output: 2k × $75.00/1M = $0.1500
- Thinking: 8k × $75.00/1M = $0.6000
- **Per message**: $0.8321
- **9 messages**: $7.4889

**Total per session**: $1.1790 + $7.4889 = **$8.6679**

**Sessions per $5**: $5 ÷ $8.6679 = **0.58 sessions** (~6 messages)

❌ **Not feasible with $5 budget**

---

## Summary Table: What You Get for $5

| Model | Thinking | Sessions | Total Messages | Cost/Session |
|-------|----------|----------|----------------|--------------|
| **Sonnet 4.5** | ❌ No | 9.4 | ~94 | $0.53 |
| **Sonnet 4.5** | ✅ Yes | 4.4 | ~44 | $1.13 |
| **Opus 4.5** | ❌ No | 1.9 | ~19 | $2.67 |
| **Opus 4.5** | ✅ Yes | 0.6 | ~6 | $8.67 |

---

## Recommended Strategy for $5 Budget

### Option 1: Sonnet Only (Best Value)
- Use **Sonnet 4.5 without extended thinking**
- **Get**: ~9 coding sessions (~94 messages)
- **Best for**: Regular development, bug fixes, refactoring
- **Trade-off**: Less reasoning depth than Opus/thinking modes

### Option 2: Smart Model Switching
- **Sonnet (no thinking)**: 7 sessions (~70 messages) = $3.73
- **Sonnet (with thinking)**: 1 session (~10 complex messages) = $1.13
- **Total**: $4.86 (8 sessions, 80 messages)
- **Best for**: Mix of routine work + occasional complex problems

### Option 3: Extreme Budget Mode
- **Sonnet (no thinking)**: 8 sessions
- **Haiku** for simple tasks: ~100 messages = $0.50
- **Total**: 8 Sonnet sessions + 100 Haiku queries
- **Best for**: Maximum message count, willing to use lighter model

---

## Cost Optimization Tips

### 1. Enable Prompt Caching (Critical!)
- **Saves**: 90% on repeated context after first message
- **How**: Automatic in Claude API (enabled by default)
- **Impact**: Reduces session cost from $1.15 → $0.53 (Sonnet)

### 2. Optimize MCP Servers (Already Done ✅)
- **Before**: 72.5k input tokens
- **After**: 28.6k input tokens
- **Savings**: 60% reduction in input costs

### 3. Use Haiku for Simple Tasks
- **Cost**: $0.25/1M input, $1.25/1M output (95% cheaper than Sonnet)
- **Use for**: File reading, simple edits, explanations
- **Reserve Sonnet for**: Architecture, debugging, refactoring

### 4. Batch Your Questions
- **Single session**: $0.53 (10 messages)
- **10 separate sessions**: $1.16 (10 messages total)
- **Savings**: 54% cheaper to batch in one session

### 5. Disable Extended Thinking for Routine Tasks
- **Only enable when**: Complex architecture, debugging hard bugs, planning
- **Savings**: 2.1x more sessions without thinking

---

## Comparison: Claude Pro vs API

### Claude Pro ($20/mo)
- **Includes**: Unlimited Sonnet, limited Opus, unlimited thinking
- **Best for**: Heavy users (>38 Sonnet sessions/month)
- **Break-even**: $20 ÷ $0.53 = 38 sessions

### Claude API ($5 budget)
- **Get**: 9 Sonnet sessions OR 4 Sonnet+thinking sessions
- **Best for**: Light users (<10 sessions/month)
- **Savings**: $15/mo if you use <9 sessions

### Recommendation
- **If you code daily**: Stick with Claude Pro ($20/mo)
- **If you code weekly**: Switch to API (~$5-10/mo)
- **If you code occasionally**: API is better ($2-5/mo)

---

## Tools Comparison for $5 Budget

### Using Cline/Continue.dev + Sonnet API
- **Sessions**: 9.4 sessions
- **Messages**: ~94 total
- **MCP Support**: Yes (Cline supports MCP)
- **Privacy**: Code stays local
- **Total Cost**: $5/mo

### Using Claude Code (CLI)
- **Subscription**: $20/mo (Claude Pro required)
- **Sessions**: Unlimited Sonnet
- **Best for**: Daily heavy usage

### Hybrid Approach
- **Claude Code**: 1-2 complex sessions/week ($20/mo subscription)
- **Cline + API**: Quick edits, experiments ($0/mo - covered by Pro API quota)
- **Best of both worlds**: Use Pro quota via Cline for extra flexibility

---

## Monthly Budget Scenarios

### $5/month Budget
- **Sonnet sessions**: 9 sessions (~90 messages)
- **Use cases**: Weekend projects, learning, occasional debugging
- **Tools**: Cline or Continue.dev

### $10/month Budget
- **Sonnet sessions**: 19 sessions (~190 messages)
- **OR**: 8 Sonnet + thinking sessions (~80 deep-reasoning messages)
- **Use cases**: Part-time freelancing, side projects
- **Tools**: Cline + Aider for automation

### $20/month Budget (Same as Claude Pro)
- **Option A - Claude Pro**: Unlimited Sonnet, limited Opus
- **Option B - API Only**: 38 Sonnet sessions OR 18 Sonnet+thinking sessions
- **Recommendation**: Choose Claude Pro (better value at this tier)

---

## Final Recommendation for Your Case

**Current Usage**: 72.5k tokens/session → 28.6k (after optimization)

### If Staying with Claude Pro ($20/mo):
✅ **Keep it** - Unlimited Sonnet, no need to track usage

### If Switching to API ($5 budget):
- ✅ Use **Sonnet 4.5 without extended thinking**
- ✅ Get **9 coding sessions** (90-100 messages)
- ✅ Use **Cline** for VS Code integration
- ✅ Enable prompt caching (automatic)
- ⚠️ Save thinking mode for truly complex problems

### Budget Tracker
Create a simple tracker:
```bash
# Add to your .bashrc or .zshrc
alias claude-cost='echo "Sessions used: X/9 | Remaining budget: $Y/5"'
```

Monitor usage monthly and adjust model selection based on budget.

---

**Bottom Line**:
- **$5 budget** = 9 Sonnet sessions is reasonable for light usage
- **Extended thinking** cuts sessions in half (4 sessions)
- **Opus** is too expensive for $5 budget (only 1-2 sessions)
- **Best value**: Sonnet 4.5 without thinking + prompt caching
