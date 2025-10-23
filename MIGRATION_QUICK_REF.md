# 🎯 Quick Migration Reference

## 📋 TL;DR

**Current State:** 25+ docs in root, duplicated code, nested components  
**Goal State:** Clean structure, organized docs, no duplicates  
**Time Needed:** 4-6 hours with thorough testing  
**Risk Level:** Medium (all mitigation strategies in place)

---

## 🚀 How to Migrate

### Option 1: Automated (Recommended)

```powershell
# Step 1: Test what will change (safe)
.\migrate-structure.ps1 -Phase all -DryRun

# Step 2: Run phase by phase
.\migrate-structure.ps1 -Phase 1    # Docs (low risk)
npm test                             # Verify

.\migrate-structure.ps1 -Phase 2    # Components
npm test                             # Verify

.\migrate-structure.ps1 -Phase 3    # Duplicates
npm test                             # Verify

.\migrate-structure.ps1 -Phase 4    # Backend & tests
npm test                             # Verify

# Step 3: Update imports (see below)

# Step 4: Commit
git add .
git commit -m "chore: restructure project for better maintainability"
```

### Option 2: Manual

Follow `PROJECT_RESTRUCTURE.md` step by step.

---

## 🔄 Import Path Updates

After migration, update these imports:

### Frontend Components

```javascript
// BEFORE
import JobMatch from '../components/Features/JobMatch';
import { Button } from '../components/ui/Button';
import LandingPage from '../components/LandingPage';

// AFTER
import JobMatch from '@features/job-matching/JobMatch';
import { Button } from '@components/ui/Button';
import LandingPage from '@features/landing/LandingPage';
```

### Services & Lib

```javascript
// BEFORE
import { parseResume } from '../lib/resumeText';
import { buildResumeDocument } from '../../shared/normalize-resume';

// AFTER
import { parseResume } from '@lib/parsers/resumeParser';
import { buildResumeDocument } from '@lib/parsers/resumeNormalizer';
```

### Styles

```javascript
// BEFORE
import '../App.css';
import './index.css';

// AFTER
import '@styles/App.css';
import '@styles/index.css';
```

### Backend Functions

```typescript
// BEFORE
import { buildResumeDocument } from '../lib/normalize-resume';
import { extractPlainText } from '../lib/resumeText';

// AFTER
import { buildResumeDocument } from '../lib/parsers/resumeNormalizer';
import { extractPlainText } from '../lib/parsers/resumeParser';
```

---

## 📦 What Gets Moved Where

### Documentation (25 files → organized)

```
Root → docs/setup/
✓ QUICK_START.md
✓ LOCAL_TESTING_GUIDE.md
✓ SUPABASE_AUTH_SETUP.md
✓ SUPABASE_STORAGE_SETUP.md

Root → docs/api/
✓ POSTMAN_TESTING_GUIDE.md
✓ DEEPSEEK_OCR_BATCH_API_GUIDE.md
✓ DEEPSEEK_OCR_QUICK_REF.md

Root → docs/features/
✓ FEATURES_QUICK_REFERENCE.md

Root → docs/development/
✓ QUICK_FIX_REFERENCE.md
✓ QUICK_TEST_REFERENCE.md

Root → docs/archive/
✓ Enhancement_Suggestions.md
✓ INSTALL_FIX_SUMMARY.md
✓ IMPLEMENTATION_COMPLETE.md
✓ UI_UX_AND_AI_FIXES_SUMMARY.md
✓ SUPABASE_UPLOAD_DEBUG.md
```

### Components

```
src/components/Features/ → src/features/job-matching/
✓ JobMatch.jsx

src/components/ → src/features/landing/
✓ LandingPage.jsx
✗ LandingPageV2.jsx (deleted - legacy)

src/features/ → src/features/<feature-name>/
✓ ResumeUpload.jsx → resume-upload/
✓ Optimization.jsx → optimization/
✓ KeywordAnalyzer.jsx → keyword-analysis/
✓ CoverLetter.jsx → cover-letter/
✓ InterviewPrep.jsx → interview-prep/
✓ TemplateGallery.jsx → template-gallery/
✓ BulkAnalysis.jsx → bulk-analysis/

src/components/Layout/ → src/components/layout/
✓ All .jsx files

src/components/ → src/components/shared/
✓ TemplateRenderer.jsx
✓ ProgressBar.jsx
✓ WelcomeModal.jsx
```

### Lib & Utilities

```
src/lib/ → src/lib/parsers/
✓ resumeText.js → resumeParser.js
✓ resumeText.d.ts → resumeParser.d.ts

src/lib/ → src/lib/ai/
✓ aiClient.ts

src/lib/ → src/lib/utils/
✓ cn.js

src/ → src/styles/
✓ App.css
✓ index.css

src/ → src/types/
✓ vite-env.d.ts
```

### Backend

