import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Save, Loader2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useAuth } from '../../hooks/useAuth';
import { analytics } from '../../services/analytics';
import { createJobApplication } from '../../services/pipeline';
import type { ExtractedJobMetadata } from '../../types/pipeline';

interface SaveJobToPipelineCardProps {
  jobDescription: string;
  matchScore?: number | null;
  extractedMetadata?: ExtractedJobMetadata | null;
  onSaved?: (id: string) => void;
  onToast?: (toast: { type: 'success' | 'warning' | 'danger' | 'info'; title: string; description?: string }) => void;
}

export function SaveJobToPipelineCard({
  jobDescription,
  matchScore,
  extractedMetadata,
  onSaved,
  onToast,
}: SaveJobToPipelineCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState(extractedMetadata?.companyName || '');
  const [jobTitle, setJobTitle] = useState(extractedMetadata?.jobTitle || '');
  const [isSaving, setIsSaving] = useState(false);

  const needsConfirmation = extractedMetadata?.needsUserConfirmation ?? true;

  useEffect(() => {
    if (extractedMetadata?.companyName && !companyName) {
      setCompanyName(extractedMetadata.companyName);
    }
    if (extractedMetadata?.jobTitle && !jobTitle) {
      setJobTitle(extractedMetadata.jobTitle);
    }
  }, [companyName, extractedMetadata, jobTitle]);

  const handleSave = async () => {
    if (!user) {
      analytics.trackPipelineSaveClicked();
      onToast?.({
        type: 'warning',
        title: t('pipeline.signInToSave', 'Sign in to save this job'),
      });
      return;
    }

    analytics.trackPipelineSaveClicked();
    setIsSaving(true);

    try {
      const { data, error, isDuplicate } = await createJobApplication({
        company_name: companyName.trim() || null,
        job_title: jobTitle.trim() || null,
        job_description: jobDescription,
        location: extractedMetadata?.location || null,
        employment_type: extractedMetadata?.employmentType || null,
        seniority: extractedMetadata?.seniority || null,
        sector: extractedMetadata?.sector || null,
        match_score: matchScore ?? null,
        status: 'saved',
        metadata: {
          extractionConfidence: extractedMetadata?.confidence ?? null,
          needsUserConfirmation: needsConfirmation,
        },
      });

      if (error || !data) {
        analytics.trackPipelineSaveFailed(error || 'unknown');
        onToast?.({
          type: 'danger',
          title: t('pipeline.saveFailed', 'Failed to save job'),
          description: error || undefined,
        });
        return;
      }

      analytics.trackPipelineJobSaved({ is_duplicate: isDuplicate || false });

      if (isDuplicate) {
        onToast?.({
          type: 'info',
          title: t('pipeline.alreadySaved', 'This job was already saved'),
          description: t('pipeline.updateExisting', 'Update existing record'),
        });
      } else {
        onToast?.({
          type: 'success',
          title: t('common.save', 'Save'),
          description: t('pipeline.saveJobDesc', 'Track your application progress'),
        });
      }

      onSaved?.(data.id);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard className="mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Briefcase className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('pipeline.saveJob', 'Save this job to pipeline')}
          </h4>
          <p className="text-xs text-gray-500">
            {t('pipeline.saveJobDesc', 'Track your application progress')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(needsConfirmation || !extractedMetadata?.companyName) && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.companyName', 'Company')}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('pipeline.unknownCompany', 'Unknown company')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        )}

        {(needsConfirmation || !extractedMetadata?.jobTitle) && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.jobTitle', 'Job Title')}
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={t('pipeline.untitledRole', 'Untitled role')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        )}

        {!needsConfirmation && extractedMetadata?.companyName && extractedMetadata?.jobTitle && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p><span className="font-medium">{t('pipeline.companyName', 'Company')}:</span> {extractedMetadata.companyName}</p>
            <p><span className="font-medium">{t('pipeline.jobTitle', 'Job Title')}:</span> {extractedMetadata.jobTitle}</p>
          </div>
        )}

        <GlassButton
          variant="secondary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          leftIcon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          className="w-full"
        >
          {isSaving ? t('common.submitting', 'Sending...') : t('common.save', 'Save')}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
