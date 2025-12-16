# Claude Code Instruction: Codebase Cleanup & Reorganization

## Context
The codebase has evolved organically and now has duplicate structures, mixed file types, and scattered utilities. This instruction consolidates everything into a clean, maintainable structure.

## Phase 1: Remove Duplicate Structures

### Step 1.1: Consolidate Feature Components

The project has two feature locations:
- `src/features/` (contains: BulkAnalysis, CoverLetter, InterviewPrep, KeywordAnalyzer, Optimization, ResumeUpload, TemplateGallery)
- `src/components/Features/` (unknown contents)

**Action:** Keep `src/features/` as the canonical location. Move any unique components from `src/components/Features/` to `src/features/`, then delete `src/components/Features/`.

```bash
# Check what's in components/Features/
ls -la src/components/Features/

# If it contains unique files, move them
mv src/components/Features/*.jsx src/features/

# Remove the duplicate folder
rm -rf src/components/Features/
```

### Step 1.2: Consolidate Utilities

Merge `src/utils/` into `src/lib/utils/`:

```bash
# Create proper utils structure
mkdir -p src/lib/utils

# Move utility files
mv src/utils/resumeUtils.js src/lib/utils/resumeUtils.ts
mv src/utils/templatePreviews.js src/lib/utils/templatePreviews.ts

# Remove old folder
rm -rf src/utils/
```

### Step 1.3: Consolidate Data Files

Move `src/data/` into `src/lib/data/`:

```bash
# Create data directory in lib
mkdir -p src/lib/data

# Move data files
mv src/data/helpContent.jsx src/lib/data/helpContent.tsx
mv src/data/resumeTemplates.js src/lib/data/resumeTemplates.ts

# Remove old folder
rm -rf src/data/
```

## Phase 2: Organize Loose Components

### Step 2.1: Move Root Components to Proper Locations

Current loose files in `src/components/`:
```
LandingPage.jsx     → src/pages/LandingPage.tsx
MainContent.jsx     → src/components/Layout/MainContent.tsx
ProgressBar.jsx     → src/components/ui/ProgressBar.tsx
TemplateRenderer.jsx → src/components/templates/TemplateRenderer.tsx
WelcomeModal.jsx    → src/components/ui/WelcomeModal.tsx
```

```bash
# Move to appropriate locations
mv src/components/LandingPage.jsx src/pages/LandingPage.tsx
mv src/components/MainContent.jsx src/components/Layout/MainContent.tsx
mv src/components/ProgressBar.jsx src/components/ui/ProgressBar.tsx
mv src/components/TemplateRenderer.jsx src/components/templates/TemplateRenderer.tsx
mv src/components/WelcomeModal.jsx src/components/ui/WelcomeModal.tsx
```

## Phase 3: Convert JSX to TSX

### Step 3.1: Batch Rename Files

Convert all `.jsx` files to `.tsx`:

```bash
# Find and rename all jsx files
find src -name "*.jsx" -exec bash -c 'mv "$0" "${0%.jsx}.tsx"' {} \;

# Update imports in the codebase
# (Claude Code will handle import path updates as part of the conversion)
```

### Step 3.2: Add Type Annotations

For each converted file, add proper TypeScript types. Example pattern:

**Before (JSX):**
```jsx
export function MyComponent({ title, onSubmit }) {
  return <div onClick={onSubmit}>{title}</div>;
}
```

**After (TSX):**
```tsx
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  return <div onClick={onSubmit}>{title}</div>;
}
```

## Phase 4: Clean Up lib/ Directory

### Current State:
```
src/lib/
├── apiStatus.js      → Should be in src/lib/utils/
├── assets.ts         → Keep
├── i18n.ts           → Keep
├── resumeText.js     → Should be in src/lib/utils/
```

### Target State:
```
src/lib/
├── data/
│   ├── helpContent.ts
│   ├── resumeTemplates.ts
│   └── vision2030Skills.ts
├── stores/
│   ├── consentStore.ts
│   └── resumeStore.ts
├── styles/
│   └── glass.ts
├── utils/
│   ├── arabicTextUtils.ts
│   ├── arabicResumeParser.ts
│   ├── arabicPdfExtractor.ts
│   ├── arabicKeywordMatcher.ts
│   ├── vision2030Analyzer.ts
│   ├── pdfExport.ts
│   ├── resumeUtils.ts
│   ├── templatePreviews.ts
│   ├── apiStatus.ts
│   └── resumeText.ts
├── i18n.ts
└── assets.ts
```

