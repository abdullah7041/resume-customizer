# Goal 1: Apply the winning lever from the optimize-quality eval

**Model**: Fable 5, plan mode. Execute with Opus after plan approval.
**Precondition**: `npm run eval:optimize` has been run (needs OPENROUTER_API_KEY). If `tsx` is missing, run `npm install` first.

Plan only. Do not write implementation code until the plan is approved.

Read the LATEST report in `scripts/benchmark-reports/` matching `optimize-quality-*.md`. If no report exists, stop and tell me to run `npm run eval:optimize` first.

Context: variants were baseline (gemini-2.5-flash, temp 0, stock prompt), temp_05, prompt_v2 (anti-cliche + few-shot example), model_up. The optimize contract lives in `netlify/lib/ai-contracts/contracts/index.js` (buildOptimizeMessages ~L721, config ~L902). Prior analysis suspects temperature:0 causes the generic phrasing.

Task: read the judge scores and pick exactly ONE change to ship. Justify with the numbers. Then write the implementation plan for that change.

Hard constraints:

- One lever only. No combined changes.
- Untouchable: anti-inflation scoring rules (80+/60-79/<60 anchors, never >90 without full evidence), STAR + metric bullet enforcement, "(verify)" convention for inferred metrics, JD keywords woven into bullets.
- parse_resume stays on lite with reasoningBudget 0. Do not touch parsing.
- If model_up wins, state the latency + cost delta and whether it fits the 30s Netlify limit before recommending it.
- Plan must include: exact file+line edits, focused test list, and re-running `npm run eval:optimize` as the acceptance gate.

Done when: one lever changed, eval re-run confirms the winner beats baseline, focused tests + `npm run type:check` pass (if contract config changed), nothing else changed.
