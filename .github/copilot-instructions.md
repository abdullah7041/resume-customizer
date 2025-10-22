# AI Resume Optimizer - Architecture Guide

## Stack
**Frontend**: React 19 + Vite + Tailwind v4  
**Backend**: Netlify Functions (TypeScript)  
**Storage**: Supabase (auth + file storage)  
**AI**: OpenAI via serverless proxies  

## Core Flow
1. Upload PDF/DOCX → `parse-resume.ts` extracts plainText
2. Match job → `match-score.ts` TF-IDF scoring (0-100)
3. Optimize → `ai.ts` or `extract-resume-json.ts` (new structured JSON endpoint)
4. Export → PDF with ATS-friendly formatting

## Key Files

### Backend (`netlify/functions/`)
- **`ai.ts`**: OpenAI proxy - uses `messages` array, returns `{ output_text, model, usage }`
- **`extract-resume-json.ts`**: NEW - Structured JSON extraction with schema validation (returns clean JSON only)
- **`match-score.ts`**: TF-IDF keyword matching (no AI)
- **`parse-resume.ts`**: PDF/DOCX text extraction
- **Config**: `netlify/lib/ai-config.ts` - **Temperature MUST be 1.0** (gpt-5-nano requirement)

### Frontend (`src/`)
- **`services/api.js`**: Main client - `parseResume()`, `analyzeResume()`, `optimizeResume()`. Always sanitize inputs.
- **`components/MainContent.jsx`**: State hub - localStorage keys: `airo:resumeData`, `airo:jobDescription`, `airo:lastActiveTab`
- **`components/LandingPage.jsx`**: Hero section with animated blobs, features grid, stats
- **`components/ui/*`**: Button, Card, Toast, Tabs - use `cn()` for conditional classes

## Critical Rules

### AI Prompts
```javascript
// Always include anti-hallucination rules:
const prompt = `
CRITICAL: ONLY use information explicitly stated. 
DO NOT invent degrees, companies, or achievements.
Return valid JSON only - no markdown, no commentary.
`;
```

### OpenAI Request Format
```typescript
{
  model: "gpt-5-nano",
  temperature: 1,  // REQUIRED - other values cause 400 errors
  max_output_tokens: 2048,
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ]
}
```

### Binary Data Validation
```javascript
// MainContent.jsx validates plainText isn't corrupted
const isBinary = /^[\x00-\x1F\x7F-\xFF]{20,}/.test(plainText);
const isBase64Like = /^[A-Za-z0-9+/=]{100,}$/.test(plainText.replace(/\s/g, ""));
```

## Development

```bash
netlify dev  # http://localhost:8888
npm test     # Vitest
npm run lint # ESLint
```

**Mock AI**: Set `VITE_USE_MOCK_AI=true` in dev  
**Postman**: Use `AI_Resume_Optimizer_API.postman_collection.json` for testing

## Design Tokens
- Colors: Emerald `#0ea472`, Teal `#075951`, Gold `#f4d37d`
- Match Scores: 🎯 75+, ⚡ 50-74, 🔧 <50
- Glassmorphism: `--surface-glass`, `--glass-border`, `backdrop-blur-glass`

## Environment Variables
**Required**:
- `OPENAI_API_KEY` (serverless only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Optional**:
- `VITE_USE_MOCK_AI` (dev mode)
- `VITE_SUPABASE_REDIRECT_URL` (OAuth override)

## Recent Updates
- ✅ Landing page with animated hero
- ✅ Structured JSON extraction endpoint (`extract-resume-json.ts`)
- ✅ Temperature locked to 1.0 (gpt-5-nano)
- ✅ Enhanced binary data validation
- ✅ Postman collection for API testing

### Match Score Always 0
- **Cause**: Backend returns 0 for all metrics despite overlap
- **Fix**: `api.js` has fallback scoring - ensure `buildFallbackMatch()` is called
- **Minimum scores**: 15 for any overlap, 20-50 based on keyword hit ratio

## Recent Updates
- ✅ Landing page with animated hero
- ✅ Structured JSON extraction endpoint (`extract-resume-json.ts`)
- ✅ Temperature locked to 1.0 (gpt-5-nano)
- ✅ Enhanced binary data validation
- ✅ Postman collection for API testing

## Troubleshooting
- **504 Errors**: Check `OPENAI_API_KEY` in Netlify env vars
- **Binary Display**: Run `localStorage.clear()` - corrupted data detected automatically
- **AI Hallucination**: Verify temperature=1.0, check prompt includes "ONLY use stated facts"
- **Match Score = 0**: Fallback scoring in `api.js` handles backend zeros

