# How Match Scores and Optimization Work

## Match Score Calculation (0-100 points)

### AI-Powered Scoring Rubric

When you paste a job description and click "Analyze Match," the AI evaluates your resume across 4 categories:

| Category | Max Points | What It Measures |
|----------|-----------|------------------|
| **Hard Skills** | 40 | Technical skills, tools, programming languages, certifications that match the job |
| **Experience** | 30 | Years of experience, relevant industry, matching job responsibilities |
| **Education** | 15 | Degree level, field of study, prestigious institutions |
| **Soft Skills** | 15 | Leadership, communication, teamwork evidence in your resume |
| **Total** | **100** | **Sum of all categories** |

### Scoring Process

1. **AI Analyzes Both Documents**: The AI reads your entire resume and the full job description

2. **Category-by-Category Evaluation**:
   - **Hard Skills (40 pts)**:
     - 40 pts = ALL required technical skills present with evidence
     - 30 pts = Most required skills (80%+)
     - 20 pts = Some required skills (50-79%)
     - 10 pts = Few required skills (25-49%)
     - 0 pts = Missing most skills (<25%)

   - **Experience (30 pts)**:
     - 30 pts = Experience EXCEEDS requirements
     - 22 pts = Experience MEETS requirements
     - 15 pts = Experience slightly below OR different industry
     - 8 pts = Limited relevant experience
     - 0 pts = No relevant experience

   - **Education (15 pts)**:
     - 15 pts = Exceeds requirements (higher degree or prestigious institution)
     - 12 pts = Meets exact requirements
     - 8 pts = Related field or equivalent experience
     - 4 pts = Some relevant coursework
     - 0 pts = No relevant education

   - **Soft Skills (15 pts)**:
     - 15 pts = Strong evidence of ALL soft skills mentioned in JD
     - 10 pts = Evidence of most soft skills
     - 5 pts = Some soft skills demonstrated
     - 0 pts = No soft skills evidence

3. **Final Score**: Sum of all 4 categories (0-100)

### What the Score Means

- **85-100%**: Excellent match - you meet or exceed all requirements
- **70-84%**: Strong match - you meet most requirements with some gaps
- **50-69%**: Good start - you have transferable skills but missing key requirements
- **Below 50%**: Needs work - fundamental mismatch between resume and job

---

## Optimization Improvement Calculation

### Before Optimization

When you click "Optimize," the system:
1. Re-uses your existing match score as the "Before" score
2. Generates optimization suggestions (headline, summary, bullet point improvements)
3. **Estimates** potential improvement based on number of suggestions

### Estimated Improvement (Old Formula - REMOVED)

**Previous formula** (no longer used):
```
cardBonus = cards.length × 3 points (max 20)
keywordBonus = keywords × 1 point (max 8)
totalImprovement = min(cardBonus + keywordBonus, 25)
afterScore = beforeScore + totalImprovement (capped at 95)
```

**Problem**: This was a **fake projection** - just math, not AI evaluation.

### Genuine Improvement (Current System)

**After you click "Optimize"**, the system now:

1. **Generates optimization cards** (5 credits)
2. **Auto-verifies the "After" score**:
   - Temporarily applies ALL optimizations to your resume
   - Runs a full AI re-analysis (2 credits included)
   - Gets a **genuine** "After" score from the AI
   - Shows you the real improvement

**Example**:
```
Before: 72% (original resume analyzed)
  ↓
Optimization cards generated (10 suggestions)
  ↓
Auto-verify runs (applies all optimizations, re-analyzes)
  ↓
After: 87% (genuine AI score of optimized resume)
  ↓
Improvement: +15 points (real, not estimated)
```

### Why Auto-Verify?

Previously, users had to click a separate "Verify Match Score" button (2 credits) to see the real "After" score. This was confusing and most users never clicked it, so they only saw the fake estimated score.

Now, **verification happens automatically** during optimization:
- You pay 5 credits for optimization
- Auto-verify is included (normally 2 credits)
- You immediately see the **genuine** Before → After comparison

---

## Why Scores Vary Across Templates

If you export with different templates (Modern, Classic, Technical, ATS) and re-upload, you might see different scores. **This is due to data loss**, not different scoring logic.

### Template Data Completeness

| Field | Modern | ATS | Classic | Technical | Executive |
|-------|--------|-----|---------|-----------|-----------|
| work.location | ✅ | ✅ | ✅ | ✅ | ✅ |
| project.description | ✅ | ✅ | ✅ | ✅ | ✅ |
| education.highlights | ✅ | ✅ | ✅ | ✅ | ✅ |
| certificates issuer+date | ✅ | ✅ | ✅ | ✅ | ✅ |
| basics.location.region | ✅ | ✅ | ✅ | ✅ | ✅ |

**All templates now render all data fields** (fixed as of latest version).

### Re-Upload Score Drift

If you:
1. Upload original resume → Score: 95%
2. Optimize → Export as PDF → Re-upload
3. Analyze again → Score: 92%

**Possible causes**:
- **PDF text extraction loses subtle formatting** (bullet points, spacing)
- **AI parsing ambiguity** (e.g., "ABC Corp, Riyadh, KSA" - is "Riyadh" part of company name or a location field?)
- **Serialization** (JSON resume → Visual PDF → Extracted text → Re-parsed JSON loses some structure)

**Expected behavior**: Score should stay within 3-5 points of original. If drift is larger, this indicates a template data loss issue (please report).

---

## Common Questions

### Q: Why did my score drop from 95 to 87 after re-uploading?

**A**: This was a bug (now fixed). The system was overwriting the baseline score when analyzing the optimized resume. Latest version preserves the original baseline.

### Q: Why does DOCX export look different from PDF?

**A**: DOCX uses a generic Calibri-based format for MS Word editability. PDF respects your selected template for visual consistency.

### Q: Is the "After" score genuine or estimated?

**A**: **Genuine**. The system auto-verifies by running a full AI re-analysis on the optimized resume. The "After" score is a real AI evaluation, not a formula.

### Q: Can I trust the category breakdown?

**A**: Yes. The AI provides reasoning for each category score (hard skills, experience, education, soft skills) with specific matched and missing keywords.

### Q: Why is there a delay after clicking "Optimize"?

**A**: The system runs two AI analyses:
1. Generate optimization suggestions (~10 seconds)
2. Auto-verify the "After" score (~10 seconds)

Total time: ~20-30 seconds. The auto-verify ensures you see a genuine improvement score immediately.

---

## Technical Details

### AI Model Used
- **Match Analysis**: Google Gemini 2.5 Flash (via OpenRouter)
- **Optimization**: Google Gemini 2.5 Flash
- **Temperature**: 0 (deterministic - same resume + JD = same score)

### Credits Consumed
- **Match Analysis**: 2 credits
- **Optimization**: 5 credits (includes auto-verify)
- **Interview Prep**: 3 credits
- **Cover Letter**: 3 credits

### Caching
- Match scores are cached for 5 minutes
- Cache keys include: resume text + job description text + isOptimized flag
- Re-analyzing within 5 minutes with same inputs uses cached result (free)

---

**Last Updated**: 2026-02-08
**Version**: Post-Honest-Scoring-Fix