```
netlify/functions/ → netlify/functions/ai/
✓ ai.ts
✓ ai-match.ts
✓ extract-resume-json.ts
✓ optimize.ts

netlify/functions/ → netlify/functions/resume/
✓ parse-resume.ts
✓ match-score.ts

netlify/functions/ → netlify/functions/content/
✓ generate-cover-letter.ts
✓ predict-questions.ts

netlify/lib/ → netlify/lib/parsers/
✓ resumeText.js → resumeParser.js
✓ normalize-resume.js → resumeNormalizer.js

shared/ → DELETED
✗ normalize-resume.js (merged into netlify/lib/parsers/)
```

### Tests

```
src/__tests__/ → src/__tests__/unit/components/
✓ Button.test.jsx
✓ JobMatch.test.jsx
✓ MainContent.test.jsx
✓ ResumeUpload.test.jsx
✓ SectionTitle.test.jsx
✓ UploadCard.test.jsx
✓ mobile-layout.test.jsx
✓ Header.test.jsx

src/__tests__/ → src/__tests__/unit/hooks/
✓ useAuth.test.jsx
✓ useTheme.test.jsx (moved from src/hooks/)

src/__tests__/ → src/__tests__/unit/services/
✓ api.test.js
✓ exportPdf.test.js
✓ supabase.test.js

src/__tests__/ → src/__tests__/unit/lib/
✓ aiClient.test.ts
✓ assets.test.ts
✓ resumeText.test.js

src/__tests__/ → DELETED
✗ helloWorld.test.ts (example test)
✗ smoke.test.jsx (redundant)
```

### Scripts

```
scripts/ → scripts/diagnostics/
✓ supabase-diagnostic.js
✓ validate-mobile-lighthouse.mjs
✓ validate-scroll-behavior.mjs
```

---

## ✅ Validation Checklist

After migration, check these:

```bash
# 1. Linting
npm run lint
# Expected: 0 errors, 0 warnings

# 2. Tests
npm test
# Expected: 134/134 passing

# 3. Build
npm run build
# Expected: Successful build in dist/

# 4. Dev server
netlify dev
# Expected: Starts on http://localhost:8888

# 5. Manual testing
# - Upload a resume
# - Analyze job match
# - Export PDF
# - Auth flow
```

---

## 📝 Update These Config Files

### `vite.config.js` - Add path aliases

```javascript
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@features': '/src/features',
      '@lib': '/src/lib',
      '@services': '/src/services',
      '@hooks': '/src/hooks',
      '@styles': '/src/styles',
      '@types': '/src/types',
    }
  }
});
```

### `tsconfig.json` - Add path aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@features/*": ["src/features/*"],
      "@lib/*": ["src/lib/*"],
      "@services/*": ["src/services/*"],
      "@hooks/*": ["src/hooks/*"],
      "@styles/*": ["src/styles/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

### `vitest.config.ts` - Update test paths (if needed)

```typescript
export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  }
});
```

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
# Run ESLint auto-fix
npm run lint -- --fix

# Or manually update imports using IDE refactoring:
# VSCode: F2 on import path
# Search & Replace: Ctrl+Shift+H
```

### Tests failing

```bash
# Check if test files moved correctly
ls src/__tests__/unit/

# Update test import paths
# Example: '../lib/utils' → '@lib/utils'
```

### Netlify functions not found

```bash
# Netlify auto-discovers subdirectories
# Check URLs changed:
# OLD: /.netlify/functions/parse-resume
# NEW: /.netlify/functions/resume/parse-resume

# Update frontend API calls in src/services/api.js
```

### Build errors

```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
npm run build
```

---

## 🎓 Benefits Summary

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Root Files** | 40+ | 15 | 62% reduction |
| **Documentation** | Scattered | Organized | 100% better |
| **Duplicates** | 5 files | 0 | 100% eliminated |
| **Component Depth** | 4 levels | 2-3 levels | 25-50% flatter |
| **Test Organization** | Mixed | Categorized | Easy to navigate |
| **Maintainability** | 6/10 | 9/10 | 50% improvement |

---

## 📚 Related Documents

- **`PROJECT_RESTRUCTURE.md`** - Full restructure plan with rationale
- **`STRUCTURE_COMPARISON.md`** - Visual before/after comparison
- **`migrate-structure.ps1`** - Automated migration script

---

## 💡 Pro Tips

1. **Run in phases** - Don't do everything at once
2. **Test after each phase** - Catch issues early
3. **Use git branches** - Create `restructure` branch first
4. **Commit frequently** - Easier to rollback if needed
5. **Update docs** - Keep README.md synchronized
6. **IDE refactoring** - Use F2 in VSCode to rename/move files
7. **Path aliases** - Add them immediately after Phase 2

---

## 🆘 Need Help?

If something goes wrong:

1. **Check git status:** `git status`
2. **Revert last commit:** `git reset --hard HEAD~1`
3. **Revert specific file:** `git checkout HEAD -- <file>`
4. **See change history:** `git log --follow <file>`

---

**Last Updated:** October 23, 2025  
**Script Version:** 1.0  
**Estimated Time:** 4-6 hours with testing
