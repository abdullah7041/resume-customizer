import { useEffect, useState } from 'react';

interface LoadingMessage {
  text: string;
  icon: string;
  duration?: number;
}

const OPTIMIZE_MESSAGES: LoadingMessage[] = [
  { text: "Analyzing keywords and skills...", icon: "🔍", duration: 5000 },
  { text: "Comparing with job requirements...", icon: "📊", duration: 5000 },
  { text: "Identifying gaps and opportunities...", icon: "💡", duration: 5000 },
  { text: "Crafting optimization suggestions...", icon: "✨", duration: 5000 },
  { text: "Pro tip: Quantify achievements with numbers!", icon: "💪", duration: 3000 },
  { text: "Did you know? ATS scans for exact keyword matches", icon: "🤖", duration: 3000 },
  { text: "Boost your resume: Use action verbs like 'Achieved', 'Improved', 'Led'", icon: "🚀", duration: 3000 },
  { text: "Fun fact: 75% of resumes never reach a human recruiter", icon: "📈", duration: 3000 },
];

const PDF_MESSAGES: LoadingMessage[] = [
  { text: "Rendering your beautiful resume...", icon: "🎨", duration: 3000 },
  { text: "Perfecting layout and spacing...", icon: "📐", duration: 3000 },
  { text: "Almost there! Adding final touches...", icon: "✨", duration: 3000 },
  { text: "Making it pixel-perfect...", icon: "🖼️", duration: 2000 },
];

interface LoadingMessagesProps {
  type: 'optimize' | 'pdf';
  estimatedTime: number;
}

export function LoadingMessages({ type, estimatedTime }: LoadingMessagesProps) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = type === 'optimize' ? OPTIMIZE_MESSAGES : PDF_MESSAGES;

  useEffect(() => {
    // Rotate messages every 5 seconds
    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 5000);

    // Smooth progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const increment = 100 / (estimatedTime / 100);
        return Math.min(prev + increment, 95); // Cap at 95% until complete
      });
    }, 100);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [estimatedTime, messages.length]);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Animated Icon */}
      <div className="text-6xl animate-bounce">
        {messages[currentMessage].icon}
      </div>

      {/* Loading Message */}
      <div className="text-lg font-medium text-center text-gray-800 dark:text-gray-200 min-h-[3rem] flex items-center">
        {messages[currentMessage].text}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-2">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-sm text-center text-gray-600 dark:text-gray-400">
          {Math.round(progress)}% complete
        </div>
      </div>

      {/* Additional Context */}
      <div className="text-xs text-center text-gray-500 dark:text-gray-500 max-w-sm">
        {type === 'optimize'
          ? "Our AI is analyzing your resume against the job description to find the best optimization opportunities."
          : "Creating a professional PDF version of your resume with pixel-perfect formatting."
        }
      </div>
    </div>
  );
}
