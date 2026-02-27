import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// jsPDF and jspdf-autotable are dynamically imported in exportComparison() to avoid bundling ~344 KB in the main chunk
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import {
  Upload,
  X,
  TrendingUp,
  Download,
  BarChart3,
  Trophy,
  Medal,
  Award,
  AlertTriangle,
  Trash2,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { parseResume } from '../../services/api';
import { cn } from '../../lib/utils/cn';
import { useUserCredits } from '../../hooks/useUserCredits';
import { UpgradeModal } from '../Credits/UpgradeModal';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_KEY = 'airo:bulkAnalysis';

// === Types ===
interface ResumeAnalysis {
  score?: number;
  topHits?: string[];
  matchedKeywords?: string[];
  missingKeywords?: string[];
  coverage?: number;
  localAnalysis?: {
    matchedKeywords: string[];
    jobKeywords: string[];
  };
}

interface Resume {
  id: string;
  name: string;
  file?: File | null;
  status: 'pending' | 'parsing' | 'analyzing' | 'completed' | 'error';
  plainText?: string | null;
  analysis?: ResumeAnalysis | null;
  error?: string | null;
}

interface BulkAnalysisSectionProps {
  jobDescription?: string;
}

// === Sub-components ===
const ScoreBadge = ({ score }: { score: number }) => {
  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (s >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full border', getScoreColor(score))}>
      <span className="text-sm font-bold">{score}%</span>
    </div>
  );
};

const ResumeCard = ({ resume, onRemove }: { resume: Resume; onRemove: () => void }) => {
  const { name, status, error, analysis } = resume;

  return (
    <div className="group relative">
      <GlassCard padding="sm" className="h-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-white/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              status === 'completed' ? "bg-emerald-500/10 text-emerald-400" :
                status === 'error' ? "bg-rose-500/10 text-rose-400" :
                  "bg-blue-500/10 text-blue-400"
            )}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-white truncate" title={name}>{name}</h4>
              <p className="text-xs text-gray-400 capitalize flex items-center gap-1.5">
                {status === 'analyzing' || status === 'parsing' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </>
                ) : status === 'completed' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                  </span>
                ) : status === 'error' ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Failed
                  </span>
                ) : (
                  status
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(status === 'analyzing' || status === 'parsing') && (
          <div className="mt-4 mb-2">
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{error || 'Failed to analyze'}</span>
          </div>
        )}

        {status === 'completed' && analysis && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Match</span>
              <ScoreBadge score={analysis.score || 0} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="block text-lg font-semibold text-white">
                  {analysis.topHits?.length || analysis.matchedKeywords?.length || 0}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Keywords</span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <span className="block text-lg font-semibold text-white">
                  {Math.round((analysis.coverage || 0) * 100)}%
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Coverage</span>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export function BulkAnalysisSection({ jobDescription }: BulkAnalysisSectionProps) {
  const { t, i18n } = useTranslation();
  const { credits, refetch: refetchCredits } = useUserCredits();
  const [resumes, setResumes] = useState<Resume[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((r: Resume) => r.status === 'completed' || r.status === 'error');
      }
    } catch (e) {
      console.warn('Failed to load saved bulk analysis:', e);
    }
    return [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingResumeIds, setPendingResumeIds] = useState<string[]>([]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const toSave = resumes
        .filter(r => r.status === 'completed' || r.status === 'error')
        .map(r => ({ ...r, file: null }));
      if (toSave.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save bulk analysis:', e);
    }
  }, [resumes]);

  const clearSavedData = useCallback(() => {
    setResumes([]);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const processResumeActual = useCallback(async (resumeId: string, file: File) => {
    setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'parsing' as const } : r));

    try {
      const parseResult = await parseResume(file);
      const plainText = parseResult?.plainText || '';
      if (!plainText) throw new Error('Failed to extract text from resume');

      setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, plainText, status: 'analyzing' as const } : r));

      if (jobDescription) {
        // Use authenticated AI match endpoint (costs 2 credits per resume)
        const { getAuthHeaders } = await import('../../lib/auth/authHeaders');
        const headers = await getAuthHeaders();

        const response = await fetch('/.netlify/functions/ai-match', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            resumeText: plainText,
            jobText: jobDescription,
            language: i18n.language,
          }),
        });

        // Handle insufficient credits (403)
        if (response.status === 403) {
          setShowUpgradeModal(true);
          setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'error' as const, error: 'Insufficient credits' } : r));
          return;
        }

        if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);

        const aiAnalysis = await response.json();
        // Normalize: backend returns strongMatches/matched_keywords, UI expects topHits/matchedKeywords
        const normalizedAnalysis: ResumeAnalysis = {
          ...aiAnalysis,
          topHits: aiAnalysis.topHits || aiAnalysis.strongMatches || aiAnalysis.matched_keywords || [],
          matchedKeywords: aiAnalysis.matchedKeywords || aiAnalysis.strongMatches || aiAnalysis.matched_keywords || [],
        };
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, analysis: normalizedAnalysis, status: 'completed' as const } : r));

        // Refetch credits after each resume analysis
        setTimeout(() => refetchCredits(), 500);
      } else {
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'completed' as const } : r));
      }
    } catch (error) {
      setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'error' as const, error: (error as Error).message } : r));
    }
  }, [jobDescription, refetchCredits, i18n.language]);

  // Wrapper: collect all pending resume IDs and show one confirmation modal
  const processResume = useCallback((resumeId: string, _file: File) => {
    if (!jobDescription) {
      // If no job description, process without credits (just parsing)
      processResumeActual(resumeId, _file);
      return;
    }
    // Accumulate pending IDs — modal shown once for the batch
    setPendingResumeIds(prev => [...prev, resumeId]);
    setShowConfirmModal(true);
  }, [jobDescription, processResumeActual]);

  // Handler for confirmed analysis — processes resumes sequentially to avoid API rate limits
  const handleConfirmAnalysis = async () => {
    setShowConfirmModal(false);
    const ids = [...pendingResumeIds];
    setPendingResumeIds([]);
    for (const id of ids) {
      const resume = resumes.find(r => r.id === id);
      if (resume?.file) {
        await processResumeActual(id, resume.file);
      }
    }
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files).slice(0, MAX_FILES - resumes.length);
    const validFiles = fileArray.filter(file => {
      if (file.size > MAX_SIZE) return false;
      if (!file.name.match(/\.(pdf|docx)$/i)) return false;
      return true;
    });

    if (validFiles.length === 0) return;

    const newResumes: Resume[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      file,
      status: 'pending',
      plainText: null,
      analysis: null,
      error: null
    }));

    setResumes(prev => [...prev, ...newResumes]);
    // Process sequentially to avoid overwhelming the API with concurrent requests
    for (const resume of newResumes) {
      await processResume(resume.id, resume.file!);
    }
  }, [resumes.length, processResume]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const removeResume = useCallback((index: number) => {
    setResumes(prev => prev.filter((_, i) => i !== index));
  }, []);

  const exportComparison = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const completedResumes = resumes.filter(r => r.status === 'completed' && r.analysis);
    const sortedResumes = [...completedResumes].sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0));

    // Create PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald color
    doc.text('Resume Comparison Report', pageWidth / 2, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`, pageWidth / 2, 28, { align: 'center' });

    // Job Description Summary
    if (jobDescription) {
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text('Job Description Summary:', 14, 40);
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      const jdText = jobDescription.substring(0, 300) + (jobDescription.length > 300 ? '...' : '');
      const splitJd = doc.splitTextToSize(jdText, pageWidth - 28);
      doc.text(splitJd, 14, 47);
    }

    // Comparison Table
    const tableStartY = jobDescription ? 70 : 40;

    autoTable(doc, {
      startY: tableStartY,
      head: [['Rank', 'Resume Name', 'Match Score', 'Keywords', 'Status']],
      body: sortedResumes.map((r, idx) => {
        const score = r.analysis?.score || 0;
        const keywordCount = r.analysis?.topHits?.length || r.analysis?.matchedKeywords?.length || 0;
        const status = idx === 0 ? '[#1] Best Match' : score >= 70 ? '[OK] Good' : score >= 50 ? '[!] Needs Work' : '[X] Revise';
        return [`#${idx + 1}`, r.name, `${score}%`, keywordCount.toString(), status];
      }),
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: { fontSize: 10 }
    });

    // Missing Keywords per Resume
    let currentY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableStartY + 50;

    sortedResumes.forEach((resume, idx) => {
      const missing = resume.analysis?.missingKeywords || [];
      if (missing.length === 0) return;

      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      currentY += 15;
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(`#${idx + 1} ${resume.name} - Missing Keywords:`, 14, currentY);

      currentY += 6;
      doc.setFontSize(9);
      doc.setTextColor(239, 68, 68); // Red color
      const missingText = missing.join(', ');
      const splitMissing = doc.splitTextToSize(missingText, pageWidth - 28);
      doc.text(splitMissing, 14, currentY);
      currentY += splitMissing.length * 5;
    });

    // Save PDF
    doc.save(`resume-comparison-${Date.now()}.pdf`);
  };

  const canUploadMore = resumes.length < MAX_FILES;
  const completedResumes = resumes.filter(r => r.status === 'completed' && r.analysis);
  const sortedResumes = [...completedResumes].sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0));

  return (
    <div className="space-y-8">
      {/* Header */}
      <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <GlassCircle size="lg" variant="purple" className="shadow-lg shadow-purple-500/20">
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </GlassCircle>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {t('sections.bulk.title', 'Bulk Resume Analysis')}
            </h3>
            <p className="text-gray-400 mt-1">
              {t('sections.bulk.subtitle', 'Compare multiple versions side-by-side')}
            </p>
          </div>
        </div>

        {resumes.length > 0 && (
          <div className="flex items-center gap-3">
            <GlassButton variant="ghost" onClick={clearSavedData} className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
              <Trash2 className="w-4 h-4 me-2" />
              {t('sections.bulk.clearAll', 'Clear All')}
            </GlassButton>
            <GlassButton variant="primary" onClick={exportComparison} className="shadow-lg shadow-primary-500/20">
              <Download className="w-4 h-4 me-2" />
              {t('sections.bulk.export', 'Export Report')}
            </GlassButton>
          </div>
        )}
      </GlassCard>

      {/* Upload Area */}
      {canUploadMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'group relative rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer overflow-hidden',
            isDragging
              ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
              : 'border-white/10 bg-black/60 backdrop-blur-sm hover:border-emerald-500/40 hover:bg-black/70'
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative py-16 px-6 text-center">
            <div className={cn(
              "w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center transition-all duration-300",
              isDragging ? "bg-emerald-500/20 scale-110" : "bg-white/5 group-hover:bg-white/10 group-hover:scale-105"
            )}>
              <Upload className={cn(
                "w-10 h-10 transition-colors duration-300",
                isDragging ? "text-emerald-400" : "text-gray-400 group-hover:text-emerald-400"
              )} />
            </div>

            <h4 className="text-xl font-semibold text-white mb-2">
              {t('sections.bulk.uploadTitle', 'Upload Resume Files')}
            </h4>
            <p className="text-sm text-gray-400 mb-2 max-w-sm mx-auto">
              {t('sections.bulk.uploadDesc', 'Drag & drop or click to browse. Supports PDF & DOCX up to 5MB.')}
            </p>
            <p className="text-xs text-emerald-400/80 mb-6">
              {t('sections.bulk.creditCost', '2 credits per resume analysis')}
            </p>

            <input
              type="file"
              id="bulk-upload"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="inline-flex flex-col items-center gap-3">
              <GlassButton
                onClick={() => document.getElementById('bulk-upload')?.click()}
                className='mx-auto min-w-[140px]'
              >
                {t('sections.bulk.chooseFiles', 'Select Files')}
              </GlassButton>
              <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                {resumes.length}/{MAX_FILES} uploaded
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Job Description Warning */}
      {!jobDescription && resumes.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 animate-fade-in">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm text-amber-200 font-medium">
            {t('sections.bulk.noJobWarning', 'Add a job description in the Match tab to analyze scores.')}
          </p>
        </div>
      )}

      {/* Resumes Grid */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {resumes.map((resume, index) => (
            <ResumeCard key={resume.id} resume={resume} onRemove={() => removeResume(index)} />
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {jobDescription && sortedResumes.length > 0 && (
        <GlassCard className="overflow-hidden animate-fade-in">
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              {t('sections.bulk.comparisonTitle', 'Detailed Comparison')}
            </h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-gray-400">
              {sortedResumes.length} Results
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 backdrop-blur-sm">
                  <th className="text-left py-4 px-6 font-semibold text-xs text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-4 px-6 font-semibold text-xs text-gray-400 uppercase tracking-wider">Candidate</th>
                  <th className="text-center py-4 px-6 font-semibold text-xs text-gray-400 uppercase tracking-wider">Match Score</th>
                  <th className="text-center py-4 px-6 font-semibold text-xs text-gray-400 uppercase tracking-wider">Key Matches</th>
                  <th className="text-right py-4 px-6 font-semibold text-xs text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedResumes.map((resume, index) => {
                  const rank = index + 1;
                  const RankIcon = rank === 1 ? Trophy : rank === 2 ? Medal : rank === 3 ? Award : null;
                  const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-600' : '';
                  const score = resume.analysis?.score || 0;

                  return (
                    <tr key={resume.id} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                            rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
                              rank === 2 ? "bg-gray-500/20 text-gray-300" :
                                rank === 3 ? "bg-amber-500/20 text-amber-500" :
                                  "bg-white/5 text-gray-500"
                          )}>
                            {rank}
                          </div>
                          {RankIcon && <RankIcon className={cn('w-4 h-4', rankColor)} />}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-white group-hover:text-purple-400 transition-colors">
                          {resume.name}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-block">
                          <ScoreBadge score={score} />
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-white font-medium">
                          {resume.analysis?.topHits?.length || resume.analysis?.matchedKeywords?.length || 0}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">found</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {rank === 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Best Match
                          </span>
                        ) : score >= 70 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/5 text-emerald-500 border border-emerald-500/10">
                            Strong
                          </span>
                        ) : score >= 50 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Moderate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Review
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {resumes.length === 0 && (
        <GlassCard className="mx-auto max-w-lg mt-12">
          <div className="py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6 transform rotate-12">
              <TrendingUp className="w-8 h-8 text-gray-400 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {t('sections.bulk.emptyTitle', 'Ready to Analyze')}
            </h3>
            <p className="text-gray-400 leading-relaxed">
              {t('sections.bulk.emptyDesc', 'Upload multiple resume versions to see which one aligns best with the job description.')}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        creditsRemaining={credits?.remaining || 0}
        dismissKey="watheq:upgradeDismissed-bulk"
      />

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingResumeIds([]);
        }}
        onConfirm={handleConfirmAnalysis}
        feature="ai_match"
        isLoading={false}
      />
    </div>
  );
}

