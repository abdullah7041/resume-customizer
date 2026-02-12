import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
import { GlassInput } from '../ui/GlassInput';
import {
  FileText,
  Wand2,
  Download,
  Copy,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Zap,
  BookOpen,
  Palette,
  Loader2,
  Edit3,
  UserCircle
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';
import { useResumeStore } from '../../lib/stores/resumeStore';
import { splitTextWithKeywords, shouldApplyBolding } from '../../lib/utils/keywordBolder';
import { useUserCredits } from '../../hooks/useUserCredits';
import { useFeatureTracking } from '../../hooks/useFeatureTracking';
import { UpgradeModal } from '../Credits/UpgradeModal';
import { ConfirmActionModal } from '../Credits/ConfirmActionModal';
import { FeedbackModal } from '../Feedback/FeedbackModal';
import type { ResumeSchema } from '../../types/resume';

const FUNCTION_BASE_PATH = '/.netlify/functions';
const GENERATE_ENDPOINT = `${FUNCTION_BASE_PATH}/generate-cover-letter`;
const STORAGE_KEY = 'airo:coverLetter';

// === Types ===
interface CoverLetterSectionProps {
  resumeText?: string;
  jobDescription?: string;
  resumeData?: ResumeSchema | null;
}

// Company name and hiring manager extraction functions removed
// These fields should be manually entered by the user, not auto-filled

// === Tone options ===
const tones = [
  { value: 'professional', label: 'Professional', labelAr: 'احترافي', icon: Briefcase, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { value: 'enthusiastic', label: 'Enthusiastic', labelAr: 'متحمس', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { value: 'formal', label: 'Formal', labelAr: 'رسمي', icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { value: 'creative', label: 'Creative', labelAr: 'إبداعي', icon: Palette, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' }
];

export function CoverLetterSection({ resumeText, jobDescription, resumeData }: CoverLetterSectionProps) {
  const { t, i18n } = useTranslation();
  const { credits, refetch: refetchCredits } = useUserCredits();
  const { trackFeatureUse, shouldShowFeedback, dismissFeedback } = useFeatureTracking();
  const isArabic = i18n.language === 'ar';

  const [coverLetter, setCoverLetter] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hiringManager, setHiringManager] = useState('');
  const [tone, setTone] = useState('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [keyHighlights, setKeyHighlights] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  // Auto-fill tracking removed - fields are now manual entry only

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setCoverLetter(data.coverLetter || '');
          setCompanyName(data.companyName || '');
          setHiringManager(data.hiringManager || '');
          setTone(data.tone || 'professional');
          setKeyHighlights(data.keyHighlights || []);
          setSignatureName(data.signatureName || '');
        } catch (e) {
          console.error('Failed to load cover letter:', e);
        }
      }
    }
  }, []);

  // Auto-fill signature from resume data
  useEffect(() => {
    if (resumeData?.basics?.name && !signatureName) {
      setSignatureName(resumeData.basics.name);
    }
  }, [resumeData?.basics?.name, signatureName]);

  // Update word count
  useEffect(() => {
    setWordCount(coverLetter ? coverLetter.trim().split(/\s+/).length : 0);
  }, [coverLetter]);

  // Auto-fill useEffect removed - company name and hiring manager should be manually entered

  // Simple change handlers for manual entry
  const handleCompanyChange = (value: string) => {
    setCompanyName(value);
  };

  const handleManagerChange = (value: string) => {
    setHiringManager(value);
  };

  const generateCoverLetterActual = useCallback(async () => {
    if (!resumeText || !jobDescription) {
      setError(t('sections.coverLetter.errors.missing', 'Please provide both resume and job description'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get authenticated headers (includes Authorization Bearer token)
      const { getAuthHeaders } = await import('../../lib/auth/authHeaders');
      const headers = await getAuthHeaders();

      const response = await fetch(GENERATE_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resumeText,
          jobDescription,
          companyName: companyName || undefined,
          hiringManager: hiringManager || undefined,
          tone
        }),
      });

      // Handle insufficient credits (403)
      if (response.status === 403) {
        setShowUpgradeModal(true);
        setIsGenerating(false);
        return;
      }

      if (!response.ok) throw new Error(`Failed to generate: ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      let generatedKeyHighlights = data.keyHighlights || [];
      let generatedText = data.coverLetter || '';

      // Auto-format if blob (no newlines found but has length)
      if (generatedText.length > 100 && !generatedText.includes('\n')) {
        // Safe heuristic: split on clear transition words and salutations
        generatedText = generatedText
          .replace(/(Dear\s+[^,]+,)/g, "$1\n\n")
          // Split before common paragraph starters if they follow a period
          .replace(/([.!?])\s+(?=(?:In|The|I\s|As|My|This|Furthermore|However|Finally|While|With)\s)/g, "$1\n\n")
          .replace(/(Sincerely,|Best regards,|Respectfully,)/g, "\n\n$1");
      }

      // Calculate word count from the processed text
      const calculatedWordCount = data.wordCount || (generatedText.trim().split(/\s+/).length || 0);

      setCoverLetter(generatedText);
      setKeyHighlights(generatedKeyHighlights);
      setWordCount(calculatedWordCount);

      // Track cover letter generation
      analytics.trackCoverLetter(calculatedWordCount);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          coverLetter: data.coverLetter,
          companyName,
          hiringManager,
          tone,
          keyHighlights: data.keyHighlights,
          signatureName,
          generatedAt: new Date().toISOString()
        }));
      }

      // Track feature use for feedback prompt
      trackFeatureUse('cover-letter');

      // Check if we should show feedback modal (with 5-10 second delay for better UX)
      if (shouldShowFeedback) {
        const delay = 5000 + Math.random() * 5000; // Random 5-10 seconds
        setTimeout(() => {
          setShowFeedbackModal(true);
        }, delay);
      }

      // Refetch credits to update balance (credits were consumed by backend)
      setTimeout(() => refetchCredits(), 500);
    } catch (err) {
      setError((err as Error).message || t('sections.coverLetter.errors.failed', 'Failed to generate cover letter'));
    } finally {
      setIsGenerating(false);
    }
  }, [resumeText, jobDescription, companyName, hiringManager, tone, refetchCredits, trackFeatureUse, shouldShowFeedback, t]);

  // Wrapper function that shows confirmation modal first
  const generateCoverLetter = () => {
    if (!resumeText || !jobDescription) {
      setError(t('sections.coverLetter.errors.missing', 'Please provide both resume and job description'));
      return;
    }
    setShowConfirmModal(true);
  };

  // Handler for confirmed cover letter generation
  const handleConfirmGenerate = async () => {
    setShowConfirmModal(false);
    await generateCoverLetterActual();
  };

  const copyCoverLetter = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadCoverLetter = async () => {
    // Get keywords and bold preference from store
    const store = useResumeStore.getState();
    const keywords = store.optimizationMetrics?.jdKeywords || [];
    const boldKeywordsFlag = store.displayOptions?.boldKeywords ?? true;

    // Dynamic import docx to reduce bundle size
    const { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip, LineRuleType } = await import('docx');

    // Professional font settings - Times New Roman 12pt (size in half-points: 12 * 2 = 24)
    const fontConfig = { font: 'Times New Roman', size: 24 };
    const lineSpacing = { line: 276, lineRule: LineRuleType.AUTO }; // 1.15 line spacing

    // Helper to create TextRuns with keyword bolding
    const createTextRuns = (text: string): any[] => {
      const applyBolding = shouldApplyBolding(keywords, boldKeywordsFlag);

      if (!applyBolding) {
        return [new TextRun({ text, ...fontConfig })];
      }

      const segments = splitTextWithKeywords(text, keywords, 15); // Top 15 keywords
      return segments.map(segment =>
        new TextRun({
          text: segment.text,
          ...fontConfig,
          bold: segment.bold,
        })
      );
    };

    // Remove any existing greeting from the cover letter content to avoid duplication
    let cleanedContent = coverLetter.trim();
    // Remove greeting line if it exists (e.g., "Dear Hiring Manager," or "Dear [Name],")
    cleanedContent = cleanedContent.replace(/^Dear\s+[^,\n]+,?\s*/i, '');

    // Split into paragraphs and filter empty ones
    const contentParagraphs = cleanedContent.split(/\n\n+/).filter(p => p.trim());
    const docChildren: any[] = [];

    // Company name (bold, left-aligned)
    if (companyName) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: companyName, bold: true, ...fontConfig })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 200, ...lineSpacing }
      }));
    }

    // Date (formatted professionally)
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: currentDate, ...fontConfig })],
      spacing: { after: 400, ...lineSpacing }
    }));

    // Greeting
    const greeting = hiringManager ? `Dear ${hiringManager},` : 'Dear Hiring Manager,';
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: greeting, ...fontConfig })],
      spacing: { after: 280, ...lineSpacing }
    }));

    // Body paragraphs (justified, proper spacing, with keyword bolding)
    contentParagraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) return;
      docChildren.push(new Paragraph({
        children: createTextRuns(trimmed),
        spacing: { after: 280, ...lineSpacing },
        alignment: AlignmentType.JUSTIFIED
      }));
    });

    // Signature
    if (signatureName) {
      // "Sincerely,"
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: 'Sincerely,', ...fontConfig })],
        spacing: { after: 600, ...lineSpacing } // Extra space before signature
      }));

      // Signature name (bold)
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: signatureName, bold: true, ...fontConfig })],
        spacing: { after: 200, ...lineSpacing }
      }));
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1)
            }
          }
        },
        children: docChildren
      }]
    });

    const blob = await Packer.toBlob(doc);

    // Generate filename with username and company name
    const username = resumeData?.basics?.name
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') // Remove special chars
      || 'user';

    const companySlug = companyName
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      || '';

    const filename = companySlug
      ? `cover-letter-${username}-${companySlug}.docx`
      : `cover-letter-${username}.docx`;

    saveAs(blob, filename);
  };

  // Empty state
  if (!resumeText || !jobDescription) {
    return (
      <GlassCard className="border-dashed border-white/10 bg-white/5">
        <div className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400 opacity-50" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {t('sections.coverLetter.emptyTitle', 'Missing Information')}
          </h3>
          <p className="text-gray-400 max-w-md mx-auto">
            {t('sections.coverLetter.emptyDesc', 'Upload your resume and add a job description to generate a tailored cover letter.')}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Configuration */}
      <GlassCard className="overflow-hidden">
        <div className="flex items-center gap-4 mb-8">
          <GlassCircle size="lg" variant="indigo" className="shadow-lg shadow-indigo-500/20">
            <FileText className="w-6 h-6 text-indigo-300" />
          </GlassCircle>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              {t('sections.coverLetter.title', 'Cover Letter Generator')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.coverLetter.subtitle', 'Create a compelling, tailored cover letter using AI')}
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassInput
              label={`${t('sections.coverLetter.companyName', 'Company Name')} (${t('common.optional', 'Optional')})`}
              value={companyName}
              onChange={(e) => handleCompanyChange(e.target.value)}
              placeholder={t('sections.coverLetter.companyPlaceholder', 'e.g., Aramco')}
              leftIcon={<Briefcase className="w-4 h-4" />}
            />
            <GlassInput
              label={`${t('sections.coverLetter.hiringManager', 'Hiring Manager')} (${t('common.optional', 'Optional')})`}
              value={hiringManager}
              onChange={(e) => handleManagerChange(e.target.value)}
              placeholder={t('sections.coverLetter.managerPlaceholder', 'e.g., Abdullah Al-Otaibi')}
              leftIcon={<UserCircle className="w-4 h-4" />}
            />
          </div>

          {/* Signature Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('sections.coverLetter.signatureName', 'Signature Name')}
            </label>
            <GlassInput
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder={t('sections.coverLetter.signatureNamePlaceholder', 'Your full name')}
              leftIcon={<UserCircle className="w-4 h-4" />}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('sections.coverLetter.signatureHint', 'Auto-filled from your resume. Edit if needed.')}
            </p>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3 ml-1">
              {t('sections.coverLetter.tone', 'Select Tone')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {tones.map(tOption => {
                const IconComponent = tOption.icon;
                const isSelected = tone === tOption.value;
                return (
                  <button
                    key={tOption.value}
                    onClick={() => setTone(tOption.value)}
                    className={cn(
                      'relative px-4 py-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 group',
                      isSelected
                        ? `border-indigo-500 bg-indigo-500/20 text-white shadow-lg shadow-indigo-500/20`
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20'
                    )}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
                    )}
                    <IconComponent className={cn(
                      "w-6 h-6 transition-colors duration-300",
                      isSelected ? "text-indigo-300" : "text-gray-500 group-hover:text-gray-300"
                    )} />
                    <span className="text-sm font-medium">
                      {isArabic ? tOption.labelAr : tOption.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in zoom-in-95">
              <div className="p-2 bg-red-500/20 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm text-red-300 font-medium">{error}</p>
            </div>
          )}

          <GlassButton
            onClick={generateCoverLetter}
            disabled={isGenerating}
            size="lg"
            className="w-full relative overflow-hidden group"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('sections.coverLetter.generating', 'Crafting your letter...')}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                <span>
                  {coverLetter ? t('sections.coverLetter.regenerate', 'Regenerate Cover Letter') : t('sections.coverLetter.generate', 'Generate Cover Letter')}
                  <span className="ml-2 text-xs opacity-75">(4 {t('common.credits', 'credits')})</span>
                </span>
              </div>
            )}
            {!isGenerating && (
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Loading State */}
      {isGenerating && (
        <GlassCard className="p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 scale-75 animate-ping" />
              <FileText className="absolute inset-0 m-auto w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {t('sections.coverLetter.craftingTitle', 'AI is writing...')}
            </h3>
            <p className="text-gray-400 max-w-sm">
              {t('sections.coverLetter.crafting', 'Analyzing your resume and job description to create the perfect cover letter.')}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Result Display */}
      {!isGenerating && coverLetter && (
        <GlassCard className="overflow-hidden border-t-4 border-t-indigo-500/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                {t('sections.coverLetter.yourLetter', 'Your Cover Letter')}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  {wordCount} {t('sections.coverLetter.words', 'words')}
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="flex items-center gap-1.5 capitalize">
                  {tones.find(t => t.value === tone)?.icon && (() => {
                    const Icon = tones.find(t => t.value === tone)!.icon;
                    return <Icon className="w-4 h-4 text-indigo-400" />
                  })()}
                  {tones.find(t => t.value === tone)?.label} {t('sections.coverLetter.toneLabel', 'tone')}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <GlassButton variant="secondary" size="sm" onClick={copyCoverLetter} className="flex-1 md:flex-none justify-center">
                {copied ? <CheckCircle2 className="w-4 h-4 me-2 text-emerald-400" /> : <Copy className="w-4 h-4 me-2" />}
                {copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
              </GlassButton>
              <GlassButton size="sm" onClick={downloadCoverLetter} className="flex-1 md:flex-none justify-center">
                <Download className="w-4 h-4 me-2" />
                {t('common.download', 'DOCX')}
              </GlassButton>
            </div>
          </div>

          {/* Key Highlights */}
          {keyHighlights.length > 0 && (
            <div className="mb-6 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {t('sections.coverLetter.highlights', 'Key Highlights Included')}
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {keyHighlights.map((h, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="leading-tight">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Document Container - Professional Word-like appearance */}
          <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 p-4 md:p-8 lg:p-12 rounded-xl">
            {/* Edit Toggle Button */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "absolute top-6 right-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                isEditing
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-white/80 text-gray-600 hover:bg-white shadow-md"
              )}
            >
              <Edit3 className="w-4 h-4" />
              {isEditing ? t('common.done', 'Done') : t('common.edit', 'Edit')}
            </button>

            {/* Paper Document */}
            <div className="max-w-3xl mx-auto bg-white rounded shadow-2xl shadow-gray-400/30 overflow-hidden">
              {/* Document Content */}
              <div
                className="p-10 md:p-14 lg:p-16 min-h-[700px]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                {isEditing ? (
                  /* Edit Mode - Textarea */
                  <textarea
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full min-h-[600px] text-gray-800 text-[17px] leading-relaxed bg-transparent resize-none focus:outline-none border-2 border-dashed border-gray-300 rounded-lg p-4 -m-4"
                    style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
                    autoFocus
                  />
                ) : (
                  /* View Mode - Rendered Document */
                  <div className="text-gray-800 text-[17px] leading-relaxed">
                    {/* Header */}
                    {companyName && (
                      <p className="font-bold text-lg mb-1">{companyName}</p>
                    )}
                    <p className="text-gray-600 mb-6">
                      {new Date().toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </p>

                    {/* Greeting */}
                    <p className="mb-6">
                      {hiringManager ? `Dear ${hiringManager},` : 'Dear Hiring Manager,'}
                    </p>

                    {/* Body Paragraphs */}
                    {coverLetter
                      .replace(/^Dear\s+[^,]+,?\s*/i, '') // Remove greeting from body
                      .split(/\n\n+/)
                      .filter(p => p.trim())
                      .map((para, idx) => (
                        <p key={idx} className="mb-5 text-justify">
                          {para.trim()}
                        </p>
                      ))
                    }

                    {/* Signature */}
                    {signatureName && (
                      <div className="mt-8">
                        <p className="mb-1">Sincerely,</p>
                        <p className="mt-4 font-semibold">{signatureName}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
            <div className="p-1.5 bg-indigo-500/20 rounded-md">
              <Wand2 className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-sm text-indigo-200/80">
              <strong>{t('sections.coverLetter.tipLabel', 'Pro Tip')}:</strong> {t('sections.coverLetter.tipText', 'Review and edit the generated text to add your personal touch before sending.')}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        creditsRemaining={credits?.remaining || 0}
        dismissKey="watheq:upgradeDismissed-coverletter"
      />

      {/* Credit Confirmation Modal */}
      <ConfirmActionModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmGenerate}
        feature="cover_letter"
        isLoading={isGenerating}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          dismissFeedback();
        }}
      />
    </div>
  );
}

function _UserIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
