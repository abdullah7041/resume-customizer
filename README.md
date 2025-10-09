# 📄 AI Resume Optimizer

Make your resume match the job—fast. Compare a resume to a job description and get concrete, ATS-friendly improvements.

**Live app:** https://<your-site>.netlify.app  
**Status:** MVP (Job Match in progress)

---

## 🖥️ What you can do
- Upload a resume (PDF/DOCX or paste text)
- Paste a job description
- Get a match score, missing keywords, and clear rewrite suggestions
- Export styled or ATS-plain PDF versions of your resume

> ⚠️ **Privacy:** Resumes are stored in Supabase Storage (`resumes/`) for processing. No keys are exposed client-side. You can delete your file from your account at any time.

---

## 🚀 Deployment notes
- The repository no longer contains the nested `resume-customizer/` Git submodule that previously broke GitHub Pages builds. Make sure future commits avoid reintroducing that path so Actions can check out the project without submodule configuration.

---

## 🧩 How it works (high level)
- Extracts text from the resume (client)
- Sends minimal text to the AI matcher (server function / API adapter)
- Returns `{ score 0–100, missingKeywords[], suggestions[] }` to the UI

## 🤖 AI defaults
- OpenAI defaults (model + temperature) are centralized in [`netlify/lib/ai-config.ts`](netlify/lib/ai-config.ts).
- The Netlify proxy at [`/.netlify/functions/ai`](netlify/functions/ai.ts) calls the OpenAI Responses API with `model="gpt-5-nano"` and `temperature=1` unless overridden.
- Requests may provide `max_output_tokens` or the compatibility alias `max_completion_tokens`; both the client (`src/lib/aiClient.ts`) and proxy normalize the alias to `max_output_tokens` and clamp the value between 1 and 4096.

### Local AI proxy

Run the Netlify function alongside Vite when developing locally:

```bash
# Install Netlify CLI if needed
npm install -g netlify-cli

# From the project root, start the dev server + functions
netlify dev
```

The CLI proxies `/\.netlify/functions/ai` to the local TypeScript function so the app can hit the mocked OpenAI endpoint without additional configuration.

### analyzeResume(resumeText, jobText)

Analyzes a resume against a job description and returns:

```js
{
  score: 0-100,
  missingKeywords: string[],
  suggestions: string[]
}
```

## 🔐 Environment Variables

Set these variables in your Netlify project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_KEY`
- `VITE_BUILD_ID` *(optional for local builds; production builds inject a timestamp automatically via `scripts/build.mjs`)*

### Hero skyline & cache busting
- The hero skyline URL lives in [`src/lib/assets.ts`](src/lib/assets.ts) as a Supabase public asset.
- `withVersion()` appends `?v=<VITE_BUILD_ID>` (or `__dev__` locally) so each deploy invalidates cached hero images.

---

## 🖼️ Screenshots
<!-- Add 2–3 images here: upload to /public and link them -->

## 🎨 Saudi Edition design system
- Theme tokens live in [`src/styles/theme.css`](src/styles/theme.css) and drive Tailwind v4 utilities.
- Primary gradient flows from deep teal `#075951` to emerald `#34D399`, with Saudi gold (`#F4D37D`) for accents.
- Surface neutrals: sand (`#F7F2E7`), dune (`#E7DFCF`), smoke (`#F3F4F6`), and ink (`#1F2937`). Dark mode targets `#0F0F12`.
- State colors: success `#12B981`, warning `#F59E0B`, danger `#EF4444`.
- Typography stacks `"Inter", "Geist", "Tajawal"` with generous tracking for headings.
- Radius & elevation tokens (`--radius-card`, `--shadow-card`) create rounded, glassy surfaces.

## 🧪 Testing & rolling back the refresh
1. Install dependencies and run checks:
   ```bash
   npm ci
   npm run lint
   npm run test
   ```
2. If you want to undo the changes after testing, reset to the previous commit (replace `HEAD~1` with the commit you trust):
   ```bash
   git reset --hard HEAD~1
   ```
   Or create a new revert commit so the history records the rollback:
   ```bash
   git revert <commit-sha>
   ```

### Extending the system
1. Add new tokens or gradients inside `src/styles/theme.css`.
2. Reference them via Tailwind classes (e.g., `bg-surface-50`, `from-primary-500`, `shadow-card`).
3. For bespoke components, prefer composing the shared UI primitives in `src/components/ui` (`Button`, `Card`, `Input`, `Tabs`, `Toast`).
4. Keep focus-visible rings on interactive elements (`focus-visible:ring-secondary-500`) to preserve accessibility.

