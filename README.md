<div align="center">

# وثّق | Watheq

### AI Resume Optimizer for Saudi Arabia's Job Market

[![Live Demo](https://img.shields.io/badge/🚀_Live-Demo-006C35?style=for-the-badge&logo=netlify)](https://resume-optimizing.netlify.app)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

<br/>

**Transform your resume into a job-winning document with AI-powered optimization**

*Designed for Vision 2030 • Bilingual Arabic/English • ATS-Friendly*

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

## 🎯 About Watheq

**Watheq** (وثّق) is an intelligent AI-powered resume optimization platform built specifically for **Saudi Arabia's job market**. It helps job seekers create powerful, ATS-friendly resumes that align with Vision 2030 sector needs and modern hiring standards.

### Why Watheq?

| Traditional Resume Tools | Watheq |
|-------------------------|--------|
| Generic optimization | Saudi market-specific targeting |
| English-only support | Full Arabic/English bilingual support |
| Basic keyword matching | AI-powered TF-IDF similarity analysis |
| Manual editing | Intelligent optimization suggestions |
| Static templates | Dynamic RTL/LTR adaptive templates |

---

## ✨ Key Features

### 📄 Smart Resume Processing
- **PDF/DOCX Upload** — Automatic text extraction with section detection
- **Structured JSON Parsing** — Clean, editable JSON Resume format
- **Language Detection** — Auto-detects English vs Arabic content

### 📊 AI-Powered Analysis
- **Match Score (0-100)** — TF-IDF + cosine similarity algorithms
- **Gap Analysis** — Identifies missing qualifications
- **Keyword Strategy** — Highlights critical missing keywords

### ✍️ Intelligent Optimization
- **GPT-Powered Rewrites** — Stronger action verbs and impact statements
- **Section-by-Section Suggestions** — Granular optimization cards
- **Ethical AI** — Never invents facts; only enhances what exists

### 🎨 Professional Templates
| Template | Best For |
|----------|----------|
| Modern Professional | Clean, minimal design (emerald theme) |
| Classic Traditional | Serif-based, two-column layout |
| Technical Engineer | Skills-first for tech roles |
| ATS Optimized | Single-column for applicant tracking systems |

### 📥 Export Options
- **Styled PDF** — Beautiful, design-forward resumes
- **ATS-Friendly PDF** — Optimized for automated screening
- **Print-Ready** — Direct browser printing support

### 🛡️ Additional Features
- **Interview Prep** — AI-generated questions based on your resume
- **Cover Letter Generator** — Tailored cover letters for each job
- **Bulk Comparison** — Compare multiple resume versions side-by-side
- **Session Recovery** — Automatic localStorage persistence

---

## 🇸🇦 Saudi Market Focus

Unlike generic resume tools, Watheq is specifically optimized for:

- 🏛️ **Vision 2030** skills and workforce requirements
- 🌐 **Arabic & English** bilingual support with RTL layouts
- 📋 Local hiring practices and ATS systems
- 🎨 Cultural considerations for the MENA region
- 🎯 Saudi-themed UI with Saudi Green (`#006C35`) branding

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI Framework |
| Vite | 7.3 | Build Tool |
| TypeScript | 5.9 | Type Safety |
| Tailwind CSS | 4.1 | Styling |
| Zustand | 5.0 | State Management |
| i18next | 25.7 | Internationalization |
| Zod | 4.3 | Schema Validation |

### Backend (Serverless)
| Technology | Purpose |
|------------|---------|
| Netlify Functions | TypeScript serverless API |
| Google Gemini API | AI processing (2.5-flash) |
| Supabase | Auth + Database + Storage |
| Upstash Redis | Rate limiting |
| Puppeteer | Server-side PDF generation |

### Development & Quality
| Tool | Purpose |
|------|---------|
| Vitest | Unit Testing |
| ESLint | Code Linting |
| Husky | Git Hooks |
| Sentry | Error Tracking |

---

## ⚡ Performance

| Metric | Value |
|--------|-------|
| Resume Parse Time | 2-3 seconds |
| Match Analysis | 1-2 seconds |
| AI Optimization | 8-15 seconds |
| Bundle Size | ~162KB gzipped |
| Lighthouse Score | 90+ Performance |

---

## 🔒 Privacy & Security

| Feature | Implementation |
|---------|----------------|
| **API Keys** | Server-side only, never exposed |
| **Row-Level Security** | Supabase RLS policies enforced |
| **No Tracking** | Zero analytics or third-party cookies |
| **User Control** | Delete your data anytime (GDPR compliant) |
| **Anti-Hallucination** | AI never invents facts about you |
| **Rate Limiting** | Redis-backed sliding window protection |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                       │
│  React 19 + Vite + Zustand + Tailwind CSS v4 + i18next     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Netlify Functions (API)                   │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ parse-resume │   ai-match   │   optimize   │ generate-pdf  │
│ extract-json │predict-ques  │ cover-letter │  batch-api    │
└──────────────┴──────────────┴──────────────┴───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   Gemini    │     │  Supabase   │     │   Upstash   │
   │  2.5-flash  │     │  Auth + DB  │     │    Redis    │
   └─────────────┘     └─────────────┘     └─────────────┘
```

### User Flow
```
Upload Resume → Parse to JSON → Paste Job Description → AI Match Score
                                                              │
                        ◄────── Export PDF ◄── Apply Cards ◄──┘
```

---

## 📁 Project Structure

```
resume-customizer/
├── src/
│   ├── components/         # React components
│   │   ├── Layout/        # MainContent, Header
│   │   ├── sections/      # Upload, Score, Optimize, Templates
│   │   ├── templates/     # Resume templates + PDF exports
│   │   └── ui/            # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities, stores, validation
│   ├── locales/           # i18n translations (en, ar)
│   ├── services/          # API clients
│   └── types/             # TypeScript definitions
├── netlify/
│   ├── functions/         # Serverless API endpoints
│   └── lib/               # Shared backend utilities
├── public/                # Static assets
└── scripts/               # Build & development scripts
```

---

## 🙏 Credits

**Created by Abdullah** — Full-stack developer passionate about democratizing career opportunities through AI.

### Technology Acknowledgments

- **Google** — Gemini API for AI processing
- **Supabase** — Backend infrastructure
- **Netlify** — Serverless hosting
- **Tailwind CSS** — Design system
- **Saudi Vision 2030** — Brand inspiration

---

## 📜 License

**PROPRIETARY LICENSE — NOT OPEN SOURCE**

Copyright © 2025-2026 Abdullah. All rights reserved.

This software is provided for authorized use only. No license is granted for copying, distribution, modification, or any other use without explicit written permission from the copyright holder.

See [LICENSE](./LICENSE) for complete terms.

---

<div align="center">

**[🚀 View Live Demo](https://resume-optimizing.netlify.app)**

*Built with ❤️ for the Saudi job market*

---

**وثّق | Watheq** — *Document your success*

© 2025-2026 Abdullah. All Rights Reserved.

</div>