### Commands:
```bash
# Create new structure
mkdir -p src/lib/stores
mkdir -p src/lib/styles
mkdir -p src/lib/utils
mkdir -p src/lib/data

# Move existing files
mv src/lib/apiStatus.js src/lib/utils/apiStatus.ts
mv src/lib/resumeText.js src/lib/utils/resumeText.ts
```

## Phase 5: Verify Existing Files Before Creating New Ones

Before creating any new file, check if it already exists:

### Files to CHECK before creating:

```bash
# Check if DirectionProvider exists
cat src/components/providers/DirectionProvider.tsx 2>/dev/null || echo "NEEDS CREATION"

# Check if glass styles exist
cat src/lib/styles/glass.ts 2>/dev/null || echo "NEEDS CREATION"

# Check if resume store exists
cat src/lib/stores/resumeStore.ts 2>/dev/null || echo "NEEDS CREATION"

# Check if consent store exists
cat src/lib/stores/consentStore.ts 2>/dev/null || echo "NEEDS CREATION"

# Check if GlassCard exists
cat src/components/ui/GlassCard.tsx 2>/dev/null || echo "NEEDS CREATION"

# Check existing templates
ls src/components/templates/

# Check existing analysis components
ls src/components/analysis/

# Check existing compliance components
ls src/components/compliance/
```

## Phase 6: Update Imports

After reorganization, update all imports across the codebase:

### Common Import Changes:
```typescript
// OLD
import { resumeUtils } from '../utils/resumeUtils';
import { helpContent } from '../data/helpContent';

// NEW
import { resumeUtils } from '@/lib/utils/resumeUtils';
import { helpContent } from '@/lib/data/helpContent';
```

