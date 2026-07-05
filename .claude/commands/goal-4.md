# Goal 4: Cut the entry bundle

**Model**: Opus direct. No Fable needed.

Reduce Watheq's entry bundle. Measured 2026-07-02: `dist/assets/index-*.js` = 700K, plus an anonymous 392K `dist-*.js` chunk.

Step 1: add rollup-plugin-visualizer (dev only), build, and report what's inside `index-*.js` and what the 392K `dist-*.js` chunk is. Diagnose before changing anything.

Step 2: propose the split list (lazy routes/sections, deps to move out of entry). OptimizeSection/MatchSection are already lazy chunks — follow that pattern.

Landmines from CLAUDE.md (`vite.config.js` manualChunks):

- `@sentry` must stay in ONE chunk (vendor-sentry) — circular deps break if split.
- `react-i18next` + `i18next` must stay in vendor-core with react/react-dom.
- Do not split those.

Acceptance: `npm run build` succeeds, index chunk meaningfully smaller (aim <400K), report before/after sizes per chunk, smoke the main flows (upload → match → optimize → template preview). Run lint / type:check / test as separate sequential commands, NOT `quality:parallel`.
