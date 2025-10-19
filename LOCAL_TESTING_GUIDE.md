# 🧪 Local Testing Guide - Before Netlify Deployment

This guide helps you test all features locally before deploying to Netlify (which consumes credits). You already have `@netlify/dev` installed, so let's use it!

---

## 🚀 Quick Start

### 1. Start Local Development Server with Netlify Functions

```bash
npm run dev:netlify
```

This command will:
- ✅ Start Vite dev server (frontend) at `http://localhost:8888`
- ✅ Run Netlify Functions locally at `http://localhost:8888/.netlify/functions/*`
- ✅ Simulate the production environment (routing, redirects, headers)
- ✅ Use your environment variables from `.env`

> **Note**: The first time you run this, Netlify CLI may ask you to link the project. Choose "Link to existing site" or "Create & configure a new site" as appropriate.

---

## 📋 Pre-Deployment Checklist

### Step 1: Environment Variables
Make sure your `.env` file has all required variables:

```bash
# Check if .env exists and has required keys
cat .env
```

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (for AI features)

### Step 2: Run All Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run linting
npm run lint
```

All tests should pass with ✅ and no lint warnings should appear.

### Step 3: Build Production Bundle

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

Check the terminal output for:
- ✅ No build errors
- ✅ Bundle size warnings (if any)
- ✅ All assets generated successfully

---

## 🧩 Feature Testing Workflow

### Core Feature 1: Resume Upload & Parsing

1. **Start local server**: `npm run dev:netlify`
2. **Navigate to**: `http://localhost:8888`
3. **Test scenarios**:
   - ✅ Upload PDF resume (test with 2-3 different PDF formats)
   - ✅ Upload DOCX resume
   - ✅ Paste resume text directly
   - ✅ Check if parsed text appears correctly (no binary/base64 data)
   - ✅ Verify progress indicators work
   - ✅ Test error handling (try corrupt/empty file)

**Backend Function**: `/.netlify/functions/parse-resume`

Check terminal output for function logs.

### Core Feature 2: Job Match Analysis

1. **Prerequisites**: Upload a resume first
2. **Navigate to**: Job Match tab
3. **Test scenarios**:
   - ✅ Paste a job description
   - ✅ Click "Analyze Match"
   - ✅ Verify match score displays (0-100)
   - ✅ Check keyword extraction works
   - ✅ Verify matched/missing keywords sections populate
   - ✅ Test with different job descriptions (technical, creative, executive)

**Backend Function**: `/.netlify/functions/match-score`

### Core Feature 3: AI Optimization

1. **Prerequisites**: Upload resume + analyze job match
2. **Navigate to**: Optimization tab
3. **Test scenarios**:
   - ✅ Click "Optimize Resume"
   - ✅ Verify AI suggestions appear
   - ✅ Check for hallucination (AI should NOT invent facts)
   - ✅ Test "Apply Suggestions" button
   - ✅ Verify export PDF/DOCX works

**Backend Function**: `/.netlify/functions/ai`

> **Important**: Check AI responses for hallucination. AI should only use information from your resume.

### Premium Feature 4: Cover Letter Generation

1. **Prerequisites**: Sign in + resume + job description
2. **Navigate to**: Cover Letter tab
3. **Test scenarios**:
   - ✅ Click "Generate Cover Letter"
   - ✅ Verify personalized letter appears
   - ✅ Check tone matches job type
   - ✅ Test export functionality

**Backend Function**: `/.netlify/functions/generate-cover-letter`

### Premium Feature 5: Interview Preparation

1. **Prerequisites**: Sign in + resume + job description
2. **Navigate to**: Interview Prep tab
3. **Test scenarios**:
   - ✅ Click "Predict Questions"
   - ✅ Verify 5-10 relevant questions generate
   - ✅ Check if questions align with job description
   - ✅ Test answer suggestions

**Backend Function**: `/.netlify/functions/predict-questions`

### Feature 6: Keyword Analyzer

1. **Prerequisites**: Resume + job description
2. **Navigate to**: Keyword Analyzer tab
3. **Test scenarios**:
   - ✅ Verify TF-IDF analysis runs
   - ✅ Check keyword importance scores
   - ✅ Validate matched/missing keywords
   - ✅ Test density calculations

