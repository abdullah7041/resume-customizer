# 🚀 AI Resume Optimizer

> **Transform your resume into a job-winning document with AI-powered optimization**

[![Live Demo](https://img.shields.io/badge/Live-Demo-success?style=for-the-badge&logo=netlify)](https://resume-optimizing.netlify.app)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Built with React](https://img.shields.io/badge/Built%20with-React%2019-61dafb?style=for-the-badge&logo=react)](https://react.dev)

**Created by Abdullah** - An intelligent resume optimization platform designed specifically for Saudi Arabia's job market.

---

## ✨ What is this?

**AI Resume Optimizer** helps job seekers create powerful, ATS-friendly resumes using artificial intelligence. The application analyzes your resume against job descriptions, calculates match scores, identifies missing keywords, and provides AI-powered rewrite suggestions—all while maintaining truthfulness and your unique voice.

### Key Features

- **📤 Smart Resume Upload** - Upload PDF/DOCX or paste text with automatic section detection
- **🎯 Job Match Analysis** - Get 0-100 match scores using TF-IDF similarity algorithms
- **✨ AI Optimization** - GPT-5 Nano rewrites sections with stronger language and better keywords
- **📊 Bulk Comparison** - Compare multiple resume versions side-by-side
- **📄 Professional Export** - Download styled or ATS-plain PDFs
- **🔒 Privacy-First** - All processing happens securely; your data stays private

---

## 🛠️ Tech Stack

**Frontend**
- React 19 with Vite 7
- Tailwind CSS v4 with custom design system
- Lucide React icons

**Backend**
- Netlify Functions (TypeScript serverless)
- OpenAI GPT-5 Nano API
- Supabase (auth + storage)

**Key Algorithms**
- TF-IDF similarity scoring
- Keyword extraction and matching
- Multi-layer anti-hallucination prompt engineering

---

## 🎯 How It Works

1. **Upload Resume** → AI extracts and normalizes text
2. **Match to Job** → Calculate similarity score and identify keyword gaps
3. **AI Optimize** → Get intelligent rewrite suggestions
4. **Export PDF** → Download in styled or ATS-plain format

*For detailed step-by-step explanations, visit the [live app](https://resume-optimizing.netlify.app) and click "How it Works" on any feature tab.*

---

## 🌍 Saudi Market Focus

Unlike generic resume tools, this platform is specifically optimized for:
- Vision 2030 skills and workforce requirements
- Arabic and English bilingual support
- Local hiring practices and ATS systems
- Cultural considerations for the MENA region

---

## 📈 Performance

- **Parse Time**: 2-3 seconds (average resume)
- **Match Analysis**: 1-2 seconds (no AI, pure algorithm)
- **AI Optimization**: 8-15 seconds (OpenAI API dependent)
- **Bundle Size**: ~162KB gzipped

---

## 🔒 Privacy & Security

✅ **Server-Side API Keys** - Never exposed to clients  
✅ **Row-Level Security** - Supabase RLS policies  
✅ **No Tracking** - Zero analytics or third-party cookies  
✅ **User Control** - Delete your data anytime  
✅ **Anti-Hallucination** - AI never invents facts

---

## 🙏 Acknowledgments

**Created by Abdullah** - Full-stack developer passionate about democratizing career opportunities through AI.

### Technology Credits
- **OpenAI** - GPT-5 Nano API
- **Supabase** - Backend infrastructure
- **Netlify** - Serverless hosting
- **Tailwind CSS** - Design system
- **Saudi Vision 2030** - Design inspiration

---

## 📄 License

MIT License - Free to use with attribution.

---

<div align="center">

**⭐ [Try it Live](https://resume-optimizing.netlify.app) ⭐**

Made with ❤️ for the Saudi job market by **Abdullah**

</div>
