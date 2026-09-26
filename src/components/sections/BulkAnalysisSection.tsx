import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
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
import { getCompatibleStorageItem, removeCompatibleStorageItem, setCompatibleStorageItem } from '../../lib/utils/storage-migration';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { UpgradeModal } from '../Credits/UpgradeModal';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { createAssessmentContext } from '@/lib/match/assessmentContext';
import type { AssessmentContext, AssessmentRecord } from '@/types/assessment';
import type { StrategicRealityCheck } from '@/types/analysis';
import type { CachedAnalysis } from '@/types/templates';

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_KEY = 'watheq:bulkAnalysis';

// === Types ===
interface ResumeAnalysis {
  score?: number;
  topHits?: string[];
  matchedKeywords?: string[];
  missingKeywords?: string[];
  strategicRealityCheck?: StrategicRealityCheck | null;
  categoryScores?: CachedAnalysis['categoryScores'];
  reasoning?: string;
  overallAssessment?: string;
  recommendations?: string[];
  suggestions?: string[];
  strongMatches?: string[];
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
  assessment?: AssessmentRecord<ResumeAnalysis>;
}

interface BulkAnalysisSectionProps {
  jobDescription?: string;
}

/** A resume's text either comes from parsing an uploaded file or is already
 * known (the "use my uploaded resume" convenience row seeds it directly). */
type ResumeSource = { kind: 'file'; file: File } | { kind: 'text'; plainText: string };
interface RowRequest {
  id: string;
  rowId: string;
  jobSnapshot: string;
  language: 'en' | 'ar';
  createdAt: string;
  plainText?: string;
  context?: AssessmentContext;
}

// === Sub-components ===
const getScoreColor = (s: number) => {
  if (s >= 75) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (s >= 50) return 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';
};

const ScoreBadge = ({ score }: { score: number }) => {
  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full border', getScoreColor(score))}>
      <span className="text-sm font-bold">{score}%</span>
    </div>
  );
};

