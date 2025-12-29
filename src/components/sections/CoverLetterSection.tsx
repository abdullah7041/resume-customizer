import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassCircle } from '../ui/GlassCircle';
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
  Loader2
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { cn } from '../../lib/utils/cn';
import { analytics } from '../../services/analytics';

const FUNCTION_BASE_PATH = '/.netlify/functions';
const GENERATE_ENDPOINT = `${FUNCTION_BASE_PATH}/generate-cover-letter`;
const STORAGE_KEY = 'airo:coverLetter';

// === Types ===
interface CoverLetterSectionProps {
  resumeText?: string;
  jobDescription?: string;
}

// === Tone options ===
const tones = [
  { value: 'professional', label: 'Professional', labelAr: 'احترافي', icon: Briefcase },
  { value: 'enthusiastic', label: 'Enthusiastic', labelAr: 'متحمس', icon: Zap },
  { value: 'formal', label: 'Formal', labelAr: 'رسمي', icon: BookOpen },
  { value: 'creative', label: 'Creative', labelAr: 'إبداعي', icon: Palette }
];

export function CoverLetterSection({ resumeText, jobDescription }: CoverLetterSectionProps) {
  const { t, i18n } = useTranslation();
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
        } catch (e) {
          console.error('Failed to load cover letter:', e);
        }
      }
    }
  }, []);

  // Update word count
  useEffect(() => {
    setWordCount(coverLetter ? coverLetter.trim().split(/\s+/).length : 0);
  }, [coverLetter]);

  const generateCoverLetter = useCallback(async () => {
    if (!resumeText || !jobDescription) {
      setError(t('sections.coverLetter.errors.missing', 'Please provide both resume and job description'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          companyName: companyName || undefined,
          hiringManager: hiringManager || undefined,
          tone
        }),
      });

      if (!response.ok) throw new Error(`Failed to generate: ${response.statusText}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setCoverLetter(data.coverLetter || '');
      setKeyHighlights(data.keyHighlights || []);
      setWordCount(data.wordCount || 0);

      // Track cover letter generation
      const generatedWordCount = data.wordCount || (data.coverLetter?.trim().split(/\s+/).length || 0);
      analytics.trackCoverLetter(generatedWordCount);

      // Save to localStorage
      if (typeof window !== 'undefined') {
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
      setError((err as Error).message || t('sections.coverLetter.errors.failed', 'Failed to generate cover letter'));
    } finally {
      setIsGenerating(false);
    }
  }, [resumeText, jobDescription, companyName, hiringManager, tone, t]);

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
    // Dynamic import docx to reduce bundle size
    const { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } = await import('docx');

    const paragraphs = coverLetter.split(/\n\n+/).filter(p => p.trim());
    const docChildren: any[] = [];

    if (companyName) {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: companyName, bold: true, size: 24 })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 120 }
      }));
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: currentDate, size: 22 })],
      spacing: { after: 240 }
    }));

    const greeting = hiringManager ? `Dear ${hiringManager},` : 'Dear Hiring Manager,';
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: greeting, size: 24 })],
      spacing: { after: 240 }
    }));

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (trimmed.toLowerCase().startsWith('dear ')) return;
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 24 })],
        spacing: { after: 200 },
        alignment: AlignmentType.JUSTIFIED
      }));
    });

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
    const filename = companyName
      ? `cover-letter-${companyName.toLowerCase().replace(/\s+/g, '-')}.docx`
      : `cover-letter-${Date.now()}.docx`;
    saveAs(blob, filename);
  };

  // Empty state
  if (!resumeText || !jobDescription) {
    return (
      <GlassCard variant="elevated">
        <div className="py-12 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('sections.coverLetter.emptyTitle', 'Missing Information')}
          </h3>
          <p>{t('sections.coverLetter.emptyDesc', 'Upload your resume and add a job description to generate a cover letter.')}</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <GlassCircle size="md" variant="indigo">
            <FileText className="w-5 h-5 text-indigo-400" />
          </GlassCircle>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.coverLetter.title', 'Cover Letter Generator')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.coverLetter.subtitle', 'Create a compelling, tailored cover letter using AI')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('sections.coverLetter.companyName', 'Company Name')} ({t('common.optional', 'Optional')})
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('sections.coverLetter.companyPlaceholder', 'e.g., Acme Corporation')}
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('sections.coverLetter.hiringManager', 'Hiring Manager')} ({t('common.optional', 'Optional')})
              </label>
              <input
                type="text"
                value={hiringManager}
                onChange={(e) => setHiringManager(e.target.value)}
                placeholder={t('sections.coverLetter.managerPlaceholder', 'e.g., John Smith')}
                className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">{t('sections.coverLetter.tone', 'Tone')}</label>
            <div className="flex flex-wrap gap-2">
              {tones.map(t => {
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={cn(
                      'px-4 py-2 rounded-xl border-2 transition-all flex items-center gap-2',
                      tone === t.value
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-indigo-500/50'
                    )}
                  >
                    <IconComponent className="w-4 h-4" />
                    {isArabic ? t.labelAr : t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <GlassButton onClick={generateCoverLetter} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                {t('sections.coverLetter.generating', 'Generating...')}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 me-2" />
                {coverLetter ? t('sections.coverLetter.regenerate', 'Regenerate') : t('sections.coverLetter.generate', 'Generate Cover Letter')}
              </>
            )}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Loading */}
      {isGenerating && (
        <GlassCard variant="elevated">
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
            <p className="text-gray-400">{t('sections.coverLetter.crafting', 'Crafting your personalized cover letter...')}</p>
          </div>
        </GlassCard>
      )}

      {/* Cover Letter Display */}
      {!isGenerating && coverLetter && (
        <GlassCard variant="elevated">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {t('sections.coverLetter.yourLetter', 'Your Cover Letter')}
              </h3>
              <p className="text-sm text-gray-400">
                {wordCount} {t('sections.coverLetter.words', 'words')} • {tones.find(t => t.value === tone)?.label} {t('sections.coverLetter.toneLabel', 'tone')}
              </p>
            </div>
            <div className="flex gap-2">
              <GlassButton variant="secondary" onClick={copyCoverLetter}>
                <Copy className="w-4 h-4 me-2" />
                {copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
              </GlassButton>
              <GlassButton onClick={downloadCoverLetter}>
                <Download className="w-4 h-4 me-2" />
                {t('common.download', 'Download')}
              </GlassButton>
            </div>
          </div>

          {/* Key Highlights */}
          {keyHighlights.length > 0 && (
            <div className="mb-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">
                {t('sections.coverLetter.highlights', 'Key Highlights Included')}
              </h4>
              <ul className="space-y-1">
                {keyHighlights.map((h, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            className="w-full h-[400px] p-4 rounded-xl bg-white/5 border border-white/10 text-white font-serif text-base leading-relaxed resize-none focus:outline-none focus:border-indigo-500/50"
          />

          <div className="mt-4 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <p className="text-sm text-indigo-300">
              💡 <strong>{t('sections.coverLetter.tipLabel', 'Tip')}:</strong> {t('sections.coverLetter.tipText', 'Edit the generated text to add personal touches and ensure accuracy.')}
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
