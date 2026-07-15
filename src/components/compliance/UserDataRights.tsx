import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useExitPresence } from '@/hooks/useExitPresence';

interface UserDataRightsProps {
  userId: string;
  onExportData: () => Promise<Blob>;
  onDeleteAccount: () => Promise<void>;
}

export function UserDataRights({ onExportData, onDeleteAccount }: UserDataRightsProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const deleteConfirmPresence = useExitPresence(showDeleteConfirm);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await onExportData();
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      window.location.href = '/';
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl shadow-lg p-6 border border-line">
      <h2 className="text-xl font-semibold text-ink mb-6">
        {t('dataRights.title')}
      </h2>

      {/* Export Data */}
      <div className="border-b border-line pb-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-ink">{t('dataRights.export.title')}</h3>
            <p className="text-sm text-ink-muted mt-1">{t('dataRights.export.description')}</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <span className="animate-spin">...</span>
            ) : exportSuccess ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? t('dataRights.export.exporting') : t('dataRights.export.button')}
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium text-ink">{t('dataRights.delete.title')}</h3>
            <p className="text-sm text-ink-muted mt-1">{t('dataRights.delete.description')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('dataRights.delete.button')}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmPresence.shouldRender && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center bg-black/50 duration-200',
            deleteConfirmPresence.isExiting
              ? 'pointer-events-none animate-out fade-out ease-out'
              : 'animate-in fade-in'
          )}
          aria-hidden={deleteConfirmPresence.isExiting || undefined}
          inert={deleteConfirmPresence.isExiting}
        >
          <div
            className={cn(
              'bg-surface rounded-2xl p-6 max-w-md mx-4 border border-line duration-200 ease-out',
              deleteConfirmPresence.isExiting
                ? 'animate-out fade-out zoom-out-95'
                : 'animate-in fade-in zoom-in-95'
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h3 className="text-lg font-semibold text-ink">
                {t('dataRights.delete.confirm.title')}
              </h3>
            </div>
            <p className="text-ink-muted mb-6">
              {t('dataRights.delete.confirm.message')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-ink/5 text-ink rounded-lg hover:bg-ink/10 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? t('dataRights.delete.deleting') : t('dataRights.delete.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




