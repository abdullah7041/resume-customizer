// src/features/CoverLetter.jsx
// AI-powered cover letter generator and editor

import { useState, useCallback, useEffect } from "react";
import { FileText, Wand2, Download, Copy, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/cn.js";

const FUNCTION_BASE_PATH = "/.netlify/functions";
const GENERATE_ENDPOINT = `${FUNCTION_BASE_PATH}/generate-cover-letter`;
const STORAGE_KEY = "airo:coverLetter";

const ToneSelector = ({ selected, onChange }) => {
  const tones = [
    { value: "professional", label: "Professional", emoji: "💼" },
    { value: "enthusiastic", label: "Enthusiastic", emoji: "⚡" },
    { value: "formal", label: "Formal", emoji: "🎩" },
    { value: "creative", label: "Creative", emoji: "🎨" }
  ];
  
  return (
    <div className="flex flex-wrap gap-2">
      {tones.map(tone => (
        <button
          key={tone.value}
          onClick={() => onChange(tone.value)}
          className={cn(
            "px-4 py-2 rounded-lg border-2 transition-all",
            selected === tone.value
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-emerald-300"
          )}
        >
          <span className="mr-2">{tone.emoji}</span>
          {tone.label}
        </button>
      ))}
    </div>
  );
};

const KeyHighlights = ({ highlights }) => {
  if (!highlights || highlights.length === 0) return null;
  
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Key Highlights Included:
      </h4>
      <ul className="space-y-1">
        {highlights.map((highlight, idx) => (
          <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function CoverLetter({ resumeText, jobDescription }) {
  const [coverLetter, setCoverLetter] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [tone, setTone] = useState("professional");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [keyHighlights, setKeyHighlights] = useState([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setCoverLetter(data.coverLetter || "");
          setCompanyName(data.companyName || "");
          setHiringManager(data.hiringManager || "");
          setTone(data.tone || "professional");
          setKeyHighlights(data.keyHighlights || []);
        } catch (e) {
          console.error("Failed to load cover letter from storage:", e);
        }
      }
    }
  }, []);
  
  // Update word count when cover letter changes
  useEffect(() => {
    if (coverLetter) {
      const words = coverLetter.trim().split(/\s+/).length;
      setWordCount(words);
    } else {
      setWordCount(0);
    }
  }, [coverLetter]);
  
  const generateCoverLetter = useCallback(async () => {
    if (!resumeText || !jobDescription) {
      setError("Please provide both resume and job description");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          companyName: companyName || undefined,
          hiringManager: hiringManager || undefined,
          tone
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate cover letter: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setCoverLetter(data.coverLetter || "");
      setKeyHighlights(data.keyHighlights || []);
      setWordCount(data.wordCount || 0);
      
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          coverLetter: data.coverLetter,
          companyName,
          hiringManager,
          tone,
          keyHighlights: data.keyHighlights,
          generatedAt: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error("Error generating cover letter:", err);
      setError(err.message || "Failed to generate cover letter");
    } finally {
      setIsGenerating(false);
    }
  }, [resumeText, jobDescription, companyName, hiringManager, tone]);
  
  const saveCoverLetter = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        coverLetter,
        companyName,
        hiringManager,
        tone,
        keyHighlights,
        savedAt: new Date().toISOString()
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };
  
  const copyCoverLetter = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  const downloadCoverLetter = () => {
    const filename = companyName 
      ? `cover-letter-${companyName.toLowerCase().replace(/\s+/g, "-")}.txt`
      : `cover-letter-${Date.now()}.txt`;
    
    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  if (!resumeText || !jobDescription) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <EmptyState
          icon={FileText}
          title="Missing Information"
          description="Upload your resume and add a job description to generate a tailored cover letter."
        />
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Cover Letter Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create a compelling, tailored cover letter using AI
        </p>
      </div>
      
      {/* Configuration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Customize Your Cover Letter
        </h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name (Optional)
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Acme Corporation"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hiring Manager (Optional)
              </label>
              <Input
                value={hiringManager}
                onChange={(e) => setHiringManager(e.target.value)}
                placeholder="e.g., John Smith"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tone
            </label>
            <ToneSelector selected={tone} onChange={setTone} />
          </div>
          
          <Button
            onClick={generateCoverLetter}
            variant="primary"
            disabled={isGenerating}
            className="w-full md:w-auto"
          >
            {isGenerating ? (
              <>
                <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                {coverLetter ? "Regenerate" : "Generate Cover Letter"}
              </>
            )}
          </Button>
        </div>
      </Card>
      
      {/* Error State */}
      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}
      
      {/* Loading State */}
      {isGenerating && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Crafting your personalized cover letter...
            </p>
          </div>
        </Card>
      )}
      
      {/* Cover Letter Editor */}
      {!isGenerating && coverLetter && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Cover Letter
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {wordCount} words • {tone} tone
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={saveCoverLetter} variant="outline" size="sm">
                <Save className="w-4 h-4 mr-2" />
                {saved ? "Saved!" : "Save"}
              </Button>
              <Button onClick={copyCoverLetter} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={downloadCoverLetter} variant="primary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          
          <KeyHighlights highlights={keyHighlights} />
          
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full h-[500px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                     font-serif text-base leading-relaxed resize-none"
            placeholder="Your generated cover letter will appear here..."
            id="cover-letter-editor"
            name="cover-letter"
          />
          
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Tip:</strong> Edit the generated text to add personal touches and ensure it accurately represents your experience. Always proofread before sending!
            </p>
          </div>
        </Card>
      )}
      
      {/* Empty State */}
      {!isGenerating && !coverLetter && !error && (
        <Card className="p-12">
          <EmptyState
            icon={FileText}
            title="No Cover Letter Yet"
            description="Click 'Generate Cover Letter' above to create a tailored cover letter based on your resume and the job description."
          />
        </Card>
      )}
    </div>
  );
}
