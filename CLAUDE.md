# Project: Resume Customizer

## Tech Stack
- React 19 + Vite 7
- Tailwind CSS v4
- Netlify Functions (TypeScript)
- Supabase (auth + storage)
- Gemini API

## Commands
- `npm run dev` - Local dev server
- `npm run dev:netlify` - Dev with serverless functions
- `npm run build` - Production build
- `npm run test` - Run tests

## Architecture Rules
1. All API keys stay in Netlify Functions, never client-side
2. Use Zustand for global state, React state for local
3. All text must support i18n (Arabic RTL + English LTR)
4. Components go in src/components/, utilities in src/lib/

## Current Focus
- Glassmorphism design system
- Features to sections merge

## Do NOT
- Install puppeteer (too large for Netlify)
- Use localStorage for sensitive data
- Hardcode Arabic/English strings (use i18n)