const ResumeCard = ({ resume, onRemove, contextStatus }: { resume: Resume; onRemove: () => void;
  contextStatus: 'current' | 'historical' | 'legacy' }) => {
  const { name, status, error, analysis } = resume;
  const { t } = useTranslation();

  return (
    <div className="group relative">
      <GlassCard padding="sm" className="h-full transition-[scale,box-shadow,border-color] duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-gray-300 dark:hover:border-white/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              status === 'completed' ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                status === 'error' ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" :
                  "bg-teal-500/10 text-teal-500 dark:text-teal-300"
            )}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate rtl:text-right" dir="auto" title={name}>{name}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1.5">
                {status === 'analyzing' || status === 'parsing' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </>
                ) : status === 'completed' ? (
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {contextStatus === 'current' ? 'Ready' : contextStatus === 'historical' ? 'Previous assessment' : 'Legacy assessment'}
                  </span>
                ) : status === 'error' ? (
                  <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
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
            type="button"
            onClick={onRemove}
            aria-label="Remove resume"
            className="text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-rose-500/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(status === 'analyzing' || status === 'parsing') && (
          <div className="mt-4 mb-2">
            <div className="w-full bg-gray-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full animate-pulse"
                style={{ width: '60%' }}
              />
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{error || 'Failed to analyze'}</span>
          </div>
        )}

        {status === 'completed' && analysis && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('sections.bulk.estimatedAlignment', 'Estimated alignment with this job description')}</span>
              <ScoreBadge score={analysis.score || 0} />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-2 text-center">
                <span className="block text-lg font-semibold text-gray-900 dark:text-white">
                  {analysis.topHits?.length || analysis.matchedKeywords?.length || 0}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keywords</span>
              </div>
            </div>
            {analysis.missingKeywords && analysis.missingKeywords.length > 0 && (
              <p className="text-xs text-rose-700 dark:text-rose-300">
                {t('sections.bulk.gaps', 'Requirements needing evidence')}: {analysis.missingKeywords.join(', ')}
              </p>
            )}
            {analysis.strategicRealityCheck?.summary && (
              <p className="text-xs text-gray-600 dark:text-gray-300">{analysis.strategicRealityCheck.summary}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('sections.bulk.hiringDisclaimer', 'This assessment does not predict a hiring decision.')}
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export function BulkAnalysisSection({ jobDescription }: BulkAnalysisSectionProps) {
  const { t, i18n } = useTranslation();
  const { credits, refetch: refetchCredits } = useUserCredits();
  const currentJob = jobDescription ?? '';
  const currentLanguage: 'en' | 'ar' = i18n.language === 'ar' ? 'ar' : 'en';
  const latestInput = useRef({ jobSnapshot: currentJob, language: currentLanguage });
  latestInput.current = { jobSnapshot: currentJob, language: currentLanguage };
  const previousInput = useRef(latestInput.current);
  const requests = useRef(new Map<string, RowRequest>());
  const [resumes, setResumes] = useState<Resume[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = getCompatibleStorageItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.filter((r: Resume) => r.status === 'completed' || r.status === 'error');
      }
    } catch {
      console.warn('[BulkAnalysisSection] Could not load saved rows');
    }
    return [];
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingResumeIds, setPendingResumeIds] = useState<string[]>([]);
  const [verifiedRowIds, setVerifiedRowIds] = useState<Set<string>>(new Set());
  const [selectedReportGroup, setSelectedReportGroup] = useState('');

  const isCurrentRequest = useCallback((request: RowRequest) =>
    requests.current.get(request.rowId) === request &&
    latestInput.current.jobSnapshot === request.jobSnapshot &&
    latestInput.current.language === request.language, []);
  useLayoutEffect(() => {
    if (previousInput.current.jobSnapshot === currentJob && previousInput.current.language === currentLanguage) return;
    previousInput.current = { jobSnapshot: currentJob, language: currentLanguage };
    requests.current.clear();
    setPendingResumeIds([]);
    setShowConfirmModal(false);
    setResumes(previous => previous.map(row =>
      row.status === 'parsing' || row.status === 'analyzing'
        ? { ...row, status: 'pending', error: null } : row));
  }, [currentJob, currentLanguage]);
  useLayoutEffect(() => () => { requests.current.clear(); }, []);

  useEffect(() => {
    let active = true;
    void Promise.all(resumes.map(async row => {
      if (row.status !== 'completed' || !row.analysis || !row.plainText || !row.assessment) return null;
      const { context, jobSnapshot, requestId, createdAt, result } = row.assessment;
      if (typeof requestId !== 'string' || !requestId || typeof createdAt !== 'string' ||
        !result || JSON.stringify(result) !== JSON.stringify(row.analysis)) return null;
      if (context.kind !== 'match' || context.isOptimized || context.rubricVersion !== 'match-v1') return null;
      const current = await createAssessmentContext({ resumeText: row.plainText, jobDescription: jobSnapshot,
        language: context.language, kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
      return current.key === context.key && current.resumeFingerprint === context.resumeFingerprint &&
        current.jobFingerprint === context.jobFingerprint ? row.id : null;
    })).then(ids => {
      if (active) setVerifiedRowIds(new Set(ids.filter((id): id is string => Boolean(id))));
    }).catch(() => { if (active) setVerifiedRowIds(new Set()); });
    return () => { active = false; };
  }, [resumes]);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const toSave: Resume[] = [];
      for (const r of resumes) {
        if (r.status === 'completed' || r.status === 'error') toSave.push({ ...r, file: null });
      }
      if (toSave.length > 0) {
        setCompatibleStorageItem(STORAGE_KEY, JSON.stringify(toSave));
      } else {
        removeCompatibleStorageItem(STORAGE_KEY);
      }
    } catch {
      console.warn('[BulkAnalysisSection] Could not save rows');
    }
  }, [resumes]);

  const clearSavedData = useCallback(() => {
    requests.current.clear();
    setPendingResumeIds([]);
    setShowConfirmModal(false);
    setSelectedReportGroup('');
    setResumes([]);
    removeCompatibleStorageItem(STORAGE_KEY);
  }, []);

  const allocateRequest = useCallback((rowId: string, jobSnapshot: string, language: 'en' | 'ar'): RowRequest => {
    const request = { id: crypto.randomUUID(), rowId, jobSnapshot, language, createdAt: new Date().toISOString() };
    requests.current.set(rowId, request);
    return request;
  }, []);

  const completeFromCache = useCallback((request: RowRequest) => {
    if (!request.context || !request.plainText || !isCurrentRequest(request)) return false;
    const cached = useResumeStore.getState().getCachedAssessment(request.context);
    if (!cached) return false;
    const analysis: ResumeAnalysis = { score: cached.score, strategicRealityCheck: cached.strategicRealityCheck,
      categoryScores: cached.categoryScores, reasoning: cached.reasoning,
      overallAssessment: cached.overallAssessment, recommendations: cached.recommendations,
      suggestions: cached.suggestions, strongMatches: cached.strongMatches,
      topHits: cached.matchedKeywords || cached.strongMatches || [],
      matchedKeywords: cached.matchedKeywords || cached.strongMatches || [],
      missingKeywords: cached.missingKeywords || [] };
    setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, plainText: request.plainText,
      analysis, status: 'completed', assessment: { context: request.context!, jobSnapshot: request.jobSnapshot,
        requestId: request.id, createdAt: request.createdAt, result: analysis } } : row));
    return true;
  }, [isCurrentRequest]);

  const prepareResume = useCallback(async (request: RowRequest, source: ResumeSource) => {
    try {
      let plainText: string;
      if (source.kind === 'file') {
        if (isCurrentRequest(request)) setResumes(previous => previous.map(row => row.id === request.rowId
          ? { ...row, status: 'parsing' } : row));
        const parsed = await parseResume(source.file);
        if (!isCurrentRequest(request)) return false;
        plainText = parsed?.plainText || '';
      } else plainText = source.plainText;
      if (!plainText) throw new Error('unreadable');
      if (!isCurrentRequest(request)) return false;
      request.plainText = plainText;
      setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, plainText,
        status: 'pending' } : row));
      if (!request.jobSnapshot) {
        setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, status: 'completed' } : row));
        return false;
      }
      request.context = await createAssessmentContext({ resumeText: plainText, jobDescription: request.jobSnapshot,
        language: request.language, kind: 'match', isOptimized: false, rubricVersion: 'match-v1' });
      if (!isCurrentRequest(request)) return false;
      return !completeFromCache(request);
    } catch {
      if (isCurrentRequest(request)) setResumes(previous => previous.map(row => row.id === request.rowId
        ? { ...row, status: 'error', error: 'Could not prepare this resume' } : row));
      return false;
    }
  }, [completeFromCache, isCurrentRequest]);

  const runAnalysis = useCallback(async (request: RowRequest) => {
    if (!request.context || !request.plainText || !isCurrentRequest(request)) return;
    if (completeFromCache(request)) return;
    setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, status: 'analyzing' } : row));
    try {
      const { getAuthHeaders } = await import('../../lib/auth/authHeaders');
      const headers = await getAuthHeaders();
      if (!isCurrentRequest(request)) return;
      const response = await fetch('/.netlify/functions/ai-match', { method: 'POST', headers,
        body: JSON.stringify({ resumeText: request.plainText, jobText: request.jobSnapshot, language: request.language }) });
      if (!isCurrentRequest(request)) return;
      if (response.status === 403) {
        setShowUpgradeModal(true);
        setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, status: 'error', error: 'Insufficient credits' } : row));
        return;
      }
      if (!response.ok) throw new Error('Analysis failed');
      const raw: ResumeAnalysis & { strongMatches?: string[]; matched_keywords?: string[] } = await response.json();
      if (!isCurrentRequest(request)) return;
      if (typeof raw.score !== 'number' || !Number.isFinite(raw.score)) throw new Error('Invalid score');
      const analysis: ResumeAnalysis = { ...raw, topHits: raw.topHits || raw.strongMatches || raw.matched_keywords || [],
        matchedKeywords: raw.matchedKeywords || raw.strongMatches || raw.matched_keywords || [] };
      useResumeStore.getState().setCachedAssessment(request.context, {
        score: raw.score, matchedKeywords: analysis.matchedKeywords,
        missingKeywords: analysis.missingKeywords,
        strategicRealityCheck: analysis.strategicRealityCheck,
        categoryScores: analysis.categoryScores, reasoning: analysis.reasoning,
        overallAssessment: analysis.overallAssessment, recommendations: analysis.recommendations,
        suggestions: analysis.suggestions, strongMatches: analysis.strongMatches });
      setResumes(previous => previous.map(row => row.id === request.rowId ? { ...row, analysis, status: 'completed',
        assessment: { context: request.context!, jobSnapshot: request.jobSnapshot,
          requestId: request.id, createdAt: request.createdAt, result: analysis } } : row));
      setTimeout(() => { if (isCurrentRequest(request)) void refetchCredits(); }, 500);
    } catch {
      if (isCurrentRequest(request)) setResumes(previous => previous.map(row => row.id === request.rowId
        ? { ...row, status: 'error', error: 'Analysis failed' } : row));
    }
  }, [completeFromCache, isCurrentRequest, refetchCredits]);

  const handleConfirmAnalysis = async () => {
    setShowConfirmModal(false);
    const ids = [...pendingResumeIds];
    setPendingResumeIds([]);
    for (const id of ids) {
      const request = requests.current.get(id);
      if (request) await runAnalysis(request);
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

    const jobSnapshot = latestInput.current.jobSnapshot;
    const language = latestInput.current.language;
    const rowRequests = newResumes.map(row => allocateRequest(row.id, jobSnapshot, language));
    setResumes(prev => [...prev, ...newResumes]);
    const pending: string[] = [];
    // Parsing is free and runs sequentially, so a cache hit never asks the
    // candidate to approve a charge and multi-file uploads share one modal.
    for (let index = 0; index < newResumes.length; index++) {
      if (await prepareResume(rowRequests[index], { kind: 'file', file: newResumes[index].file! })) {
        pending.push(newResumes[index].id);
      }
    }
    if (pending.length && latestInput.current.jobSnapshot === jobSnapshot && latestInput.current.language === language) {
      setPendingResumeIds(previous => [...previous, ...pending]);
      setShowConfirmModal(true);
    }
  }, [resumes.length, allocateRequest, prepareResume]);

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

  // Convenience only — parsing is free (FEATURE_COSTS.parse_resume === 0), so
  // this seeds the list from the already-parsed resume to skip a re-upload.
  // It does not change what ai-match analysis costs.
  const parsedResumeText = useResumeStore((state) => state.parsedResumeText);
  const originalResumeName = useResumeStore((state) => state.originalResume?.basics?.name);
  const hasUploadedResumeInList = Boolean(
    parsedResumeText && resumes.some((r) => r.plainText === parsedResumeText)
  );

  const addUploadedResume = useCallback(() => {
    if (!parsedResumeText || hasUploadedResumeInList || resumes.length >= MAX_FILES) return;
    const id = `uploaded-${Date.now()}`;
    const name = originalResumeName || t('sections.bulk.myResumeLabel', 'My resume');
    const request = allocateRequest(id, latestInput.current.jobSnapshot, latestInput.current.language);
    setResumes(prev => [...prev, {
      id,
      name,
      file: null,
      status: 'pending',
      plainText: parsedResumeText,
      analysis: null,
      error: null,
    }]);
    void prepareResume(request, { kind: 'text', plainText: parsedResumeText }).then(needsConfirmation => {
      if (!needsConfirmation || !isCurrentRequest(request)) return;
      setPendingResumeIds(previous => [...previous, id]);
      setShowConfirmModal(true);
    });
  }, [parsedResumeText, hasUploadedResumeInList, resumes.length, originalResumeName, t, allocateRequest, prepareResume, isCurrentRequest]);

  const removeResume = useCallback((index: number) => {
    const id = resumes[index]?.id;
    if (id) requests.current.delete(id);
    setResumes(prev => prev.filter((_, i) => i !== index));
  }, [resumes]);

  const validCompleted = useMemo(() => resumes.filter(row => row.status === 'completed' && row.analysis &&
    row.assessment && verifiedRowIds.has(row.id)), [resumes, verifiedRowIds]);
  const sortedResumes = useMemo(() => validCompleted.filter(row =>
    row.assessment?.jobSnapshot === currentJob && row.assessment.context.language === currentLanguage)
    .sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0)),
  [validCompleted, currentJob, currentLanguage]);
  const reportGroups = useMemo(() => {
    const groups = new Map<string, { jobSnapshot: string; language: 'en' | 'ar'; rows: Resume[] }>();
    for (const row of validCompleted) {
      const assessment = row.assessment!;
      const key = JSON.stringify([assessment.context.jobFingerprint, assessment.context.language,
        assessment.context.rubricVersion, assessment.jobSnapshot]);
      const group = groups.get(key) ?? { jobSnapshot: assessment.jobSnapshot,
        language: assessment.context.language, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
  }, [validCompleted]);
  const reportGroupId = reportGroups.length === 1 ? reportGroups[0].id : selectedReportGroup;
  const reportGroup = reportGroups.find(group => group.id === reportGroupId);

  const exportComparison = async () => {
    if (!reportGroup || reportGroup.rows.length === 0) return;
    // Capture one historical context before loading the PDF libraries. A job
    // switch cannot replace the description while this export is in flight.
    const reportJob = reportGroup.jobSnapshot;
    const isHistoricalReport = reportJob !== currentJob || reportGroup.language !== currentLanguage;
    const sortedReportRows = [...reportGroup.rows].sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0));
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

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

    if (isHistoricalReport) {
      doc.setFontSize(10);
      doc.setTextColor(146, 64, 14);
      doc.text('Historical assessment', 14, 38);
    }

    // Job Description Summary
    if (reportJob) {
      const offset = isHistoricalReport ? 9 : 0;
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text('Job Description Summary:', 14, 40 + offset);
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      const jdText = reportJob.substring(0, 300) + (reportJob.length > 300 ? '...' : '');
      const splitJd = doc.splitTextToSize(jdText, pageWidth - 28);
      doc.text(splitJd, 14, 47 + offset);
    }

    // Comparison Table
    const tableStartY = (reportJob ? 70 : 40) + (isHistoricalReport ? 9 : 0);

    autoTable(doc, {
      startY: tableStartY,
      head: [['Rank', 'Resume Name', 'Estimated alignment', 'Keywords', 'Relative rank']],
      body: sortedReportRows.map((r, idx) => {
        const score = r.analysis?.score || 0;
        const keywordCount = r.analysis?.topHits?.length || r.analysis?.matchedKeywords?.length || 0;
        const status = idx === 0 ? 'Highest score in this comparison' : 'Lower score in this comparison';
        return [`#${idx + 1}`, r.name, `${score}%`, keywordCount.toString(), status];
      }),
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: { fontSize: 10 }
    });

    // Missing Keywords per Resume
    let currentY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableStartY + 50;
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('This assessment does not predict a hiring decision.', 14, currentY + 7);
    currentY += 10;

    sortedReportRows.forEach((resume, idx) => {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <GlassCircle size="lg" variant="success" className="shadow-lg shadow-emerald-500/20">
            <BarChart3 className="w-8 h-8 text-emerald-500" />
          </GlassCircle>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {t('sections.bulk.title', 'Bulk Resume Analysis')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('sections.bulk.subtitle', 'Compare multiple versions side-by-side')}
            </p>
          </div>
        </div>

        {resumes.length > 0 && (
          <div className="flex items-center gap-3">
            <GlassButton variant="ghost" onClick={clearSavedData} className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300">
              <Trash2 className="w-4 h-4 me-2" />
              {t('sections.bulk.clearAll', 'Clear All')}
            </GlassButton>
            {reportGroups.length > 1 && (
              <select aria-label="Report assessment" value={selectedReportGroup}
                onChange={event => setSelectedReportGroup(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/20 dark:bg-gray-900 dark:text-white">
                <option value="">Select one assessment</option>
                {reportGroups.map(group => <option key={group.id} value={group.id}>
                  {group.jobSnapshot.slice(0, 80)} ({group.language})
                </option>)}
              </select>
            )}
            <GlassButton variant="primary" onClick={exportComparison} disabled={!reportGroup} className="shadow-lg shadow-primary-500/20">
              <Download className="w-4 h-4 me-2" />
              {t('sections.bulk.export', 'Export Report')}
            </GlassButton>
          </div>
        )}
      </GlassCard>

      {/* Use my uploaded resume — convenience row, skips a re-upload of the
          already-parsed resume. Parsing is free either way. */}
      {canUploadMore && parsedResumeText && !hasUploadedResumeInList && (
        <button
          type="button"
          onClick={addUploadedResume}
          className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-start transition-colors hover:bg-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:hover:bg-emerald-400/10"
        >
          <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 dark:text-white">
              {t('sections.bulk.useUploadedResume', 'Use my uploaded resume')}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400" dir="auto">
              {originalResumeName || t('sections.bulk.myResumeLabel', 'My resume')}
            </p>
          </div>
        </button>
      )}

      {/* Upload Area */}
      {canUploadMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'group relative rounded-2xl border-2 border-dashed transition-[border-color,background-color,box-shadow] duration-300 ease-in-out cursor-pointer overflow-hidden',
            isDragging
              ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
              : 'border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-black/60 backdrop-blur-sm hover:border-emerald-500/40 hover:bg-gray-200 dark:hover:bg-black/70'
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative py-16 px-6 text-center">
            <div className={cn(
              "w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center transition-[background-color,scale] duration-300",
              isDragging ? "bg-emerald-500/20 scale-110" : "bg-gray-200 dark:bg-white/5 group-hover:bg-gray-300 dark:group-hover:bg-white/10 group-hover:scale-105"
            )}>
              <Upload className={cn(
                "w-10 h-10 transition-colors duration-300",
                isDragging ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
              )} />
            </div>

            <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('sections.bulk.uploadTitle', 'Upload Resume Files')}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-sm mx-auto">
              {t('sections.bulk.uploadDesc', 'Drag & drop or click to browse. Supports PDF & DOCX up to 5MB.')}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mb-6">
              {t('sections.bulk.creditCost', '2 credits per resume analysis')}
            </p>

            <input
              type="file"
              id="bulk-upload"
              multiple
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
              aria-label={t('sections.bulk.uploadTitle', 'Upload Resume Files')}
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
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            {t('sections.bulk.noJobWarning', 'Add a job description in the Match tab to analyze scores.')}
          </p>
        </div>
      )}

      {/* Resumes Grid */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {resumes.map((resume, index) => (
            <ResumeCard key={resume.id} resume={resume} onRemove={() => removeResume(index)}
              contextStatus={!verifiedRowIds.has(resume.id) ? 'legacy'
                : resume.assessment?.jobSnapshot === currentJob && resume.assessment.context.language === currentLanguage
                  ? 'current' : 'historical'} />
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {jobDescription && sortedResumes.length > 0 && (
        <GlassCard className="overflow-hidden animate-fade-in">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              {t('sections.bulk.comparisonTitle', 'Detailed Comparison')}
            </h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
              {sortedResumes.length} Results
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100/50 dark:bg-white/5 backdrop-blur-sm">
                  <th className="text-left py-4 px-6 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-4 px-6 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Candidate</th>
                  <th className="text-center py-4 px-6 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('sections.bulk.estimatedAlignment', 'Estimated alignment with this job description')}</th>
                  <th className="text-center py-4 px-6 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key Matches</th>
                  <th className="text-right py-4 px-6 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedResumes.map((resume, index) => {
                  const rank = index + 1;
                  const RankIcon = rank === 1 ? Trophy : rank === 2 ? Medal : rank === 3 ? Award : null;
                  const rankColor = rank === 1 ? 'text-yellow-600 dark:text-yellow-400' : rank === 2 ? 'text-gray-400 dark:text-gray-300' : rank === 3 ? 'text-amber-600' : '';
                  const score = resume.analysis?.score || 0;

                  return (
                    <tr key={resume.id} className="group hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                            rank === 1 ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                              rank === 2 ? "bg-gray-500/20 text-gray-500 dark:text-gray-300" :
                                rank === 3 ? "bg-amber-500/20 text-amber-500" :
                                  "bg-gray-100 dark:bg-white/5 text-gray-500"
                          )}>
                            {rank}
                          </div>
                          {RankIcon && <RankIcon className={cn('w-4 h-4', rankColor)} />}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                          {resume.name}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-block">
                          <ScoreBadge score={score} />
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {resume.analysis?.topHits?.length || resume.analysis?.matchedKeywords?.length || 0}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">found</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {rank === 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {t('sections.bulk.highestScore', 'Highest score in this comparison')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                            {t('sections.bulk.lowerScore', 'Lower score in this comparison')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">
            {t('sections.bulk.hiringDisclaimer', 'This assessment does not predict a hiring decision.')}
          </p>
        </GlassCard>
      )}

      {/* Empty State */}
      {resumes.length === 0 && (
        <GlassCard className="mx-auto max-w-lg mt-12">
          <div className="py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-6 transform rotate-12">
              <TrendingUp className="w-8 h-8 text-gray-400 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('sections.bulk.emptyTitle', 'Ready to Analyze')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
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

