# 🔧 Fixed: Netlify Dev Setup

## ✅ Issue Fixed: "netlify: not found"

**Problem**: Netlify CLI wasn't installed globally  
**Solution**: Updated npm script to use `npx netlify dev`

---

## 🚀 Quick Setup (2 Minutes)

### Step 1: Copy Environment Template
```bash
cp .env.example .env
```

### Step 2: Edit .env File

Open `.env` and add your keys:

```bash
# Required - get from Supabase dashboard
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# For FULL testing (AI features) - RECOMMENDED
OPENAI_API_KEY=sk-proj-your-openai-key

# OR for LIMITED testing (no AI features)
VITE_USE_MOCK_AI=true
```

### Step 3: Start Dev Server
```bash
npm run dev:netlify
```

**Opens at**: http://localhost:8888

---

## 🤔 Which Testing Option Should I Choose?

### Option A: Full Testing (RECOMMENDED) ⭐

**Add to .env:**
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

**Get OpenAI Key**: https://platform.openai.com/api-keys

**Cost**: ~$0.01-0.05 per test session (GPT-5 Nano is very cheap!)

**Can Test**:
- ✅ Resume Upload & Parsing
- ✅ Job Match Analysis  
- ✅ AI Resume Optimization ⭐
- ✅ Cover Letter Generation ⭐
- ✅ Interview Question Prediction ⭐
- ✅ Keyword Analyzer
- ✅ Template Gallery
- ✅ Export PDF

**Why This Is Better**:
- Testing locally costs ~$0.50 total for full test suite
- Deploying to Netlify 3-5 times consumes build minutes quota
- Catch AI bugs before production!

---

### Option B: Limited Testing (Free)

**Add to .env:**
```bash
VITE_USE_MOCK_AI=true
```

**Cost**: $0 (no OpenAI charges)

**Can Test**:
- ✅ Resume Upload & Parsing
- ✅ Job Match Analysis (TF-IDF, no AI)
- ✅ Keyword Analyzer
- ✅ Template Gallery  
- ✅ Export PDF

**Cannot Test**:
- ❌ AI Resume Optimization
- ❌ Cover Letter Generation
- ❌ Interview Question Prediction

**When to Use**:
- Testing UI/UX changes
- Testing non-AI features
- Don't have OpenAI account yet

---

### Option C: No .env (Most Limited)

**Just run**: `npm run dev:netlify`

**Can Test**:
- ✅ Frontend UI
- ✅ Basic parsing
- ⚠️  Most features will show errors

**When to Use**:
- Quick UI check only
- Not recommended for real testing

---

## 📋 Environment Variables Explained

### For Local Testing (.env file):

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `VITE_SUPABASE_URL` | Yes | Database connection |
| `VITE_SUPABASE_ANON_KEY` | Yes | Auth & storage |
| `OPENAI_API_KEY` | Optional* | AI features |
| `VITE_USE_MOCK_AI` | Optional** | Skip AI, use mocks |

*Required for AI features (optimization, cover letter, interview prep)  
**Alternative to OPENAI_API_KEY - choose one

### For Production (Netlify Dashboard):

All environment variables should be set in:
**Netlify Dashboard → Site Settings → Environment Variables**

Your `OPENAI_API_KEY` is already set there ✅

---

## 🧪 Testing Workflow

### 1. Start Server
```bash
npm run dev:netlify
```

First time will ask to link site - choose your Netlify site.

### 2. Open Browser
Navigate to: http://localhost:8888

### 3. Test Features
Follow checklist in `QUICK_TEST_REFERENCE.md`

### 4. Check Terminal
Backend function logs appear in terminal:
```
◈ Request from ::1: POST /.netlify/functions/ai
◈ Response with status 200 in 1523 ms
```

---

## ❓ Common Questions

**Q: Do I need the same API key for local and production?**  
A: No. Local uses `.env`, production uses Netlify env vars. They can be different keys.

**Q: Will local testing consume my Netlify credits?**  
A: No! Local testing uses your machine. Only deployments consume Netlify credits.

**Q: How much does OpenAI testing cost?**  
A: ~$0.01-0.05 per AI request. Full test suite: ~$0.50. Much cheaper than multiple deploys!

**Q: Can I test without Supabase keys?**  
A: Partially. You can test parsing and UI, but no auth/storage features.

**Q: What if I get "netlify: not found" error?**  
A: The npm script now uses `npx netlify dev` automatically - should work!

---

## 🎯 Next Steps

1. **Copy env template**: `cp .env.example .env`
2. **Add your keys** to `.env` (see options above)
3. **Start server**: `npm run dev:netlify`
4. **Test features**: Open http://localhost:8888
5. **Before deploy**: Run `./test-local.sh`

---

## 📚 More Help

- Full Testing Guide: `LOCAL_TESTING_GUIDE.md`
- Quick Reference: `QUICK_TEST_REFERENCE.md`
- Quick Start: `QUICK_START.md`

---

**💡 Tip**: Option A (Full Testing) is recommended. The small OpenAI cost (~$0.50) is worth catching bugs before using Netlify deploy credits!
