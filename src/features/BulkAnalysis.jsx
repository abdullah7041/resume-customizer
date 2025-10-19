// src/features/BulkAnalysis.jsx
// Bulk resume analysis and comparison tool

import { useState, useCallback } from "react";
import { Upload, X, TrendingUp, Download, BarChart3 } from "lucide-react";
import { parseResume, analyzeResume } from "../services/api.js";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { cn } from "../lib/cn.js";

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ScoreBadge = ({ score }) => {
  const color = score >= 75 
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    : score >= 50
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  
  return (
    <span className={cn("px-3 py-1 rounded-full text-sm font-bold", color)}>
      {score}%
    </span>
  );
};

const ResumeCard = ({ resume, index, onRemove }) => {
  const { name, status, error, analysis } = resume;
  
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={name}>
            {name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {status}
          </p>
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {status === "analyzing" && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-emerald-600 h-2 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}
      
      {status === "error" && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error || "Failed to analyze"}
        </div>
      )}
      
      {status === "completed" && analysis && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Match Score</span>
            <ScoreBadge score={analysis.score || 0} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Keywords</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {analysis.matchedKeywords?.length || 0}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

const ComparisonTable = ({ resumes }) => {
  const completedResumes = resumes.filter(r => r.status === "completed" && r.analysis);
  
  if (completedResumes.length === 0) {
    return null;
  }
  
  // Sort by score descending
  const sortedResumes = [...completedResumes].sort((a, b) => 
    (b.analysis?.score || 0) - (a.analysis?.score || 0)
  );
  
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        Comparison Results
      </h2>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Rank
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Resume
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Match Score
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Keywords
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Coverage
              </th>
              <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResumes.map((resume, index) => {
              const { analysis } = resume;
              const rank = index + 1;
              const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
              
              return (
                <tr 
                  key={resume.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-3 px-4">
                    <span className="text-2xl">{emoji}</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                      #{rank}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {resume.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <ScoreBadge score={analysis.score || 0} />
                  </td>
                  <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                    {analysis.matchedKeywords?.length || 0}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-900 dark:text-white">
                    {Math.round((analysis.coverage || 0) * 100)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    {rank === 1 ? (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        ✓ Best Match
                      </span>
                    ) : analysis.score >= 70 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Good
                      </span>
                    ) : analysis.score >= 50 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Needs Work
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        Revise
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default function BulkAnalysis({ jobDescription }) {
  const [resumes, setResumes] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFiles = useCallback(async (files) => {
    const fileArray = Array.from(files).slice(0, MAX_FILES - resumes.length);
    
    // Validate files
    const validFiles = fileArray.filter(file => {
      if (file.size > MAX_SIZE) {
        console.warn(`File ${file.name} is too large`);
        return false;
      }
      if (!file.name.match(/\.(pdf|docx)$/i)) {
        console.warn(`File ${file.name} has unsupported format`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) return;
    
    // Add files to state
    const newResumes = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      file,
      status: "pending",
      plainText: null,
      analysis: null,
      error: null
    }));
    
    setResumes(prev => [...prev, ...newResumes]);
    
    // Process each file
    for (const resume of newResumes) {
      await processResume(resume.id, resume.file);
    }
  }, [resumes.length, processResume]);
  
  const processResume = useCallback(async (resumeId, file) => {
    // Update status to parsing
    setResumes(prev => prev.map(r => 
      r.id === resumeId ? { ...r, status: "parsing" } : r
    ));
    
    try {
      // Parse resume
      const parseResult = await parseResume(file);
      const plainText = parseResult?.plainText || "";
      
      if (!plainText) {
        throw new Error("Failed to extract text from resume");
      }
      
      // Update with parsed text
      setResumes(prev => prev.map(r => 
        r.id === resumeId ? { ...r, plainText, status: "analyzing" } : r
      ));
      
      // Analyze if job description is available
      if (jobDescription) {
        const analysis = await analyzeResume(plainText, jobDescription);
        
        setResumes(prev => prev.map(r => 
          r.id === resumeId ? { ...r, analysis, status: "completed" } : r
        ));
      } else {
        setResumes(prev => prev.map(r => 
          r.id === resumeId ? { ...r, status: "completed" } : r
        ));
      }
    } catch (error) {
      console.error(`Error processing resume ${resumeId}:`, error);
      setResumes(prev => prev.map(r => 
        r.id === resumeId ? { ...r, status: "error", error: error.message } : r
      ));
    }
  }, [jobDescription]);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer?.files;
    if (files) {
      handleFiles(files);
    }
  }, [handleFiles]);
  
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
    e.target.value = ""; // Reset input
  }, [handleFiles]);
  
  const removeResume = useCallback((index) => {
    setResumes(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const exportComparison = () => {
    const completedResumes = resumes.filter(r => r.status === "completed" && r.analysis);
    const sortedResumes = [...completedResumes].sort((a, b) => 
      (b.analysis?.score || 0) - (a.analysis?.score || 0)
    );
    
    const exportData = {
      jobDescription: jobDescription?.substring(0, 200) + "...",
      comparisonDate: new Date().toISOString(),
      resumes: sortedResumes.map((r, idx) => ({
        rank: idx + 1,
        name: r.name,
        matchScore: r.analysis?.score || 0,
        keywordCount: r.analysis?.matchedKeywords?.length || 0,
        coverage: Math.round((r.analysis?.coverage || 0) * 100),
        missingKeywords: r.analysis?.missingKeywords || []
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `resume-comparison-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const canUploadMore = resumes.length < MAX_FILES;
  
  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Bulk Resume Analysis
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Compare multiple resume versions against the same job description
          </p>
        </div>
        
        {resumes.length > 0 && (
          <Button onClick={exportComparison} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        )}
      </div>
      
      {/* Upload Area */}
      {canUploadMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 transition-all",
            isDragging
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
          )}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <Upload className="w-12 h-12 text-gray-400" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Upload Resume Files
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drag & drop or click to browse • PDF or DOCX • Max {MAX_FILES} files
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {resumes.length}/{MAX_FILES} uploaded
              </p>
            </div>
            <input
              type="file"
              id="bulk-upload"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
            <Button
              onClick={() => document.getElementById("bulk-upload")?.click()}
              variant="primary"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          </div>
        </div>
      )}
      
      {/* Resumes Grid */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume, index) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              index={index}
              onRemove={removeResume}
            />
          ))}
        </div>
      )}
      
      {/* Comparison Table */}
      {jobDescription && resumes.some(r => r.status === "completed") && (
        <ComparisonTable resumes={resumes} jobDescription={jobDescription} />
      )}
      
      {/* Empty State */}
      {resumes.length === 0 && (
        <EmptyState
          icon={TrendingUp}
          title="No Resumes Uploaded"
          description="Upload multiple resume versions to compare their match scores side-by-side."
        />
      )}
      
      {/* Warning if no job description */}
      {!jobDescription && resumes.length > 0 && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-300">
            ⚠️ Add a job description in the Match tab to analyze and compare resume match scores.
          </p>
        </Card>
      )}
    </div>
  );
}
