/**
 * ReferralLink Component
 *
 * Displays user's unique referral link with:
 * - Copy to clipboard functionality
 * - WhatsApp sharing
 * - Twitter/X sharing
 */

import { useState, useEffect } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { glass } from '../../lib/styles/glass';
import { cn } from '../../lib/utils/cn';
import { useTranslation } from 'react-i18next';
import { GlassButton } from '../ui/GlassButton';

interface ReferralLinkProps {
  className?: string;
}

export function ReferralLink({ className }: ReferralLinkProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [referralUrl, setReferralUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchReferralLink() {
      try {
        const response = await fetch(`/.netlify/functions/referral-api?action=get-link&user_id=${user.id}`);
        const data = await response.json();

        if (data.success && data.referralUrl) {
          setReferralUrl(data.referralUrl);
        } else {
          console.error('[ReferralLink] API returned error:', data);
          setError(data.error || 'Failed to generate referral link');
        }
      } catch (error) {
        console.error('[ReferralLink] Failed to fetch referral link:', error);
        setError(error instanceof Error ? error.message : 'Network error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReferralLink();
  }, [user]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ReferralLink] Failed to copy:', error);
    }
  };

  const handleWhatsAppShare = () => {
    if (!referralUrl) {
      console.error('[ReferralLink] Cannot share - referralUrl is empty');
      return;
    }
    const isArabic = i18n.language === 'ar';
    const message = isArabic
      ? `جرّب واثق - أداة AI لتحسين السيرة الذاتية!\n\n${referralUrl}`
      : `Try Watheq - AI Resume Optimizer!\n\n${referralUrl}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    if (!referralUrl) {
      console.error('[ReferralLink] Cannot share - referralUrl is empty');
      return;
    }
    const isArabic = i18n.language === 'ar';
    const message = isArabic
      ? `جرّب واثق - أداة AI سعودية لتحسين السيرة الذاتية ومطابقتها مع رؤية 2030!\n\n${referralUrl}\n\n#رؤية_2030 #واثق`
      : `Try Watheq - Saudi AI Resume Optimizer aligned with Vision 2030!\n\n${referralUrl}\n\n#Vision2030 #Watheq`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const handleLinkedInShare = () => {
    if (!referralUrl) {
      console.error('[ReferralLink] Cannot share - referralUrl is empty');
      return;
    }

    // LinkedIn only accepts URL parameter (no custom text in share dialog)
    // Note: Unlike WhatsApp/X, LinkedIn pulls title/summary from page meta tags
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`;

    window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className={cn(glass.card, 'p-4 animate-pulse', className)}>
        <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-10 bg-white/10 rounded" />
      </div>
    );
  }

  if (!referralUrl) {
    return (
      <div className={cn(glass.card, 'p-4 text-center space-y-2', className)}>
        <p className="text-sm text-gray-400">
          {t('referrals.linkUnavailable')}
        </p>
        {error && (
          <p className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn(glass.card, 'p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-emerald-400" />
        <h4 className="text-sm font-semibold text-white">
          {t('referrals.yourLink')}
        </h4>
      </div>

      {/* Link display with copy button */}
      <div className="flex items-center gap-2">
        <div className={cn(glass.badge.neutral, 'flex-1 px-3 py-2 rounded-lg')}>
          <p className="text-sm text-gray-300 truncate font-mono">
            {referralUrl}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={cn(
            glass.badge.neutral,
            'p-2 rounded-lg transition-all hover:bg-white/10',
            copied && 'bg-emerald-500/20 border-emerald-500/50'
          )}
          aria-label={copied ? t('common.copied') : t('common.copy')}
        >
          {copied ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <Copy className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Share buttons */}
      <div className="grid grid-cols-3 gap-2">
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={handleWhatsAppShare}
          className="flex-1"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </GlassButton>
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={handleTwitterShare}
          className="flex-1"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {i18n.language === 'ar' ? 'إكس' : 'X'}
        </GlassButton>
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={handleLinkedInShare}
          className="flex-1"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          {t('referrals.shareLinkedIn', 'LinkedIn')}
        </GlassButton>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-400 text-center">
        {t('referrals.shareInfo')}
      </p>
    </div>
  );
}