**Client-side only** (no backend function)

### Feature 7: Template Gallery

1. **Navigate to**: Template Gallery tab
2. **Test scenarios**:
   - ✅ Browse templates (Modern, Classic, Technical, Creative, Executive)
   - ✅ Preview templates
   - ✅ Select template
   - ✅ Apply to resume
   - ✅ Check ATS scores display

**Client-side rendering**

### Feature 8: Bulk Analysis

1. **Navigate to**: Bulk Analysis tab
2. **Test scenarios**:
   - ✅ Upload 2-5 resumes at once
   - ✅ Verify parsing happens in parallel
   - ✅ Check comparison table generates
   - ✅ Validate ranking/scoring
   - ✅ Test export results

**Uses multiple backend functions**

---

## 🔍 Backend Function Debugging

### View Function Logs

When running `npm run dev:netlify`, you'll see function invocations in the terminal:

```
◈ Functions loaded:
   - parse-resume
   - match-score
   - ai
   - generate-cover-letter
   - predict-questions
   - optimize

◈ Request from ::1: POST /.netlify/functions/ai
```

### Test Functions Directly (cURL)

You can test backend functions independently:

```bash
# Test parse-resume (requires multipart form data)
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -F "file=@/path/to/resume.pdf"

# Test match-score
curl -X POST http://localhost:8888/.netlify/functions/match-score \
  -H "Content-Type: application/json" \
  -d '{"resumeText": "Your resume text", "jobDescription": "Job desc"}'

# Test AI function (simplified)
curl -X POST http://localhost:8888/.netlify/functions/ai \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Test prompt"}]}'
```

### Common Issues

**Problem**: Functions return 404
- **Solution**: Make sure you're using `npm run dev:netlify` (not `npm run dev`)

**Problem**: OpenAI API errors (504 Gateway Timeout)
- **Solution**: Check `OPENAI_API_KEY` in `.env`
- **Solution**: Verify OpenAI endpoint in `netlify/functions/ai.ts`

**Problem**: Binary data in parsed resume
- **Solution**: Enhanced validation should auto-detect and clear
- **Manual fix**: Clear localStorage: `localStorage.clear()`

**Problem**: Match score always 0
- **Solution**: Fallback scoring is implemented in `api.js`
- **Check**: Ensure resume and job description have text

---

## 📊 Performance Checks

### Bundle Size Analysis

```bash
npm run build

# Check dist/ folder size
du -sh dist/

# Should be under 2MB total
```

### Lighthouse Testing (Optional)

```bash
# Install Lighthouse CLI (if not installed)
npm install -g lighthouse

# Run Lighthouse on local build
npm run preview  # In one terminal
lighthouse http://localhost:4173 --view  # In another terminal
```

Target scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

---

## ✅ Final Pre-Deploy Checklist

Before running `netlify deploy --prod`:

- [ ] All tests pass: `npm test`
- [ ] No lint warnings: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] All 8 features tested locally with `npm run dev:netlify`
- [ ] Resume parsing works (PDF, DOCX, text)
- [ ] Match score displays correctly
- [ ] AI optimization generates suggestions (no hallucination)
- [ ] Cover letter generation works (if premium)
- [ ] Interview prep works (if premium)
- [ ] Keyword analyzer shows results
- [ ] Template gallery loads and applies
- [ ] Bulk analysis processes multiple files
- [ ] Export PDF/DOCX works
- [ ] Auth flow works (Google sign-in)
- [ ] No console errors in browser DevTools
- [ ] Mobile responsive (test at 375px, 768px, 1024px widths)

---

## 🚢 Deploy When Ready

Once all checks pass:

```bash
# Build for production
npm run build

# Deploy to Netlify (preview first)
netlify deploy

# If preview looks good, deploy to production
netlify deploy --prod
```

---

## 🆘 Need Help?

- **Netlify CLI Docs**: https://docs.netlify.com/cli/get-started/
- **Local Dev Guide**: https://docs.netlify.com/cli/local-development/
- **Functions Debugging**: https://docs.netlify.com/functions/logs/

---

**💡 Pro Tip**: Test each feature in order (Resume → Match → Optimize → Premium features) since they depend on each other. Always start with a fresh localStorage clear when testing edge cases.
