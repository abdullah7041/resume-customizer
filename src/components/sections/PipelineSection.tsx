import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Trash2, Loader2, MessageSquare, ChevronDown, Clock } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { useAuth } from '../../hooks/useAuth';
import { analytics } from '../../services/analytics';
import {
  listJobApplications,
  updateJobApplication,
  deleteJobApplication,
} from '../../services/pipeline';
import type { JobApplication, JobApplicationStatus } from '../../types/pipeline';

const STATUS_OPTIONS: JobApplicationStatus[] = [
  'saved',
  'applied',
  'offer',
  'rejected',
  'withdrawn',
];

function formatDate(dateString: string, locale: string) {
  try {
    return new Date(dateString).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function isOlderThanDays(dateString: string, days: number) {
  const date = new Date(dateString);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date < cutoff;
}

export function PipelineSection() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const locale = i18n.language;

  const loadJobs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    const { data, error: loadError } = await listJobApplications();
    setIsLoading(false);
    if (loadError) {
      setError(loadError);
      return;
    }
    setJobs(data);
  }, [user]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const appliedJobsNeedingUpdate = useMemo(() => {
    return jobs.filter((j) => j.status === 'applied' && isOlderThanDays(j.updated_at || j.applied_at || j.created_at, 7));
  }, [jobs]);

  const handleStatusChange = async (job: JobApplication, newStatus: JobApplicationStatus) => {
    setUpdatingStatusId(job.id);
    analytics.trackPipelineStatusUpdated(newStatus);
    const { data, error: updateError } = await updateJobApplication(job.id, { status: newStatus });
    setUpdatingStatusId(null);
    if (updateError || !data) {
      setError(t('pipeline.updateFailed', 'Failed to update job'));
      return;
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? data : j)));
  };

  const handleUpdateNotes = async (job: JobApplication) => {
    const { data, error: updateError } = await updateJobApplication(job.id, { notes: notesDraft });
    if (updateError || !data) {
      setError(t('pipeline.updateFailed', 'Failed to update job'));
      return;
    }
    setJobs((prev) => prev.map((j) => (j.id === job.id ? data : j)));
    setEditingNotesId(null);
  };

  const handleDelete = async (id: string) => {
    const { error: deleteError } = await deleteJobApplication(id);
    if (deleteError) {
      setError(t('pipeline.deleteFailed', 'Failed to delete job'));
      return;
    }
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeleteConfirmId(null);
  };

  const handleQuickUpdate = async (job: JobApplication, newStatus: JobApplicationStatus) => {
    await handleStatusChange(job, newStatus);
  };

  if (!user) {
    return (
      <GlassCard className="flex flex-col items-center justify-center py-12">
        <Briefcase className="w-10 h-10 text-gray-400 mb-4" />
        <p className="text-sm text-gray-500 text-center">
          {t('pipeline.signInToSave', 'Sign in to save this job')}
        </p>
      </GlassCard>
    );
  }

  if (isLoading) {
    return (
      <GlassCard className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {appliedJobsNeedingUpdate.length > 0 && (
        <GlassCard className="bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {t('pipeline.anyUpdatePrompt', 'Any update?')}
            </h4>
          </div>
          <div className="space-y-2">
            {appliedJobsNeedingUpdate.slice(0, 3).map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {job.company_name || t('pipeline.unknownCompany', 'Unknown company')} — {job.job_title || t('pipeline.untitledRole', 'Untitled role')}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleQuickUpdate(job, 'rejected')}
                    className="px-2 py-1 rounded-md text-xs bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition-colors"
                  >
                    {t('pipeline.updateToRejected', 'Rejected')}
                  </button>
                  <button
                    onClick={() => handleQuickUpdate(job, 'offer')}
                    className="px-2 py-1 rounded-md text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    {t('pipeline.updateToOffer', 'Offer')}
                  </button>
                  <button
                    onClick={() => handleQuickUpdate(job, 'withdrawn')}
                    className="px-2 py-1 rounded-md text-xs bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                  >
                    {t('pipeline.updateToWithdrawn', 'Withdrawn')}
                  </button>
                  <button
                    onClick={() => handleQuickUpdate(job, 'applied')}
                    className="px-2 py-1 rounded-md text-xs bg-gray-500/10 text-gray-600 dark:text-gray-300 hover:bg-gray-500/20 transition-colors"
                  >
                    {t('pipeline.noUpdate', 'No update')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {jobs.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-12">
          <Briefcase className="w-10 h-10 text-gray-400 mb-4" />
          <p className="text-sm text-gray-500 text-center max-w-xs">
            {t('pipeline.emptyState', 'No jobs saved yet. Run a match analysis and save jobs to track your applications.')}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <GlassCard key={job.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {job.company_name || t('pipeline.unknownCompany', 'Unknown company')}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">
                    {job.job_title || t('pipeline.untitledRole', 'Untitled role')}
                  </p>
                  {job.match_score != null && (
                    <p className="text-xs text-emerald-500 mt-1">
                      {t('pipeline.matchScore', 'Match Score')}: {job.match_score}%
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job, e.target.value as JobApplicationStatus)}
                      disabled={updatingStatusId === job.id}
                      className="appearance-none bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {t("pipeline." + s, s)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>

                  <button
                    onClick={() => {
                      setEditingNotesId(job.id);
                      setNotesDraft(job.notes || '');
                    }}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                    title={t('pipeline.editNotes', 'Edit notes')}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(job.id)}
                    className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-rose-600 transition-colors"
                    title={t('pipeline.deleteJob', 'Delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {editingNotesId === job.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder={t('pipeline.addNotes', 'Add notes...')}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <GlassButton variant="secondary" size="sm" onClick={() => handleUpdateNotes(job)}>
                      {t('common.save', 'Save')}
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" onClick={() => setEditingNotesId(null)}>
                      {t('common.cancel', 'Cancel')}
                    </GlassButton>
                  </div>
                </div>
              )}

              {job.notes && editingNotesId !== job.id && (
                <p className="mt-2 text-xs text-gray-500 italic">{job.notes}</p>
              )}

              <p className="mt-2 text-[10px] text-gray-400">
                {t('common.updated', 'Updated')}: {formatDate(job.updated_at, locale)}
              </p>

              {deleteConfirmId === job.id && (
                <div className="mt-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                  <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">
                    {t('pipeline.confirmDelete', 'Delete this job?')}
                  </p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                    {t('pipeline.confirmDeleteDesc', 'This will remove the job from your pipeline. This action cannot be undone.')}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <GlassButton variant="primary" size="sm" className="bg-rose-500 hover:bg-rose-600 text-white" onClick={() => handleDelete(job.id)}>
                      {t('common.delete', 'Delete')}
                    </GlassButton>
                    <GlassButton variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>
                      {t('common.cancel', 'Cancel')}
                    </GlassButton>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}


