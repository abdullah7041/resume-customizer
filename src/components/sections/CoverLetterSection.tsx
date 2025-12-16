import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { Mail, Copy, Download, RefreshCw, Check } from 'lucide-react';
import { cn } from '../../lib/utils/cn';

interface CoverLetterSectionProps {
  onGenerate: (params: {
    company: string;
    position: string;
    tone: string;
  }) => Promise<string>;
  isGenerating: boolean;
}

export function CoverLetterSection({
  onGenerate,
  isGenerating,
}: CoverLetterSectionProps) {
  const { t } = useTranslation();
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [tone, setTone] = useState('professional');
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tones = [
    { id: 'professional', label: t('sections.coverLetter.inputs.tones.professional') },
    { id: 'friendly', label: t('sections.coverLetter.inputs.tones.friendly') },
    { id: 'confident', label: t('sections.coverLetter.inputs.tones.confident') },
    { id: 'enthusiastic', label: t('sections.coverLetter.inputs.tones.enthusiastic') },
  ];

  const handleGenerate = async () => {
    if (!company || !position) return;
    const letter = await onGenerate({ company, position, tone });
    setCoverLetter(letter);
  };

  const handleCopy = async () => {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('sections.coverLetter.title')}
            </h3>
            <p className="text-sm text-gray-400">
              {t('sections.coverLetter.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <GlassInput
            label={t('sections.coverLetter.inputs.company')}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g., Saudi Aramco"
          />

          <GlassInput
            label={t('sections.coverLetter.inputs.position')}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g., Senior Data Analyst"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {t('sections.coverLetter.inputs.tone')}
            </label>
            <div className="flex flex-wrap gap-2">
              {tones.map((toneOption) => (
                <button
                  key={toneOption.id}
                  onClick={() => setTone(toneOption.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    tone === toneOption.id
                      ? 'bg-pink-500 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  )}
                >
                  {toneOption.label}
                </button>
              ))}
            </div>
          </div>

          <GlassButton
            onClick={handleGenerate}
            isLoading={isGenerating}
            disabled={!company || !position}
            className="w-full mt-4"
            leftIcon={<Mail className="w-4 h-4" />}
          >
            {t('sections.coverLetter.generate')}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Result Section */}
      <GlassCard variant="elevated">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            {t('sections.coverLetter.result.title')}
          </h3>
          {coverLetter && (
            <div className="flex gap-2">
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? t('common.copied') : t('common.copy')}
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
              >
                {t('common.download')}
              </GlassButton>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                {t('sections.coverLetter.result.regenerate')}
              </GlassButton>
            </div>
          )}
        </div>

        {coverLetter ? (
          <div className="p-4 bg-white/5 rounded-xl max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
              {coverLetter}
            </pre>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('sections.coverLetter.subtitle')}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
