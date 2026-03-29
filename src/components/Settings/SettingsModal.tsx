import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Settings, Download, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils/cn';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !user || !mounted) return null;

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const { supabase } = await import('../../services/supabase');
      const { data } = await supabase.auth.getSession();

      const token = data.session?.access_token;
      if (!token) throw new Error('Could not get authentication token from active session.');

      const response = await fetch('/.netlify/functions/user-data-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', confirmDelete: true }),
      });

      if (!response.ok) {
        let errorData = 'Failed to delete account';
        try {
           const json = await response.json();
           errorData = json.error || json.message || errorData;
        } catch(e) { /* ignore */ }
        throw new Error(errorData);
      }

      // Success, sign out automatically
      await signOut();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting account.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleExportClick = async () => {
    try {
      setIsExporting(true);
      setError(null);
      const { supabase } = await import('../../services/supabase');
      const { data } = await supabase.auth.getSession();

      const token = data.session?.access_token;
      if (!token) throw new Error('Could not get authentication token from active session.');

      const response = await fetch('/.netlify/functions/user-data-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'export' }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watheq-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      setError(err.message || 'An error occurred while exporting data.');
    } finally {
      setIsExporting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={() => !isDeleting && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg neu-card shadow-2xl rounded-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="p-2 neu-inset rounded-lg">
              <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Account Details */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Account Information</h3>
            <div className="p-4 neu-inset rounded-xl">
              <p className="text-gray-900 dark:text-white font-medium">{user.email}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified Account</span>
              </div>
            </div>
          </div>

          {/* Data Actions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Data & Privacy</h3>
            
            <div className="space-y-4">
              {/* Export Data */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 neu-inset rounded-xl gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Export Personal Data</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download a copy of your resumes and optimizations in JSON format.</p>
                </div>
                <button
                  onClick={handleExportClick}
                  disabled={isExporting || isDeleting}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isExporting ? (
                    <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </button>
              </div>

              {/* Delete Account */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-xl gap-4">
                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400">Delete Account</h4>
                  <p className="text-sm text-red-500/80 dark:text-red-400/80 mt-1">Permanently delete your account and all associated data.</p>
                </div>
                
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isExporting || isDeleting}
                    className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </button>
                ) : (
                  <div className="shrink-0 flex flex-col gap-2">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center">Are you sure?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-w-[70px]"
                      >
                        {isDeleting ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : 'Yes'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        Cancel
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
