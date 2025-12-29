import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Trash2
} from 'lucide-react';
import { parseResume, analyzeResume } from '../../services/api';
import { cn } from '../../lib/utils/cn';

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
  const color = score >= 75
    ? 'bg-emerald-500/20 text-emerald-400'
    : score >= 50
      ? 'bg-amber-500/20 text-amber-400'
      : 'bg-rose-500/20 text-rose-400';
  return (
    <span className={cn('px-3 py-1 rounded-full text-sm font-bold', color)}>
      {score}%
    </span>
  );
};

const ResumeCard = ({ resume, onRemove }: { resume: Resume; onRemove: () => void }) => {
  const { name, status, error, analysis } = resume;
  return (
    <GlassCard variant="subtle" padding="sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-white truncate" title={name}>{name}</h4>
          <p className="text-sm text-gray-400 capitalize">{status}</p>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-400 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {status === 'analyzing' && (
        <div className="mt-2">
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-2 text-sm text-red-400">{error || 'Failed to analyze'}</div>
      )}

      {status === 'completed' && analysis && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Match Score</span>
            <ScoreBadge score={analysis.score || 0} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Keywords</span>
            <span className="text-sm font-semibold text-white">
              {analysis.topHits?.length || analysis.matchedKeywords?.length || analysis.localAnalysis?.matchedKeywords?.length || 0}
            </span>
          </div>
        </div>
      )}
    </GlassCard>
  );
};

export function BulkAnalysisSection({ jobDescription }: BulkAnalysisSectionProps) {
  const { t } = useTranslation();
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

  const processResume = useCallback(async (resumeId: string, file: File) => {
    setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'parsing' as const } : r));

    try {
      const parseResult = await parseResume(file);
      const plainText = parseResult?.plainText || '';
      if (!plainText) throw new Error('Failed to extract text from resume');

      setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, plainText, status: 'analyzing' as const } : r));

      if (jobDescription) {
        const aiAnalysis = await analyzeResume(plainText, jobDescription);
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, analysis: aiAnalysis, status: 'completed' as const } : r));
      } else {
        setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'completed' as const } : r));
      }
    } catch (error) {
      setResumes(prev => prev.map(r => r.id === resumeId ? { ...r, status: 'error' as const, error: (error as Error).message } : r));
    }
  }, [jobDescription]);

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
    await Promise.all(newResumes.map(resume => processResume(resume.id, resume.file!)));
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

  const exportComparison = () => {
    const completedResumes = resumes.filter(r => r.status === 'completed' && r.analysis);
    const sortedResumes = [...completedResumes].sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0));

    const exportData = {
      jobDescription: jobDescription?.substring(0, 200) + '...',
      comparisonDate: new Date().toISOString(),
      resumes: sortedResumes.map((r, idx) => ({
        rank: idx + 1,
        name: r.name,
        matchScore: r.analysis?.score || 0,
        keywordCount: r.analysis?.topHits?.length || r.analysis?.matchedKeywords?.length || 0,
        coverage: Math.round((r.analysis?.coverage || 0) * 100),
        missingKeywords: r.analysis?.missingKeywords || []
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resume-comparison-${Date.now()}.json`;
    link.click();
  };

  const canUploadMore = resumes.length < MAX_FILES;
  const completedResumes = resumes.filter(r => r.status === 'completed' && r.analysis);
  const sortedResumes = [...completedResumes].sort((a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GlassCircle size="md" variant="purple">
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </GlassCircle>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('sections.bulk.title', 'Bulk Resume Analysis')}
              </h3>
              <p className="text-sm text-gray-400">
                {t('sections.bulk.subtitle', 'Compare multiple resume versions side-by-side')}
              </p>
            </div>
          </div>
          {resumes.length > 0 && (
            <div className="flex items-center gap-2">
              <GlassButton variant="ghost" onClick={clearSavedData} className="text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 me-2" />
                {t('sections.bulk.clearAll', 'Clear All')}
              </GlassButton>
              <GlassButton variant="secondary" onClick={exportComparison}>
                <Download className="w-4 h-4 me-2" />
                {t('sections.bulk.export', 'Export Report')}
              </GlassButton>
            </div>
          )}
        </div>

        {/* Upload Area */}
        {canUploadMore && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 transition-all text-center',
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/20 hover:border-emerald-500/50'
            )}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-white mb-1">
              {t('sections.bulk.uploadTitle', 'Upload Resume Files')}
            </p>
            <p className="text-sm text-gray-400 mb-2">
              {t('sections.bulk.uploadDesc', 'Drag & drop or click to browse • PDF or DOCX')}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {resumes.length}/{MAX_FILES} {t('sections.bulk.uploaded', 'uploaded')}
            </p>
            <input
              type="file"
              id="bulk-upload"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
            <GlassButton onClick={() => document.getElementById('bulk-upload')?.click()}>
              <Upload className="w-4 h-4 me-2" />
              {t('sections.bulk.chooseFiles', 'Choose Files')}
            </GlassButton>
          </div>
        )}

        {/* No Job Description Warning */}
        {!jobDescription && resumes.length > 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-400">
              {t('sections.bulk.noJobWarning', 'Add a job description in the Match tab to analyze scores.')}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Resumes Grid */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume, index) => (
            <ResumeCard key={resume.id} resume={resume} onRemove={() => removeResume(index)} />
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {jobDescription && sortedResumes.length > 0 && (
        <GlassCard variant="elevated">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('sections.bulk.comparisonTitle', 'Comparison Results')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-400">Resume</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-400">Match Score</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-400">Keywords</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedResumes.map((resume, index) => {
                  const rank = index + 1;
                  const RankIcon = rank === 1 ? Trophy : rank === 2 ? Medal : rank === 3 ? Award : null;
                  const rankColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-600' : '';
                  const score = resume.analysis?.score || 0;

                  return (
                    <tr key={resume.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {RankIcon && <RankIcon className={cn('w-5 h-5', rankColor)} />}
                          <span className="font-semibold text-white">#{rank}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-white">{resume.name}</td>
                      <td className="py-3 px-4 text-center">
                        <ScoreBadge score={score} />
                      </td>
                      <td className="py-3 px-4 text-center text-white">
                        {resume.analysis?.topHits?.length || resume.analysis?.matchedKeywords?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rank === 1 ? (
                          <span className="text-emerald-400 font-semibold">✓ Best Match</span>
                        ) : score >= 70 ? (
                          <span className="text-emerald-400">Good</span>
                        ) : score >= 50 ? (
                          <span className="text-amber-400">Needs Work</span>
                        ) : (
                          <span className="text-rose-400">Revise</span>
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
        <GlassCard variant="subtle">
          <div className="py-12 text-center text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('sections.bulk.emptyTitle', 'No Resumes Uploaded')}
            </h3>
            <p>{t('sections.bulk.emptyDesc', 'Upload multiple resume versions to compare their match scores.')}</p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