### Add Path Alias to tsconfig.json:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/lib/*": ["src/lib/*"],
      "@/features/*": ["src/features/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

### Add to vite.config.js:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

## Phase 7: Final File Structure

After cleanup, the structure should be:

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── MainContent.tsx
│   │   └── Sidebar.tsx
│   ├── analysis/
│   │   └── Vision2030Score.tsx
│   ├── compliance/
│   │   ├── ConsentBanner.tsx
│   │   └── UserDataRights.tsx
│   ├── providers/
│   │   └── DirectionProvider.tsx
│   ├── sections/
│   │   ├── UploadCard.tsx
│   │   ├── MatchSection.tsx
│   │   ├── OptimizeSection.tsx
│   │   ├── KeywordsSection.tsx
│   │   ├── InterviewSection.tsx
│   │   ├── CoverLetterSection.tsx
│   │   └── BulkAnalysisSection.tsx
│   ├── shared/
│   │   └── (shared utility components)
│   ├── templates/
│   │   ├── BaseTemplate.tsx
│   │   ├── ModernProfessional.tsx
│   │   ├── ClassicTraditional.tsx
│   │   ├── TemplateSelector.tsx
│   │   ├── TemplateRenderer.tsx
│   │   ├── ResumePreview.tsx
│   │   └── index.ts
│   └── ui/
│       ├── GlassCard.tsx
│       ├── GlassButton.tsx
│       ├── GlassInput.tsx
│       ├── GlassTabs.tsx
│       ├── ProgressBar.tsx
│       ├── WelcomeModal.tsx
│       └── LanguageSwitcher.tsx
├── features/
│   ├── BulkAnalysis.tsx
│   ├── CoverLetter.tsx
│   ├── InterviewPrep.tsx
│   ├── KeywordAnalyzer.tsx
│   ├── Optimization.tsx
│   ├── ResumeUpload.tsx
│   └── TemplateGallery.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useKeywordAnalysis.ts
│   └── useTheme.ts
├── lib/
│   ├── data/
│   │   ├── helpContent.ts
│   │   ├── resumeTemplates.ts
│   │   └── vision2030Skills.ts
│   ├── stores/
│   │   ├── consentStore.ts
│   │   └── resumeStore.ts
│   ├── styles/
│   │   └── glass.ts
│   ├── utils/
│   │   ├── arabicTextUtils.ts
│   │   ├── arabicResumeParser.ts
│   │   ├── arabicPdfExtractor.ts
│   │   ├── arabicKeywordMatcher.ts
│   │   ├── vision2030Analyzer.ts
│   │   ├── pdfExport.ts
│   │   ├── resumeUtils.ts
│   │   ├── templatePreviews.ts
│   │   ├── apiStatus.ts
│   │   └── resumeText.ts
│   ├── i18n.ts
│   └── assets.ts
├── locales/
│   ├── en.json
│   └── ar.json
├── pages/
│   ├── LandingPage.tsx
│   ├── PrivacyPolicy.tsx
│   └── (other pages)
├── services/
│   ├── api.ts
│   ├── exportPdf.ts
│   ├── keywordAnalyzer.ts
│   ├── supabase.ts
│   └── supabaseExport.ts
├── styles/
│   └── (global styles)
├── types/
│   ├── resume.ts
│   └── index.ts
├── App.tsx
├── index.css
└── main.tsx
```

## Phase 8: Files to Create (Only If Missing)

After running the checks in Phase 5, create ONLY the files that don't exist:

### Priority 1: Core Glass Design System (if missing)
1. `src/lib/styles/glass.ts`
2. `src/components/ui/GlassCard.tsx`
3. `src/components/ui/GlassButton.tsx`
4. `src/components/ui/GlassInput.tsx`
5. `src/components/ui/GlassTabs.tsx`

### Priority 2: State Management (if missing)
1. `src/lib/stores/resumeStore.ts`
2. `src/lib/stores/consentStore.ts`

### Priority 3: Section Components (if missing)
1. `src/components/sections/UploadCard.tsx`
2. `src/components/sections/MatchSection.tsx`
3. `src/components/sections/OptimizeSection.tsx`
4. `src/components/sections/KeywordsSection.tsx`
5. `src/components/sections/InterviewSection.tsx`
6. `src/components/sections/CoverLetterSection.tsx`
7. `src/components/sections/BulkAnalysisSection.tsx`

### Priority 4: Templates (if missing)
1. `src/components/templates/BaseTemplate.tsx`
2. `src/components/templates/ModernProfessional.tsx`
3. `src/components/templates/ClassicTraditional.tsx`
4. `src/components/templates/TemplateSelector.tsx`
5. `src/components/templates/ResumePreview.tsx`
6. `src/components/templates/index.ts`

### Priority 5: Saudi Features (if missing)
1. `src/lib/data/vision2030Skills.ts`
2. `src/lib/utils/vision2030Analyzer.ts`
3. `src/components/analysis/Vision2030Score.tsx`
4. `src/lib/utils/arabicTextUtils.ts`
5. `src/lib/utils/arabicResumeParser.ts`
6. `src/lib/utils/arabicPdfExtractor.ts`
7. `src/lib/utils/arabicKeywordMatcher.ts`

## Cleanup Commands Summary

Run these in order:

```bash
# 1. Remove duplicate feature folder
rm -rf src/components/Features/

# 2. Consolidate utilities
mkdir -p src/lib/utils
mv src/utils/* src/lib/utils/ 2>/dev/null
rm -rf src/utils/

# 3. Consolidate data
mkdir -p src/lib/data
mv src/data/* src/lib/data/ 2>/dev/null
rm -rf src/data/

# 4. Organize loose lib files
mv src/lib/apiStatus.js src/lib/utils/apiStatus.ts 2>/dev/null
mv src/lib/resumeText.js src/lib/utils/resumeText.ts 2>/dev/null

# 5. Move loose components
mv src/components/LandingPage.jsx src/pages/LandingPage.tsx 2>/dev/null
mv src/components/MainContent.jsx src/components/Layout/MainContent.tsx 2>/dev/null
mv src/components/ProgressBar.jsx src/components/ui/ProgressBar.tsx 2>/dev/null
mv src/components/TemplateRenderer.jsx src/components/templates/TemplateRenderer.tsx 2>/dev/null
mv src/components/WelcomeModal.jsx src/components/ui/WelcomeModal.tsx 2>/dev/null

# 6. Create missing directories
mkdir -p src/lib/stores
mkdir -p src/lib/styles
mkdir -p src/components/sections

# 7. Convert all jsx to tsx
find src -name "*.jsx" -exec bash -c 'mv "$0" "${0%.jsx}.tsx"' {} \;

# 8. Convert all js to ts (except config files)
find src -name "*.js" ! -name "*.config.js" -exec bash -c 'mv "$0" "${0%.js}.ts"' {} \;
```

## Verification Checklist

After cleanup, verify:

- [ ] No `src/components/Features/` folder exists
- [ ] No `src/utils/` folder exists (merged into `src/lib/utils/`)
- [ ] No `src/data/` folder exists (merged into `src/lib/data/`)
- [ ] No `.jsx` files remain in `src/`
- [ ] No loose components in `src/components/` root
- [ ] All imports resolve correctly
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] App loads in browser
