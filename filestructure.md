# File Structure

## Root Directory

- `.claude/` - Claude AI configuration
- `.github/` - GitHub workflows and templates
- `.netlify/` - Netlify build artifacts and configuration
- `.vscode/` - VS Code configuration
- `dist/` - Production build output
- `netlify/` - Netlify serverless functions and libraries
- `public/` - Static assets
- `scripts/` - Build and maintenance scripts
- `src/` - Source code
- `AI_INSTRUCTIONS.md`
- `CLAUDE.md` - Claude specific project guidelines
- `README.md`
- `eslint.config.js` - ESLint configuration
- `index.html` - Entry HTML file
- `netlify.toml` - Netlify configuration
- `package.json` - Project dependencies and scripts
- `package-lock.json`
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `vite.config.js` - Vite configuration
- `vitest.config.ts` - Vitest configuration

## Source Code (`src/`)

- `__tests__/` - Top-level tests
- `assets/` - Images and other static assets
- `components/` - React components
  - `Features/` - Specific feature sub-components
  - `Layout/` - Layout components (Header, Footer, etc.)
  - `analysis/` - Analysis components
  - `compliance/` - Compliance components
  - `providers/` - Context providers
  - `shared/` - Shared utility components
  - `templates/` - Resume templates
  - `ui/` - Reusable UI components (Buttons, Inputs, etc.)
  - `LandingPage.jsx`
  - `MainContent.jsx`
  - `ProgressBar.jsx`
  - `TemplateRenderer.jsx`
  - `WelcomeModal.jsx`
- `data/` - Static data files
  - `helpContent.jsx`
  - `resumeTemplates.js`
- `features/` - Main feature components
  - `BulkAnalysis.jsx`
  - `CoverLetter.jsx`
  - `InterviewPrep.jsx`
  - `KeywordAnalyzer.jsx`
  - `Optimization.jsx`
  - `ResumeUpload.jsx`
  - `TemplateGallery.jsx`
- `hooks/` - Custom React hooks
  - `useAuth.jsx`
  - `useKeywordAnalysis.js`
  - `useTheme.js`
- `lib/` - Libraries and utilities
  - `apiStatus.js`
  - `assets.ts`
  - `i18n.ts`
  - `resumeText.js`
- `locales/` - i18n locales
- `pages/` - Route pages
- `services/` - External service integrations
  - `api.js` - API utilities
  - `exportPdf.js` - PDF export logic
  - `keywordAnalyzer.js`
  - `supabase.js`
  - `supabaseExport.js`
- `styles/` - Global styles
- `test/` - Test setup
- `types/` - TypeScript type definitions
- `utils/` - General utilities
  - `resumeUtils.js`
  - `templatePreviews.js`
- `App.jsx` - Main application component
- `index.css` - Global CSS
- `main.tsx` - Application entry point
- `vite-env.d.ts`

## Netlify Functions (`netlify/functions/`)

- `ai-match.ts`
- `batch-api.ts`
- `delete-user-data.ts`
- `export-user-data.ts`
- `extract-resume-json.ts`
- `generate-cover-letter.ts`
- `match-score.ts`
- `optimize.ts`
- `parse-arabic-resume.ts`
- `parse-resume.ts`
- `predict-questions.ts`

## Scripts (`scripts/`)

- `build.mjs`
- `capture-mobile-screenshots.mjs`
- `supabase-diagnostic.js`
- `validate-mobile-lighthouse.mjs`
- `validate-scroll-behavior.mjs`
