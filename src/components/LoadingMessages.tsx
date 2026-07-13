import React, { useEffect, useState } from 'react';
import { Lightbulb, FileText, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils/cn';

interface LoadingMessage {
  text: string;
  subtext?: string;
  icon?: React.ReactNode;
}

const OPTIMIZE_MESSAGES: LoadingMessage[] = [
  { text: "Analyzing Application", subtext: "Comparing your profile against industry standards..." },
  { text: "Identifying Gaps", subtext: "Looking for missing keywords and skills..." },
  { text: "Generating Insights", subtext: "Crafting personalized improvements..." },
  { text: "Final Polish", subtext: "Formatting your results for maximum impact..." },
];

const PDF_MESSAGES: LoadingMessage[] = [
  { text: "Preparing Document", subtext: "Rendering pixel-perfect layout..." },
  { text: "Optimizing Assets", subtext: "Compressing images and fonts..." },
  { text: "Finalizing Layout", subtext: "Checking page breaks and margins..." },
  { text: "almost Ready", subtext: "Applying final styling touches..." },
];

const PRO_TIPS = [
  "Quantify your achievements with numbers (e.g., 'Increased sales by 20%')",
  "Use action verbs like 'Spearheaded', 'Orchestrated', and 'Executed'",
  "Tailor your resume keywords to match the job description exactly",
  "Keep your summary concise—recruiters spend about 6 seconds scanning",
  "Avoid generic clichés like 'hard worker' or 'team player' without proof",
  "Focus on results, not just responsibilities",
  "Ensure your contact information is up to date",
  "Use a professional email address",
];

interface LoadingMessagesProps {
  type: 'optimize' | 'pdf';
  estimatedTime?: number;
  className?: string;
}

export function LoadingMessages({ type, estimatedTime = 5000, className }: LoadingMessagesProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = type === 'optimize' ? OPTIMIZE_MESSAGES : PDF_MESSAGES;
  const currentMessage = messages[currentMessageIndex % messages.length];

  useEffect(() => {
    // Message rotation (slower than tips)
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 4000);

    // Tip rotation
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % PRO_TIPS.length);
    }, 6000);

    // Smooth progress animation
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const _rawProgress = (elapsed / estimatedTime) * 100;

      // Asymptotic approach to 95%
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const remaining = 95 - prev;
        const increment = remaining * 0.05; // Smooth deceleration
        return Math.min(prev + increment + 0.1, 95);
      });
    }, 100);

    return () => {
      clearInterval(messageInterval);
      clearInterval(tipInterval);
      clearInterval(progressInterval);
    };
  }, [estimatedTime, messages.length]);

  return (
    <div className={cn(
      "relative overflow-hidden",
      "w-full max-w-sm bg-white/90 dark:bg-gray-900/40 backdrop-blur-xl",
      "border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl",
      "p-5 flex flex-col gap-4",
      className
    )}>
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

      {/* Header Section */}
      <div className="flex items-start gap-4 relative z-10">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
          <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-2.5 shadow-lg">
            {type === 'optimize' ? (
              <Wand2 className="w-5 h-5 text-white animate-pulse" />
            ) : (
              <FileText className="w-5 h-5 text-white animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              {currentMessage.text}
            </h3>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              {Math.round(progress)}%
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {currentMessage.subtext}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden relative z-10">
        <div
          className="h-full w-full origin-left rtl:origin-right bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 transition-transform duration-300 ease-out relative"
          style={{ transform: `scaleX(${Math.min(Math.max(progress, 0), 100) / 100})` }}
        >
          <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite]" />
        </div>
      </div>

      {/* Tip Section */}
      <div className="bg-gradient-to-br from-white/50 to-white/10 dark:from-white/5 dark:to-transparent rounded-lg p-3 border border-white/20 dark:border-white/5 relative z-10">
        <div className="flex gap-2.5">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
              Pro Tip
            </p>
            <p key={currentTipIndex} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed animate-in fade-in duration-200 ease-out">
              "{PRO_TIPS[currentTipIndex]}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
