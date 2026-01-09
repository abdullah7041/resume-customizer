import { ReactNode, useState, useEffect, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { GlassButton } from './ui/GlassButton';
import { cn } from '../lib/utils/cn';

interface AuthGateProps {
  children: ReactNode;
}

// Beta access codes - could be moved to env vars or backend in future
const VALID_CODES = ['LAUNCH2025', 'BETA2025', 'WATHEQ2025'];
const STORAGE_KEY = 'watheq:beta_access';

/**
 * AuthGate component for beta access control.
 * Shows a code entry screen until a valid beta code is entered.
 * Stores the valid code in localStorage for persistence.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = checking
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Check localStorage for existing valid code on mount
  useEffect(() => {
    const storedCode = localStorage.getItem(STORAGE_KEY);
    if (storedCode && VALID_CODES.includes(storedCode.toUpperCase())) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedCode = code.trim().toUpperCase();
    if (VALID_CODES.includes(trimmedCode)) {
      localStorage.setItem(STORAGE_KEY, trimmedCode);
      setShowSuccess(true);
      // Small delay to show success state before revealing app
      setTimeout(() => {
        setIsAuthorized(true);
      }, 800);
    } else {
      setError(t('beta.invalidCode', 'Invalid access code. Please try again.'));
      // Shake animation trigger
      const input = document.getElementById('beta-code-input');
      input?.classList.add('animate-shake');
      setTimeout(() => input?.classList.remove('animate-shake'), 500);
    }
  }, [code, t]);

  // Still checking localStorage
  if (isAuthorized === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-[rgba(11,107,58,0.92)] via-[rgba(20,99,86,0.95)] to-[rgba(12,83,53,0.97)]">
        <div className="animate-pulse text-white/50">
          <Lock className="w-8 h-8" />
        </div>
      </div>
    );
  }

  // Authorized - render children
  if (isAuthorized) {
    return <>{children}</>;
  }

  // Not authorized - show code entry
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[rgba(11,107,58,0.92)] via-[rgba(20,99,86,0.95)] to-[rgba(12,83,53,0.97)]">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl mb-4">
          <KeyRound className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">Watheq</h1>
        <p className="text-gray-400 text-sm">
          {isArabic ? 'سير ذاتية واثقة للمهن السعودية' : 'Confident Resumes for Saudi Careers'}
        </p>
      </div>

      <GlassCard variant="elevated" className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            {t('beta.title', 'Early Access')}
          </h2>
          <p className="text-gray-400 text-sm">
            {t('beta.subtitle', 'Enter your beta access code to continue')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              id="beta-code-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(''); // Clear error on change
              }}
              placeholder={t('beta.placeholder', 'Enter access code')}
              autoComplete="off"
              autoFocus
              className={cn(
                'w-full px-4 py-3 rounded-xl',
                'bg-white/5 border border-white/10',
                'text-white text-center font-mono text-lg tracking-widest uppercase',
                'placeholder-gray-500',
                'focus:outline-none focus:border-emerald-500/50 focus:bg-white/10',
                'transition-all',
                error && 'border-red-500/50 bg-red-500/5',
                showSuccess && 'border-emerald-500/50 bg-emerald-500/10'
              )}
              disabled={showSuccess}
            />
            {showSuccess && (
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {showSuccess && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('beta.welcome', 'Welcome to the Beta!')}</span>
            </div>
          )}

          <GlassButton
            type="submit"
            className="w-full"
            disabled={!code.trim() || showSuccess}
            isLoading={showSuccess}
          >
            <Lock className="w-4 h-4 me-2" />
            {t('beta.submit', 'Continue')}
          </GlassButton>
        </form>

        {/* Help text */}
        <p className="mt-6 text-center text-xs text-gray-500">
          {isArabic
            ? 'ليس لديك رمز وصول؟ تواصل معنا للحصول على وصول مبكر.'
            : "Don't have a code? Contact us for early access."
          }
        </p>
      </GlassCard>

      {/* Footer */}
      <p className="mt-8 text-gray-500 text-xs">
        &copy; {new Date().getFullYear()} Watheq. All rights reserved.
      </p>
    </div>
  );
}

export default AuthGate;
