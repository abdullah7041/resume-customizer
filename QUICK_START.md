# 🚀 Quick Start - AI Resume Optimizer

## First Time Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your keys:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - OPENAI_API_KEY
```

### 3. Start Development Server
```bash
npm run dev:netlify
```

Opens at: **http://localhost:8888**

---

## Daily Development

```bash
# Start dev server (with backend functions)
npm run dev:netlify

# Run in separate terminal if needed:
npm run lint        # Check code quality
npm test            # Run unit tests
npm run test:watch  # Watch mode
```

---

## Before Deployment

```bash
# Run full test suite
./test-local.sh

# If all passes, build and deploy
npm run build
npx netlify deploy --prod
```

---

## Testing Features

Open http://localhost:8888 and test:

1. ✅ Upload a resume (PDF/DOCX)
2. ✅ Paste job description → Click "Analyze Match"
3. ✅ Click "Optimize Resume" → Check AI suggestions
4. ✅ Try cover letter generation
5. ✅ Test interview prep
6. ✅ Export PDF

---

## Documentation

- 📖 **Full Testing Guide**: [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
- 🎯 **Quick Reference**: [QUICK_TEST_REFERENCE.md](QUICK_TEST_REFERENCE.md)
- 📋 **Feature List**: [FEATURES_QUICK_REFERENCE.md](FEATURES_QUICK_REFERENCE.md)
- 🚢 **Deployment**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- 🧹 **What Changed**: [CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)

---

## Common Issues

**Functions return 404?**
→ Use `npm run dev:netlify` (not `npm run dev`)

**OpenAI errors?**
→ Check `OPENAI_API_KEY` in `.env`

**Binary data in resume?**
→ Clear localStorage: `localStorage.clear()`

---

## Project Structure

```
src/
├── components/         # UI components
├── features/           # Feature modules (Upload, Match, Optimize, etc.)
├── services/           # API clients (api.js, supabase.js)
└── lib/                # Utilities

netlify/functions/      # Backend serverless functions
```

---

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev:netlify` | Dev server with functions |
| `npm run lint` | Check code quality |
| `npm test` | Run tests |
| `./test-local.sh` | Full pre-deploy check |
| `npm run build` | Production build |

---

**💡 Pro Tip**: Always test locally with `npm run dev:netlify` before deploying to Netlify to save credits!

**🆘 Need Help?** Check [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
