<div align="center">

# واثق | Watheq

### AI Resume Optimizer for the Saudi Job Market

[![Live Demo](https://img.shields.io/badge/Live_Demo-006C35?style=for-the-badge&logo=netlify&logoColor=white)](https://resume-optimizing.netlify.app)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-8B0000?style=for-the-badge)](./LICENSE)

**Watheq means "confident" in Arabic. That's how your resume should read.**

*Built for Vision 2030 • Arabic & English • ATS-safe*

</div>

---

## ⚠️ Proprietary Software Notice

> **COPYRIGHT © 2025-2026 ABDULLAH. ALL RIGHTS RESERVED.**

This software and its source code are the exclusive intellectual property of **Abdullah**. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited. See [LICENSE](./LICENSE) for full terms.

| ❌ Prohibited Actions |
|----------------------|
| Cloning, forking, or copying this repository |
| Using any code in your own projects |
| Redistributing or reselling this software |
| Creating derivative works |
| Removing or modifying copyright notices |

**Violators will be subject to DMCA takedown requests and legal action.**

For licensing inquiries: Contact the author directly.

---

## What Watheq does

You upload your resume. You paste the job description. Watheq tells you exactly where you stand: a match score from 0 to 100, the keywords you're missing, and rewritten bullets that make your real experience read the way a recruiter needs to see it.

Generic resume tools were built for the US market, in English, for US hiring norms. Watheq was built for Saudi Arabia: full Arabic and English support with proper RTL layouts, targeting tuned to Vision 2030 sectors, and templates that pass the ATS systems local employers use.

Two promises hold everything together:

1. **The AI never invents your career.** It rewrites what's true so it lands harder. Every improved bullet follows Action Verb + Task + Quantified Result, and any inferred number is tagged `(verify)` so you check it before it ships.
2. **The score means something.** 80+ means hireable today. 60-79 means competitive with gaps. Below 60 means real work to do. The scoring rules are written to resist inflation, because a flattering score that gets you rejected helps nobody.

---

## Features

**Parse anything readable.** PDF and DOCX upload with client-side text extraction, automatic English/Arabic detection, and structured JSON Resume output you can edit. Scanned PDFs fall back to OCR for signed-in users. If the AI parser fails on readable text, a deterministic parser still returns your data instead of an error.

**Match analysis.** TF-IDF + cosine similarity scoring against the job description, gap analysis for missing qualifications, and a keyword strategy that weaves missing terms into rewritten bullets rather than dumping them in a list.

**Career red-flag defense.** The optimizer detects gaps, short tenures, pivots, and job hopping in your work history, then rewrites bullets to neutralize those interview questions before they're asked.

**Live progress streaming.** Optimization streams its phases over SSE, so you watch the analysis happen instead of staring at a spinner for 15 seconds.

**Four templates.** Modern Professional, Classic Traditional, Technical Engineer, and ATS Optimized: all RTL/LTR adaptive, all exportable as real selectable-text PDFs via server-side rendering.

**The rest of the application.** AI interview questions predicted from your resume, a cover letter generator with 4 tones, bulk side-by-side comparison of resume versions, and automatic session recovery from localStorage.

---

## How it works

```
Upload Resume → Parse to JSON → Paste Job Description → AI Match Score
                                                              │
                        ◄────── Export PDF ◄── Apply Cards ◄──┘
```

Suggestions arrive as cards. You apply the ones you want; nothing changes without the `applied: true` flag. Your resume stays yours at every step.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                       │
│  React 19 + Vite + Zustand + Tailwind CSS v4 + i18next      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Netlify Functions (API)                   │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ parse-resume │   ai-match   │   optimize   │ generate-pdf  │
│ extract-json │predict-ques  │ cover-letter │  user-data    │
│ referral-api │ waitlist     │  batch-api   │ feedback      │
└──────────────┴──────────────┴──────────────┴───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ OpenRouter  │     │  Supabase   │     │   Upstash   │
   │  (Gemini)   │     │  Auth + DB  │     │    Redis    │
   └─────────────┘     └─────────────┘     └─────────────┘
```

**Stack in one paragraph:** React 19 + Vite + TypeScript on the front, with Zustand for state, Tailwind CSS v4 for styling, i18next for the Arabic/English switch, and Zod validating every boundary. The back end is TypeScript Netlify Functions calling Gemini 2.5 through OpenRouter (a fast `lite` tier for parsing, `flash` for analysis), Supabase for auth and data with RLS enforced, Upstash Redis for rate limiting, and Puppeteer for server-side PDF generation. Vitest, ESLint, Husky, and Sentry keep it honest.

**Numbers:** resume parsing in 2-6 seconds, match analysis in 1-2, full optimization in 8-15. The bundle ships at ~162KB gzipped and holds a 90+ Lighthouse performance score.

---

## Privacy

API keys live server-side only. Supabase row-level security is enforced on every table. There's no analytics, no third-party cookies, and no tracking of any kind. You can delete your data whenever you want (GDPR compliant). Rate limiting runs on a Redis-backed sliding window, and the anti-hallucination rules above apply to everything the AI writes about you.

---

## Project structure

```
resume-customizer/
├── src/
│   ├── components/         # Layout, sections, templates, ui
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, stores, validation
│   ├── locales/            # i18n translations (en, ar)
│   ├── services/           # API clients
│   └── types/              # TypeScript definitions
├── netlify/
│   ├── functions/          # Serverless API endpoints
│   └── lib/                # Shared backend utilities
├── public/                 # Static assets
└── scripts/                # Build & development scripts
```

---

## Credits

**Created by Abdullah**, a full-stack developer who thinks the distance between a good candidate and a good resume shouldn't cost anyone a job.

Built on OpenRouter & Google Gemini, Supabase, Netlify, and Tailwind CSS. Brand inspired by Saudi Vision 2030, in Saudi Green `#006C35`.

---

## 📜 License

**PROPRIETARY LICENSE — NOT OPEN SOURCE**

Copyright © 2025-2026 Abdullah. All rights reserved.

This software is provided for authorized use only. No license is granted for copying, distribution, modification, or any other use without explicit written permission from the copyright holder.

See [LICENSE](./LICENSE) for complete terms.

---

<div align="center">

**[View Live Demo →](https://watheqai.app/)**

**واثق | Watheq** — *Walk in confident.*

© 2025-2026 Abdullah. All Rights Reserved.

</div>
