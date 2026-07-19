import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Save, Loader2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useAuth } from '../../hooks/useAuth';
import { analytics } from '../../services/analytics';
import { createJobApplication } from '../../services/pipeline';
import type { ExtractedJobMetadata, JobApplicationStatus } from '../../types/pipeline';
import { requestValueMomentFeedbackPrompt } from '../Feedback/FeedbackPromptController';

interface SaveJobToPipelineCardProps {
  jobDescription: string;
  matchScore?: number | null;
  extractedMetadata?: ExtractedJobMetadata | null;
  onSaved?: (id: string) => void;
  onToast?: (toast: { type: 'success' | 'warning' | 'danger' | 'info'; title: string; description?: string }) => void;
  /** Set when the job was already auto-saved — the card becomes an update form. */
  savedApplicationId?: string | null;
}

const UNKNOWN_COMPANY_VALUE = 'unknown company';

const sanitizeMetadataField = (value?: string | null) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return '';
  return trimmed;
};

const sanitizeCompanyName = (value?: string | null) => {
  const sanitized = sanitizeMetadataField(value);
  return sanitized.toLowerCase() === UNKNOWN_COMPANY_VALUE ? '' : sanitized;
};

export function SaveJobToPipelineCard({
  jobDescription,
  matchScore,
  extractedMetadata,
  onSaved,
  onToast,
  savedApplicationId,
}: SaveJobToPipelineCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState(() => sanitizeCompanyName(extractedMetadata?.companyName));
  const [jobTitle, setJobTitle] = useState(() => sanitizeMetadataField(extractedMetadata?.jobTitle));
  const [jobUrl, setJobUrl] = useState('');
  const [location, setLocation] = useState(() => sanitizeMetadataField(extractedMetadata?.location));
  const [employmentType, setEmploymentType] = useState(() => sanitizeMetadataField(extractedMetadata?.employmentType));
  const [seniority, setSeniority] = useState(() => sanitizeMetadataField(extractedMetadata?.seniority));
  const [sector, setSector] = useState(() => sanitizeMetadataField(extractedMetadata?.sector));
  const [status, setStatus] = useState<JobApplicationStatus>('saved');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const needsConfirmation = extractedMetadata?.needsUserConfirmation ?? true;

  const seededMetadataRef = useRef<ExtractedJobMetadata | null>(null);

  // Seed editable fields once per distinct metadata object, filling only blanks so
  // user edits are never clobbered. Keyed on metadata identity (not the field values)
  // so editing/clearing a field can't re-trigger this — that dep chain caused an extra
  // render per field and re-filled fields the user had cleared. React 19 batches the
  // setters below into a single render.
  useEffect(() => {
    if (!extractedMetadata || seededMetadataRef.current === extractedMetadata) return;
    seededMetadataRef.current = extractedMetadata;

    const nextCompanyName = sanitizeCompanyName(extractedMetadata.companyName);
    const nextJobTitle = sanitizeMetadataField(extractedMetadata.jobTitle);
    const nextLocation = sanitizeMetadataField(extractedMetadata.location);
    const nextEmploymentType = sanitizeMetadataField(extractedMetadata.employmentType);
    const nextSeniority = sanitizeMetadataField(extractedMetadata.seniority);
    const nextSector = sanitizeMetadataField(extractedMetadata.sector);

    if (nextCompanyName && !companyName) setCompanyName(nextCompanyName);
    if (nextJobTitle && !jobTitle) setJobTitle(nextJobTitle);
    if (nextLocation && !location) setLocation(nextLocation);
    if (nextEmploymentType && !employmentType) setEmploymentType(nextEmploymentType);
    if (nextSeniority && !seniority) setSeniority(nextSeniority);
    if (nextSector && !sector) setSector(nextSector);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- field values intentionally excluded; seed runs once per metadata identity
  }, [extractedMetadata]);

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
      requestValueMomentFeedbackPrompt('pipeline_save');

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
            {savedApplicationId
              ? t('pipeline.autoSavedTitle', 'Saved to your pipeline')
              : t('pipeline.saveJob', 'Save this job to pipeline')}
          </h4>
          <p className="text-xs text-gray-500">
            {savedApplicationId
              ? t('pipeline.autoSavedDesc', 'Details were saved automatically — edit and save to update.')
              : t('pipeline.saveJobDesc', 'Track your application progress')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(needsConfirmation || !extractedMetadata?.companyName) && (
          <div>
            <label htmlFor="pipeline-company-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.companyName', 'Company')}
            </label>
            <input
              id="pipeline-company-name"
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
            <label htmlFor="pipeline-job-title" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.jobTitle', 'Job Title')}
            </label>
            <input
              id="pipeline-job-title"
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
          <label htmlFor="pipeline-job-url" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.jobUrl', 'Job URL')}
          </label>
          <input
            id="pipeline-job-url"
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
            <label htmlFor="pipeline-location" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.location', 'Location')}
            </label>
            <input
              id="pipeline-location"
              type="text"
              aria-label={t('pipeline.location', 'Location')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('pipeline.notSpecified', 'Not specified')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label htmlFor="pipeline-employment-type" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.employmentType', 'Employment type')}
            </label>
            <input
              id="pipeline-employment-type"
              type="text"
              aria-label={t('pipeline.employmentType', 'Employment type')}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              placeholder={t('pipeline.notSpecified', 'Not specified')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label htmlFor="pipeline-seniority" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.seniority', 'Seniority')}
            </label>
            <input
              id="pipeline-seniority"
              type="text"
              aria-label={t('pipeline.seniority', 'Seniority')}
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              placeholder={t('pipeline.notSpecified', 'Not specified')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label htmlFor="pipeline-sector" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('pipeline.sector', 'Sector')}
            </label>
            <input
              id="pipeline-sector"
              type="text"
              aria-label={t('pipeline.sector', 'Sector')}
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder={t('pipeline.notSpecified', 'Not specified')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="pipeline-status" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.status', 'Status')}
          </label>
          <select
            id="pipeline-status"
            aria-label={t('pipeline.status', 'Status')}
            value={status}
            onChange={(e) => setStatus(e.target.value as JobApplicationStatus)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {(['saved', 'applied', 'offer', 'rejected', 'withdrawn'] as JobApplicationStatus[]).map((value) => (
              <option key={value} value={value} className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                {t(`pipeline.${value}`, value)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pipeline-notes" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('pipeline.notes', 'Notes')}
          </label>
          <textarea
            id="pipeline-notes"
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
          {isSaving
            ? t('common.submitting', 'Sending...')
            : savedApplicationId
              ? t('pipeline.updateSaved', 'Update saved job')
              : t('common.save', 'Save')}
        </GlassButton>
      </div>
    </GlassCard>
  );
}
