import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Download, Trash2, AlertTriangle, CheckCircle2, ShieldCheck, Sun, Moon, Languages, ExternalLink } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { cn } from '@/lib/utils/cn';
import { useExitPresence } from '@/hooks/useExitPresence';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { shouldRender, isExiting } = useExitPresence(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!shouldRender || !user || !mounted) return null;

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      setError(null);
      const { supabase } = await import('../../services/supabase');
      const { data } = await supabase.auth.getSession();

      const token = data.session?.access_token;
      if (!token) throw new Error(t('settings.errors.authToken', 'Could not get an authentication token from the active session.'));

      const response = await fetch('/.netlify/functions/user-data-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'export' }),
      });

      if (!response.ok) {
        let errorData = t('settings.errors.exportFailed', 'Failed to export data.');
        try {
          const json = await response.json();
          errorData = json.error || json.message || errorData;
        } catch { /* ignore */ }
        throw new Error(errorData);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `watheq-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.errors.exportGeneric', 'An error occurred while exporting data.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const { supabase } = await import('../../services/supabase');
      const { data } = await supabase.auth.getSession();

      const token = data.session?.access_token;
      if (!token) throw new Error(t('settings.errors.authToken', 'Could not get an authentication token from the active session.'));

      const response = await fetch('/.netlify/functions/user-data-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', confirmDelete: true }),
      });

      if (!response.ok) {
        let errorData = t('settings.errors.deleteFailed', 'Failed to delete account.');
        try {
          const json = await response.json();
          errorData = json.error || json.message || errorData;
        } catch { /* ignore */ }
        throw new Error(errorData);
      }

      // Success, sign out automatically
      await signOut();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.errors.deleteGeneric', 'An error occurred while deleting account.'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3';

  const modal = (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-4',
        isExiting && 'pointer-events-none'
      )}
      aria-hidden={isExiting || undefined}
      inert={isExiting}
    >
      {/* Calm warm backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-[color:var(--ink)]/35 backdrop-blur-sm duration-200',
          isExiting ? 'animate-out fade-out ease-out' : 'animate-in fade-in'
        )}
        onClick={() => !isDeleting && onClose()}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-lg neu-card shadow-xl rounded-2xl duration-200 ease-out overflow-hidden border border-[color:var(--glass-border)]',
          isExiting ? 'animate-out fade-out zoom-out-95' : 'animate-in fade-in zoom-in-95'
        )}
        dir={i18n.dir()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[color:var(--glass-border)] dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="p-2 neu-inset rounded-lg">
              <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">{t('common.settings', 'Settings')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label={t('common.closeDialog', 'Close dialog')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh] space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Account Details */}
          <div>
            <h3 className={sectionLabel}>{t('settings.accountInformation', 'Account information')}</h3>
            <div className="p-4 neu-inset rounded-xl">
              <p className="text-gray-900 dark:text-white font-medium">{user.email}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('settings.verifiedAccount', 'Verified account')}</span>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <h3 className={sectionLabel}>{t('settings.preferences', 'Preferences')}</h3>
            <div className="space-y-4">
              {/* Language */}
              <div className="p-4 neu-inset rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-white">{t('common.language', 'Language')}</h4>
                </div>
                <LanguageSwitcher />
              </div>

              {/* Theme / appearance */}
              <div className="flex items-center justify-between gap-4 p-4 neu-inset rounded-xl">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{t('settings.appearance', 'Appearance')}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('settings.appearanceDescription', 'Switch between light and dark mode.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-[color:var(--surface-control-hover)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                  aria-label={t('common.toggleTheme', 'Toggle theme')}
                >
                  {theme === 'dark'
                    ? <><Sun className="w-4 h-4 text-emerald-400" />{t('settings.lightMode', 'Light')}</>
                    : <><Moon className="w-4 h-4 text-[#2b8994]" />{t('settings.darkMode', 'Dark')}</>}
                </button>
              </div>
            </div>
          </div>

          {/* Privacy & data */}
          <div>
            <h3 className={sectionLabel}>{t('settings.dataPrivacy', 'Privacy & data')}</h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 p-4 neu-inset rounded-xl sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {t('settings.exportPersonalData', 'Export personal data')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('settings.exportPersonalDataDescription', 'Download a copy of your resumes and optimizations in JSON format.')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting || isDeleting}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isExporting ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? t('dataRights.export.exporting', 'Exporting...') : t('dataRights.export.button', 'Export Data')}
                </button>
              </div>

              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 p-4 neu-inset rounded-xl transition-colors hover:bg-[color:var(--surface-control-hover)] dark:hover:bg-white/5"
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {t('settings.privacyInfoTitle', 'How we handle your data')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('settings.privacyInfoDescription', 'Read what we store, why, and how it is protected.')}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              </a>

              {/* Delete Account danger zone */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50/60 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-xl gap-4">
                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400">
                    {t('dataRights.delete.title', 'Delete Account')}
                  </h4>
                  <p className="text-sm text-red-500/80 dark:text-red-400/80 mt-1">
                    {t('settings.deleteAccountDescription', 'Permanently delete your account and all associated data.')}
                  </p>
                </div>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('dataRights.delete.button', 'Delete Account')}
                  </button>
                ) : (
                  <div className="shrink-0 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                      {t('settings.deleteConfirmQuestion', 'Are you sure?')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-w-[70px]"
                      >
                        {isDeleting ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : t('common.yes', 'Yes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
