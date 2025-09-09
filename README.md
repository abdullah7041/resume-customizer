
# 📄 AI Resume Optimizer

> By **Abdullah bin Ahmed**

An AI-powered web application that helps job seekers **optimize their resumes** against specific job descriptions.
Built with **React + Vite + Tailwind v4 + Supabase + OpenAI**.

---

## 🚀 Features

* **Google Auth** via Supabase
* **Resume Upload** (files stored in Supabase Storage `resumes/`)
* **Job Match**: Compare your resume text with job descriptions using OpenAI GPT
* **Optimization Suggestions**: AI generates improvements for better ATS and recruiter match
* **Saudi-inspired UI** (modern neutral colors, clear typography)

---

## 📂 Project Structure

```
src/
├── App.jsx                  # Routes & main pages
├── main.jsx                 # React entrypoint
├── index.css                # Tailwind global styles
│
├── components/              # Shared components
│   ├── Layout/
│   │   ├── Header.jsx
│   │   └── Footer.jsx
│   └── Features/
│       ├── ResumeUpload.jsx
│       ├── JobMatch.jsx
│       └── Optimization.jsx
│
├── services/                # API + Supabase setup
│   ├── api.js
│   └── supabase.js
│
├── hooks/
│   └── useAuth.js           # Custom Supabase auth hook
```

### analyzeResume(resumeText, jobText)

Analyzes a resume against a job description and returns:

```js
{
  score: 0-100,
  missingKeywords: string[],
  suggestions: string[]
}
```

---

## ⚙️ Installation

### 1. Clone & Install

```bash
git clone <your-repo>
cd resume-customizer
npm install
```

### 2. Setup Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_KEY=your_openai_key
```

### 3. Run Locally

```bash
npm run dev
```

Visit: [http://localhost:5173](http://localhost:5173)

---

## ☁️ Deployment (Netlify)

1. Push your repo to GitHub
2. Connect repo on [Netlify](https://app.netlify.com)
3. Add environment variables in **Site Settings → Build & Deploy → Environment**
4. Build Command:

   ```bash
   npm run build
   ```

   Publish Directory:

   ```
   dist
   ```

---

## 🔑 Supabase Setup

### Auth

* Enable **Google Provider** in Supabase Dashboard → Authentication → Providers
* Add redirect URLs:

  * `http://localhost:5173/`
  * `https://<your-site>.netlify.app/`

### Storage

Run this SQL in Supabase SQL Editor:

```sql
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'resumes' );

create policy "Authenticated Upload"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'resumes' );
```

---

## 🧩 Roadmap

* ✅ Phase 1: Setup React + Vite + Tailwind
* ✅ Phase 2: Basic Routing + Layout
* ✅ Phase 3: Saudi-styled UI polish
* ✅ Phase 4: Supabase Auth
* ✅ Phase 5: Resume Upload to Supabase Storage
* 🟡 Phase 6: Job Match with AI (in-progress)
* 🔜 Phase 7: Save results history in Supabase DB
* 🔜 Phase 8: Export optimized resumes (PDF/DOCX)

---

## 💡 Tech Stack

* [React](https://react.dev/) + [Vite](https://vitejs.dev/)
* [Tailwind CSS v4](https://tailwindcss.com/)
* [Supabase](https://supabase.com/) – Auth, Database, Storage
* [OpenAI GPT](https://platform.openai.com/) – AI resume matcher
* [Netlify](https://www.netlify.com/) – Hosting

---

Would you like me to also add a **live demo script** section (example resumes + jobs) so future users can test instantly without uploading anything? That could make the README more engaging.
