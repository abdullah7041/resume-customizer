import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Download, Copy, Check, X } from 'lucide-react';
import { GlassButton } from './GlassButton';
import { analytics } from '../../services/analytics';

interface ShareScoreCardProps {
    beforeScore: number;
    afterScore: number;
    jobTitle?: string;
    onClose: () => void;
}

const WATHEQ_URL = 'https://watheq.sa';

function ShareCardVisual({
    beforeScore,
    afterScore,
    jobTitle,
    isArabic,
}: {
    beforeScore: number;
    afterScore: number;
    jobTitle?: string;
    isArabic: boolean;
}) {
    const improvement = afterScore - beforeScore;

    return (
        <div
            style={{
                width: 1200,
                height: 630,
                padding: 60,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #047857 60%, #059669 100%)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                direction: isArabic ? 'rtl' : 'ltr',
            }}
        >
            {/* Background decorations */}
            <div
                style={{
                    position: 'absolute',
                    top: -100,
                    right: -100,
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: -80,
                    left: -80,
                    width: 300,
                    height: 300,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
                }}
            />

            {/* Top: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                    }}
                >
                    {isArabic ? 'و' : 'W'}
                </div>
                <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>
                    {isArabic ? 'واثق' : 'Watheq'}
                </span>
            </div>

            {/* Middle: Scores */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, position: 'relative', zIndex: 1 }}>
                {/* Before */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, opacity: 0.7, marginBottom: 8 }}>
                        {isArabic ? 'قبل' : 'Before'}
                    </div>
                    <div
                        style={{
                            fontSize: 96,
                            fontWeight: 800,
                            lineHeight: 1,
                            opacity: 0.5,
                        }}
                    >
                        {beforeScore}%
                    </div>
                </div>

                {/* Arrow + improvement */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 48 }}>{isArabic ? '\u2190' : '\u2192'}</div>
                    <div
                        style={{
                            padding: '8px 20px',
                            borderRadius: 30,
                            background: 'rgba(255,255,255,0.2)',
                            fontSize: 24,
                            fontWeight: 700,
                        }}
                    >
                        +{improvement}%
                    </div>
                </div>

                {/* After */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, opacity: 0.7, marginBottom: 8 }}>
                        {isArabic ? 'بعد' : 'After'}
                    </div>
                    <div
                        style={{
                            fontSize: 96,
                            fontWeight: 800,
                            lineHeight: 1,
                        }}
                    >
                        {afterScore}%
                    </div>
                </div>
            </div>

            {/* Bottom: Text + footer */}
            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 22, opacity: 0.9, marginBottom: 8 }}>
                    {isArabic
                        ? `نسبة توافق سيرتي الذاتية ارتفعت من ${beforeScore}% إلى ${afterScore}% عبر واثق 🎯🇸🇦`
                        : `My resume match went from ${beforeScore}% → ${afterScore}% on Watheq 🇸🇦`}
                </div>
                {jobTitle && (
                    <div style={{ fontSize: 18, opacity: 0.6 }}>
                        {isArabic ? `الوظيفة المستهدفة: ${jobTitle}` : `Optimized for: ${jobTitle}`}
                    </div>
                )}
                <div
                    style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: '1px solid rgba(255,255,255,0.2)',
                        fontSize: 16,
                        opacity: 0.5,
                    }}
                >
                    watheq.sa | {isArabic ? 'محسّن سير ذاتية بالذكاء الاصطناعي للسعودية' : 'AI Resume Optimizer for Saudi Arabia'}
                </div>
            </div>
        </div>
    );
}

export function ShareScoreCard({ beforeScore, afterScore, jobTitle, onClose }: ShareScoreCardProps) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const improvement = afterScore - beforeScore;

    const getShareText = useCallback(() => {
        if (isArabic) {
            return `نسبة توافق سيرتي الذاتية ارتفعت من ${beforeScore}% إلى ${afterScore}% بعد التحسين عبر واثق 🎯🇸🇦 محسّن سير ذاتية بالذكاء الاصطناعي مصمم لسوق العمل السعودي → ${WATHEQ_URL}`;
        }
        return `My resume match score went from ${beforeScore}% → ${afterScore}% after optimizing with Watheq 🎯 Free AI resume optimizer built for the Saudi job market → ${WATHEQ_URL}`;
    }, [isArabic, beforeScore, afterScore]);

    const handleDownloadPNG = useCallback(async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(cardRef.current, {
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                width: 1200,
                height: 630,
            });

            const link = document.createElement('a');
            link.download = `watheq-score-${beforeScore}-to-${afterScore}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            analytics.track('share_card_downloaded', {
                before_score: beforeScore,
                after_score: afterScore,
                improvement,
            });
        } catch (err) {
            console.error('[ShareScoreCard] PNG generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    }, [beforeScore, afterScore, improvement]);

    const handleCopyText = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(getShareText());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            analytics.track('share_text_copied', {
                before_score: beforeScore,
                after_score: afterScore,
                improvement,
            });
        } catch {
            console.error('[ShareScoreCard] Clipboard copy failed');
        }
    }, [getShareText, beforeScore, afterScore, improvement]);

    const handleNativeShare = useCallback(async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: isArabic ? 'نتيجتي على واثق' : 'My Watheq Result',
                text: getShareText(),
                url: WATHEQ_URL,
            });
            analytics.track('share_native_used', {
                before_score: beforeScore,
                after_score: afterScore,
                improvement,
            });
        } catch {
            // User cancelled share — not an error
        }
    }, [isArabic, getShareText, beforeScore, afterScore, improvement]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="relative max-w-[min(95vw,700px)] w-full bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Card preview (scaled down to fit) */}
                <div className="p-4 overflow-hidden">
                    <div
                        style={{
                            transform: 'scale(0.5)',
                            transformOrigin: 'top left',
                            width: 1200,
                            height: 630,
                        }}
                    >
                        <div ref={cardRef}>
                            <ShareCardVisual
                                beforeScore={beforeScore}
                                afterScore={afterScore}
                                jobTitle={jobTitle}
                                isArabic={isArabic}
                            />
                        </div>
                    </div>
                </div>

                {/* Scaled container height fix */}
                <div style={{ marginTop: -315 }} />

                {/* Actions */}
                <div className="p-4 pt-0 flex flex-wrap gap-3 justify-center">
                    {typeof navigator.share === 'function' && (
                        <GlassButton
                            variant="primary"
                            size="md"
                            onClick={handleNativeShare}
                            leftIcon={<Share2 className="w-4 h-4" />}
                        >
                            {isArabic ? 'مشاركة' : 'Share'}
                        </GlassButton>
                    )}

                    <GlassButton
                        variant="secondary"
                        size="md"
                        onClick={handleDownloadPNG}
                        disabled={isGenerating}
                        leftIcon={<Download className="w-4 h-4" />}
                    >
                        {isGenerating
                            ? (isArabic ? 'جارٍ التحميل...' : 'Generating...')
                            : (isArabic ? 'تحميل PNG' : 'Download PNG')
                        }
                    </GlassButton>

                    <GlassButton
                        variant="secondary"
                        size="md"
                        onClick={handleCopyText}
                        leftIcon={copied
                            ? <Check className="w-4 h-4 text-emerald-400" />
                            : <Copy className="w-4 h-4" />
                        }
                    >
                        {copied
                            ? (isArabic ? 'تم النسخ!' : 'Copied!')
                            : (isArabic ? 'نسخ النص' : 'Copy Text')
                        }
                    </GlassButton>
                </div>
            </div>
        </div>
    );
}

export default ShareScoreCard;
