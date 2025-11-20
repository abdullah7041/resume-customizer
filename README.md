# AI Resume Optimizer

**An intelligent resume optimization platform designed to help job seekers create ATS-friendly resumes with AI-powered analysis and suggestions.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=flat-square&logo=netlify)](https://resume-optimizing.netlify.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

---

## Overview

AI Resume Optimizer analyzes your resume against job descriptions using advanced text processing algorithms and AI. It provides actionable feedback including match scores, keyword gaps, and intelligent rewrite suggestions—all while maintaining factual accuracy and your authentic voice.

### Core Capabilities

- **📄 Smart Resume Parsing** - Extracts text from PDF/DOCX files with OCR fallback for scanned documents
- **🎯 Match Scoring** - TF-IDF based similarity analysis (0-100 score)
- **🔍 Keyword Analysis** - Identifies missing and matched keywords from job descriptions
- **✨ AI Optimization** - Generates stronger bullet point rewrites using OpenAI GPT
- **📊 Bulk Comparison** - Compare multiple resume versions side-by-side
- **🎨 Template Gallery** - Professional resume templates with ATS-friendly formatting
- **✉️ Cover Letter Generator** - AI-powered cover letter creation
- **💼 Interview Prep** - Predicts likely interview questions based on job description
- **🔐 Privacy-First** - No data tracking, local storage only, secure API key handling

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI framework with modern hooks |
| **Vite** | 7.2.2 | Build tool and dev server |
| **Tailwind CSS** | 4.1.17 | Utility-first styling with custom theme |
| **TypeScript** | 5.9.3 | Type safety for critical functions |
| **Lucide React** | 0.554.0 | Icon library |

### Backend (Netlify Functions)
| Technology | Version | Purpose |
|------------|---------|---------|
| **Netlify Functions** | 5.1.0 | Serverless API endpoints |
| **pdfjs-dist** | 5.4.394 | PDF text extraction |
| **Supabase Client** | 2.83.0 | Authentication and storage |
| **DeepSeek OCR** | API | Fallback OCR for scanned PDFs |

### Algorithms & Methods
- **TF-IDF Vectorization** - Document similarity scoring
- **Cosine Similarity** - Semantic matching between resume and job description
- **Entropy Analysis** - Text quality detection for OCR validation
- **Stopword Filtering** - Noise removal for accurate keyword extraction
- **Token-based Scoring** - Asymmetric threshold logic for fair matching

---

## Architecture

### Project Structure

```
resume-customizer/
├── netlify/
│   ├── functions/          # Serverless API endpoints
│   │   ├── parse-resume.ts       # PDF/DOCX text extraction + OCR
│   │   ├── match-score.ts        # TF-IDF similarity scoring
│   │   ├── optimize.ts           # AI-powered bullet rewrites
│   │   ├── ai-match.ts           # Intelligent match analysis
│   │   ├── extract-resume-json.ts # Structured data extraction
│   │   ├── generate-cover-letter.ts
│   │   ├── predict-questions.ts
│   │   └── batch-api.ts          # Bulk resume processing
│   └── lib/                # Shared utilities
│       ├── resumeText.js         # PDF/DOCX parsing logic
│       ├── normalize-resume.js   # Section detection
│       ├── ai-config.ts          # AI model configuration
│       └── rate-limiter.ts       # API throttling
├── src/
│   ├── components/         # React components
│   │   ├── Layout/              # Header, Footer
│   │   ├── Features/            # JobMatch
│   │   └── ui/                  # Reusable UI components
│   ├── features/           # Feature modules
│   │   ├── ResumeUpload.jsx     # File upload & paste interface
│   │   ├── Optimization.jsx     # AI suggestions UI
│   │   ├── KeywordAnalyzer.jsx  # Keyword visualization
│   │   ├── BulkAnalysis.jsx     # Multi-resume comparison
│   │   ├── TemplateGallery.jsx
│   │   ├── CoverLetter.jsx
│   │   └── InterviewPrep.jsx
│   ├── services/           # API clients
│   │   ├── api.js               # Main API interface
│   │   ├── supabase.js          # Database & auth
│   │   └── exportPdf.js         # PDF generation
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities
│   └── styles/             # Global CSS & theme
├── scripts/                # Build & deployment scripts
└── public/                 # Static assets
```

### Data Flow

```
User Upload → Parse Resume (pdfjs/DeepSeek OCR) → Extract & Normalize → Local Storage
                                                                            ↓
User Input Job Description → Match Score (TF-IDF) ← Resume Text ← ────────┘
                                    ↓
                           Display Match Analysis
                                    ↓
                    User Requests Optimization → AI Optimize (OpenAI GPT)
                                    ↓
                          Show Rewrite Suggestions
                                    ↓
                       User Exports PDF (Styled/ATS-Plain)
```

### Key Algorithms

#### 1. OCR Quality Detection (Enhanced)
- **Character Entropy Analysis** - Detects repetitive/garbled text (e.g., "I I I I")
- **Keyword Validation** - Checks for resume-specific terms (experience, education, skills)
- **Repetition Ratio** - Flags if any character appears >40% of the time
- **Short Word Threshold** - Lowered from 70% to 50% for better accuracy

#### 2. Asymmetric Token Scoring
- **Problem**: Original algorithm required BOTH resume AND job description to have 50+ tokens
- **Solution**: Only require resume ≥30 tokens; job description can be any length
- **Result**: Fair scoring regardless of job description brevity

#### 3. Proportional Minimum Scores
- Low-token resumes (10-29 tokens) get proportional minimums
- Prevents 0 scores when OCR extraction is partial but valid
- Score range: 10-40 for low-token, 15-50 for substantial content

---

## Setup Guide

### Prerequisites

- **Node.js**: 22.17.0 or higher ([Download](https://nodejs.org/))
- **npm**: 10.x or higher (comes with Node.js)
- **Netlify CLI**: Install globally with `npm install -g netlify-cli`
- **API Keys**:
  - [OpenAI API Key](https://platform.openai.com/api-keys) (required for AI features)
  - [Supabase Project](https://supabase.com/) (optional, for auth & storage)
  - [DeepSeek API Key](https://platform.deepseek.com/) (optional, for OCR fallback)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/abdullah7041/resume-customizer.git
   cd resume-customizer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root:
   ```env
   # OpenAI Configuration (Required for AI features)
   OPENAI_API_KEY=sk-...your-key-here

   # Supabase Configuration (Optional - for auth/storage)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

   # DeepSeek OCR (Optional - for scanned PDF fallback)
   DEEPSEEK_API_KEY=sk-...your-key-here

   # Mock AI for testing without API keys (Development only)
   VITE_USE_MOCK_AI=false
   ```

4. **Start the development server**
   ```bash
   netlify dev
   ```

   The app will be available at: **http://localhost:8888**

5. **Build for production**
   ```bash
   npm run build
   ```

### Deployment

The project is configured for **Netlify** deployment:

```bash
# Deploy to production
netlify deploy --prod

# Or use continuous deployment via Git
# Push to main branch → Netlify auto-deploys
```

**Environment Variables on Netlify:**
1. Go to Site Settings → Build & Deploy → Environment Variables
2. Add the same keys from your `.env` file
3. Redeploy the site

---

## Usage Examples

### 1. Basic Resume Analysis

```bash
# Upload a resume PDF
curl -X POST http://localhost:8888/.netlify/functions/parse-resume \
  -H "Content-Type: application/json" \
  -d '{"kind": "file", "name": "resume.pdf", "mime": "application/pdf", "data": "base64-encoded-pdf-data"}'

# Response
{
  "document": {
    "plainText": "John Doe\nSoftware Engineer...",
    "bullets": ["• Led team of 5 engineers...", "• Reduced latency by 40%"],
    "sections": [...]
  },
  "usedOCR": false,
  "quality": 0.92,
  "warnings": []
}
```

### 2. Calculate Match Score

```bash
curl -X POST http://localhost:8888/.netlify/functions/match-score \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "Experienced React developer with 5 years in frontend development...",
    "jobDesc": "Looking for a React developer with experience in TypeScript..."
  }'

# Response
{
  "score": 78,
  "coverage": 0.65,
  "similarity": 0.72,
  "matched_keywords": ["react", "developer", "typescript", "frontend"],
  "missing_keywords": ["node", "docker"]
}
```

### 3. AI Optimization

```bash
curl -X POST http://localhost:8888/.netlify/functions/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "resumeText": "Worked on web applications using React",
    "jobDesc": "Senior React Developer needed",
    "mode": "enhance"
  }'

# Response
{
  "cards": [
    {
      "original": "Worked on web applications using React",
      "optimized": "Architected and delivered scalable React web applications..."
    }
  ],
  "keywords": { "add": ["scalable", "delivered"], "remove": [], "neutral": ["react"] }
}
```

---

## Troubleshooting

### Common Issues

**❌ 503 Error on AI endpoints**
- **Cause**: Missing or invalid `OPENAI_API_KEY`
- **Fix**: Verify your `.env` file contains a valid OpenAI API key with available credits
- **Restart**: Run `netlify dev` again after adding environment variables

**❌ Match score returns 0 for valid resumes**
- **Fixed in v2.0**: Enhanced OCR quality detection
- **Solution**: Update to latest version with improved entropy analysis
- **Fallback**: Use text paste instead of PDF upload

**❌ PDF parsing fails for scanned documents**
- **Cause**: PDF contains images instead of selectable text
- **Fix**: Set `DEEPSEEK_API_KEY` in `.env` for automatic OCR fallback
- **Alternative**: Convert scanned PDF to text-based PDF using Adobe Acrobat or similar

**❌ Dark mode text is hard to read**
- **Fixed in v2.0**: Improved contrast ratios to meet WCAG AA standards
- **Update**: Pull latest changes from `main` branch

---

## Performance Metrics

| Operation | Average Time | Notes |
|-----------|-------------|-------|
| PDF Parsing (Text-based) | 2-3 seconds | Using pdfjs-dist |
| PDF Parsing (Scanned) | 8-12 seconds | Using DeepSeek OCR fallback |
| Match Score Calculation | 1-2 seconds | Pure algorithm, no API calls |
| AI Optimization | 8-15 seconds | Depends on OpenAI API latency |
| Keyword Analysis | <1 second | Client-side processing |
| Bundle Size (gzipped) | ~162 KB | Optimized with Vite code splitting |

**Optimization Strategies:**
- Lazy loading for non-critical components
- Debounced input for real-time analysis
- Local storage caching for parsed resumes
- Retry logic with exponential backoff for API calls

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes with descriptive messages
4. **Test** thoroughly in development mode
5. **Push** to your branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request with detailed description

**Code Standards:**
- Use TypeScript for serverless functions
- Follow existing code style (ESLint + Prettier)
- Add tests for algorithm changes
- Document complex logic with comments

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Abdullah

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Acknowledgments

**Created by Abdullah** - Full-stack developer passionate about improving career outcomes through technology.

### Technology Credits
- [OpenAI](https://openai.com/) - GPT models for intelligent optimization
- [Supabase](https://supabase.com/) - Backend infrastructure and authentication
- [Netlify](https://www.netlify.com/) - Serverless hosting and edge functions
- [Tailwind CSS](https://tailwindcss.com/) - Modern utility-first styling
- [pdfjs-dist](https://github.com/mozilla/pdf.js) - PDF text extraction (Mozilla)
- [DeepSeek](https://www.deepseek.com/) - OCR fallback for scanned documents

### Inspiration
This project was built with Saudi Arabia's Vision 2030 workforce development goals in mind, focusing on democratizing access to career tools for job seekers across the MENA region.

---

<div align="center">

**[🚀 Try it Live](https://resume-optimizing.netlify.app)**

Made with precision and care by **Abdullah**

</div>
