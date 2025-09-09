# 📄 AI Resume Optimizer

Make your resume match the job—fast. Compare a resume to a job description and get concrete, ATS-friendly improvements.

**Live app:** https://<your-site>.netlify.app  
**Status:** MVP (Job Match in progress)

---

## 🖥️ What you can do
- Upload a resume (PDF/DOCX or paste text)
- Paste a job description
- Get a match score, missing keywords, and clear rewrite suggestions

> ⚠️ **Privacy:** Resumes are stored in Supabase Storage (`resumes/`) for processing. No keys are exposed client-side. You can delete your file from your account at any time.

---

## 🧩 How it works (high level)
- Extracts text from the resume (client)
- Sends minimal text to the AI matcher (server function / API adapter)
- Returns `{ score 0–100, missingKeywords[], suggestions[] }` to the UI

---

## 🖼️ Screenshots
<!-- Add 2–3 images here: upload to /public and link them -->