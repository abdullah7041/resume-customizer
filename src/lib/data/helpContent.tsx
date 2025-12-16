// src/data/helpContent.js
// Help content for each feature tab

export const helpContent = {
  upload: {
    title: "📤 How Resume Upload Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Upload your resume to get started with AI-powered optimization. We support multiple formats and methods.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Choose Your Method</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>File Upload:</strong> Drag & drop or click to browse for PDF or DOCX files (max 5MB)<br />
                  <strong>Text Paste:</strong> Copy and paste your resume text directly into the editor
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Extracts Text</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Our AI automatically extracts clean text from your file, detecting sections like Experience, Skills, and Education.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Review & Edit</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Preview the extracted text and make any necessary edits before proceeding to analysis.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              <strong>💡 Pro Tip:</strong> For best results, use a well-formatted PDF or DOCX file. Scanned image PDFs may not parse correctly.
            </p>
          </div>
        </div>
      </>
    ),
  },

  match: {
    title: "🎯 How Job Matching Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Compare your resume against a job description using <strong>AI-powered semantic analysis</strong> to calculate precise match scores and identify optimization opportunities.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Paste Job Description</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Copy the full job posting and paste it into the text area. Include requirements, responsibilities, and qualifications.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Semantic Analysis</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Our <strong>AI models (DeepSeek & GPT-4o)</strong> analyze your resume using advanced natural language processing to understand context, skills, and semantic similarity—providing intelligent, contextual match insights.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Review AI Insights</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See your match score (0-100), matched skills, missing keywords, AI-generated recommendations, and detailed explanations of your alignment.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How AI Scoring Works:</h5>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>🤖 <strong>Semantic Understanding:</strong> AI comprehends context and meaning, not just keywords</li>
              <li>� <strong>Multi-dimensional Analysis:</strong> Skills, experience, qualifications evaluated holistically</li>
              <li>⚡ <strong>Smart Recommendations:</strong> Personalized suggestions based on your unique profile</li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-3">
            <h5 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Understanding Match Scores:</h5>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>🎯 <strong>75-100:</strong> Strong alignment - high chance of passing ATS</li>
              <li>⚡ <strong>50-74:</strong> Moderate alignment - some improvements needed</li>
              <li>🔧 <strong>0-49:</strong> Needs attention - significant gaps to address</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },

  optimize: {
    title: "✨ How AI Optimization Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Let AI rewrite your resume sections to better match job requirements while maintaining truthfulness and your unique voice.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Select Section to Optimize</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose which resume section to improve: Summary, Experience, Skills, or Education.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Generates Suggestions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI rewrites your content using stronger action verbs, better keyword alignment, and professional language—without inventing facts.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Accept, Reject, or Edit</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review suggestions side-by-side with your original. Accept changes you like, reject ones you don't, or manually edit.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>⚠️ Important:</strong> Our AI only rewrites existing content—it never invents degrees, job titles, or experiences. Always verify suggestions match your actual background.
            </p>
          </div>
        </div>
      </>
    ),
  },

  bulk: {
    title: "📊 How Bulk Analysis Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Compare multiple resume versions side-by-side to determine which one best matches a specific job description.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Add Job Description First</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Go to the <strong>Match</strong> tab and paste the job description. This is essential for comparison scoring.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Upload Multiple Versions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload up to 5 resume files (PDF or DOCX). These could be different formats, skill emphases, or summary styles.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">View Ranked Comparison</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See all versions ranked by match score with 🥇🥈🥉 medals for top performers. Export detailed reports for your records.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>💡 Use Case:</strong> Test a technical resume vs. a leadership-focused resume, or compare ATS-optimized vs. visually designed versions to see which scores higher.
            </p>
          </div>
        </div>
      </>
    ),
  },

  templates: {
    title: "🎨 How Templates Work",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Choose from professionally designed resume templates optimized for Saudi Arabia's job market and ATS systems.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Browse Templates</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Explore our collection of ATS-friendly templates designed for different industries and career levels.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Apply Template</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click a template to apply it to your resume. Your content automatically fills the new design.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Export as PDF</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Download your formatted resume in styled or ATS-plain PDF format.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },

  cover: {
    title: "✉️ How Cover Letter Generation Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Generate personalized cover letters based on your resume and the target job description.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Choose Tone</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select professional, enthusiastic, or formal tone based on the company culture.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Drafts Letter</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI creates a tailored cover letter highlighting your relevant achievements and alignment with the role.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Edit & Export</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Review, personalize, and download your cover letter as a PDF.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },

  interview: {
    title: "🎤 How Interview Prep Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Get AI-predicted interview questions and prepare strong answers based on your resume and the job description.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Predicts Questions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Based on the job requirements, our AI generates likely interview questions covering technical skills, experience, and behavioral scenarios.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Review Talking Points</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get suggested answers drawn from your actual resume achievements using the STAR method (Situation, Task, Action, Result).
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Practice & Refine</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Rehearse your responses and customize them to match your personal communication style.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },

  keywords: {
    title: "🔍 How Keyword Analysis Works",
    content: (
      <>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Deep-dive into keyword optimization to ensure your resume passes ATS screening and highlights the right skills.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Extract Keywords</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI identifies critical keywords from the job description and analyzes their frequency in your resume.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Visualize Density</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See charts showing keyword density and coverage compared to job requirements.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Get Suggestions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive industry-specific keyword recommendations to improve ATS scoring.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
};



