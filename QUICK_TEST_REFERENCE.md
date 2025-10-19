# 🎯 Quick Reference - Netlify Dev Testing

## Start Local Development

```bash
npm run dev:netlify
```

Opens at: `http://localhost:8888`

---

## Test Checklist ✅

### 1. Basic Health Check
```bash
./test-local.sh
```
This runs: ESLint → Tests → Build

### 2. Feature Testing
| Feature | Test Steps | Expected Result |
|---------|-----------|-----------------|
| **Resume Upload** | Drop PDF/DOCX file | Text extracts, no binary data |
| **Job Match** | Paste job desc + click Analyze | Score 0-100, keywords shown |
| **Optimization** | Click Optimize Resume | AI suggestions, no invented facts |
| **Cover Letter** | Click Generate | Personalized letter appears |
| **Interview Prep** | Click Predict Questions | 5-10 relevant questions |
| **Templates** | Browse gallery + select | Template applies to resume |
| **Bulk Analysis** | Upload 3+ resumes | Ranking table generates |
| **Export PDF** | Click Export | PDF downloads/prints |

### 3. Backend Function Check

All functions should log in terminal when called:

```
◈ Request from ::1: POST /.netlify/functions/parse-resume
◈ Request from ::1: POST /.netlify/functions/match-score
◈ Request from ::1: POST /.netlify/functions/ai
```

---

## Common Commands

```bash
# Clean start (clear cache)
rm -rf .netlify dist node_modules/.cache && npm run dev:netlify

# Test specific function
curl -X POST http://localhost:8888/.netlify/functions/match-score \
  -H "Content-Type: application/json" \
  -d '{"resumeText": "test", "jobDescription": "test"}'

# Clear localStorage (in browser console)
localStorage.clear()

# Check bundle size
npm run build && du -sh dist/

# Run tests with coverage
npm test -- --coverage
```

---

## Debugging Tips

**"netlify: not found"**: npm script now uses `npx netlify dev` automatically  
**504 Error**: Add `OPENAI_API_KEY` to `.env` for local testing  
**Function 404**: Use `npm run dev:netlify` not `npm run dev`  
**Binary Data**: Clear localStorage or refresh page  
**Match Score 0**: Check resume + job desc have 50+ words each

---

## Deploy When Ready

```bash
# Build + verify
npm run build

# Deploy to preview
npx netlify deploy

# Deploy to production (if preview looks good)
npx netlify deploy --prod
```

---

📖 **Full Guide**: [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
