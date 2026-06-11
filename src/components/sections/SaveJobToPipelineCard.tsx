import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Save, Loader2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useAuth } from '../../hooks/useAuth';
import { analytics } from '../../services/analytics';
import { createJobApplication } from '../../services/pipeline';
import type { ExtractedJobMetadata, JobApplicationStatus } from '../../types/pipeline';

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
  const [jobUrl, setJobUrl] = useState('');
  const [location, setLocation] = useState(extractedMetadata?.location || '');
  const [employmentType, setEmploymentType] = useState(extractedMetadata?.employmentType || '');
  const [seniority, setSeniority] = useState(extractedMetadata?.seniority || '');
  const [sector, setSector] = useState(extractedMetadata?.sector || '');
  const [status, setStatus] = useState<JobApplicationStatus>('saved');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const needsConfirmation = extractedMetadata?.needsUserConfirmation ?? true;

  useEffect(() => {
    if (extractedMetadata?.companyName && !companyName) {
      setCompanyName(extractedMetadata.companyName);
    }
    if (extractedMetadata?.jobTitle && !jobTitle) {
      setJobTitle(extractedMetadata.jobTitle);
    }
    if (extractedMetadata?.location && !location) {
      setLocation(extractedMetadata.location);
    }
    if (extractedMetadata?.employmentType && !employmentType) {
      setEmploymentType(extractedMetadata.employmentType);
    }
    if (extractedMetadata?.seniority && !seniority) {
      setSeniority(extractedMetadata.seniority);
    }
    if (extractedMetadata?.sector && !sector) {
      setSector(extractedMetadata.sector);
    }
  }, [companyName, employmentType, extractedMetadata, jobTitle, location, sector, seniority]);

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
        job_url: jobUrl.trim() || null,
        location: location.trim() || null,
        employment_type: employmentType.trim() || null,
        seniority: seniority.trim() || null,
        sector: sector.trim() || null,
        match_score: matchScore ?? null,
        status,
        notes: notes.trim() || null,
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
              aria-label={t('pipeline.companyName', 'Company')}
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
              aria-label={t('pipeline.jobTitle', 'Job Title')}
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

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.jobUrl', 'Job URL')}
          </label>
          <input
            type="url"
            aria-label={t('pipeline.jobUrl', 'Job URL')}
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.location', 'Location')}
            </label>
            <input
              type="text"
              aria-label={t('pipeline.location', 'Location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.employmentType', 'Employment type')}
            </label>
            <input
              type="text"
              aria-label={t('pipeline.employmentType', 'Employment type')}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.seniority', 'Seniority')}
            </label>
            <input
              type="text"
              aria-label={t('pipeline.seniority', 'Seniority')}
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.sector', 'Sector')}
            </label>
            <input
              type="text"
              aria-label={t('pipeline.sector', 'Sector')}
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.status', 'Status')}
          </label>
          <select
            aria-label={t('pipeline.status', 'Status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as JobApplicationStatus)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {(['saved', 'applied', 'offer', 'rejected', 'withdrawn'] as JobApplicationStatus[]).map((value) => (
              <option key={value} value={value}>
                {t(`pipeline.${value}`, value)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.notes', 'Notes')}
          </label>
          <textarea
            aria-label={t('pipeline.notes', 'Notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('pipeline.addNotes', 'Add notes...')}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
        </div>

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
