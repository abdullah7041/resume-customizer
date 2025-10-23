// src/components/WelcomeModal.jsx
// First-time user onboarding modal - only shown when user clicks "How it Works"

import { FileText, Target, Sparkles, Download, Check } from "lucide-react";
import HelpModal from "./ui/HelpModal.jsx";

export default function WelcomeModal({ isOpen, onClose }) {
  return (
    <HelpModal
      isOpen={isOpen}
      onClose={onClose}
      title="👋 Welcome to AI Resume Optimizer"
    >
      <div className="space-y-6">
        <p className="text-lg text-emerald-700 dark:text-emerald-300 font-medium">
          Transform your resume into a job-winning document in 4 simple steps:
        </p>

        {/* Landscape-optimized grid layout for steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1 */}
          <div className="flex gap-3 items-start rounded-xl border border-emerald-200/40 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 backdrop-blur-sm">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              1
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                  Upload Your Resume
                </h3>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Upload a PDF or DOCX file, or paste your resume text directly. Our AI will extract and analyze the content.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 items-start rounded-xl border border-emerald-200/40 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 backdrop-blur-sm">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              2
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                  Match to Job Description
                </h3>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Paste the job description you're targeting. Get a match score (0-100) and see which keywords you're missing.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3 items-start rounded-xl border border-emerald-200/40 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 backdrop-blur-sm">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              3
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                  AI Optimization
                </h3>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Let AI rewrite your resume sections with stronger language, better keywords, and professional tone—without inventing facts.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3 items-start rounded-xl border border-emerald-200/40 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 backdrop-blur-sm">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              4
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                  Export as PDF
                </h3>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Download your optimized resume in styled or ATS-plain format. Save to your account for future access.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-300/50 dark:border-emerald-700/50 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-1.5 text-base">
                Built for Saudi Arabia's Job Market
              </h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                Optimized for Vision 2030 skills, local hiring practices, and both Arabic and English resumes. All processing happens securely—your data stays private.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300/50 dark:border-blue-700/50 rounded-xl p-4 backdrop-blur-sm">
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
            <strong>💡 Pro Tip:</strong> Click the <strong>"How it Works"</strong> button on any tab to see detailed explanations for each feature.
          </p>
        </div>
      </div>
    </HelpModal>
  );
}
