// src/components/WelcomeModal.jsx
// First-time user onboarding modal

import { useState, useEffect } from "react";
import { FileText, Target, Sparkles, Download, Check } from "lucide-react";
import HelpModal from "./ui/HelpModal.jsx";

const WELCOME_SHOWN_KEY = "airo:welcomeShown";

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if welcome modal has been shown before
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome) {
      // Show modal after a brief delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    setIsOpen(false);
  };

  return (
    <HelpModal
      isOpen={isOpen}
      onClose={handleClose}
      title="👋 Welcome to AI Resume Optimizer"
    >
      <div className="space-y-6">
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Transform your resume into a job-winning document in 4 simple steps:
        </p>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  Upload Your Resume
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Upload a PDF or DOCX file, or paste your resume text directly. Our AI will extract and analyze the content.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  Match to Job Description
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Paste the job description you're targeting. Get a match score (0-100) and see which keywords you're missing.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  AI Optimization
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Let AI rewrite your resume sections with stronger language, better keywords, and professional tone—without inventing facts.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  Export as PDF
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Download your optimized resume in styled or ATS-plain format. Save to your account for future access.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Check className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white mb-2">
                Built for Saudi Arabia's Job Market
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Optimized for Vision 2030 skills, local hiring practices, and both Arabic and English resumes. All processing happens securely—your data stays private.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>💡 Pro Tip:</strong> Click the <strong>"How it Works"</strong> button on any tab to see detailed explanations for each feature.
          </p>
        </div>
      </div>
    </HelpModal>
  );
}
