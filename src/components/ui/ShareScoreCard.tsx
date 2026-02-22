import { useRef, useState, useCallback, useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
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

const WATHEQ_URL = 'https://watheqai.app';

/**
 * Hidden off-screen 1200x630 card rendered for html2canvas capture only.
 * Positioned outside viewport so it gets full layout without being visible.
 */
function HiddenCanvasCard({
    cardRef,
    beforeScore,
    afterScore,
    jobTitle,
    isArabic,
}: {
    cardRef: RefObject<HTMLDivElement | null>;
    beforeScore: number;
    afterScore: number;
    jobTitle?: string;
    isArabic: boolean;
}) {
    const improvement = afterScore - beforeScore;

    return (
        <div
            style={{
                position: 'fixed',
                left: -9999,
                top: 0,
                zIndex: -1,
                pointerEvents: 'none',
            }}
            aria-hidden="true"
        >
            <div
                ref={cardRef}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60, position: 'relative', zIndex: 1 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, opacity: 0.7, marginBottom: 12 }}>
                            {isArabic ? 'قبل' : 'Before'}
                        </div>
                        <div style={{ fontSize: 100, fontWeight: 800, lineHeight: 1, opacity: 0.5 }}>
                            {beforeScore}<span style={{ fontSize: 60 }}>%</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 52 }}>{isArabic ? '\u2190' : '\u2192'}</div>
                        <div
                            style={{
                                padding: '10px 28px',
                                borderRadius: 30,
                                background: 'rgba(255,255,255,0.2)',
                                fontSize: 28,
                                fontWeight: 700,
                            }}
                        >
                            +{improvement}%
                        </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 20, opacity: 0.7, marginBottom: 12 }}>
                            {isArabic ? 'بعد' : 'After'}
                        </div>
                        <div style={{ fontSize: 100, fontWeight: 800, lineHeight: 1 }}>
                            {afterScore}<span style={{ fontSize: 60 }}>%</span>
                        </div>
                    </div>
                </div>

                {/* Bottom: Text + footer */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 24, opacity: 0.9, marginBottom: 8 }}>
                        {isArabic
                            ? `نسبة توافق سيرتي الذاتية ارتفعت من ${beforeScore}% إلى ${afterScore}% عبر واثق 🎯🇸🇦`
                            : `My resume match went from ${beforeScore}% → ${afterScore}% on Watheq 🇸🇦`}
                    </div>
                    {jobTitle && (
                        <div style={{ fontSize: 20, opacity: 0.6 }}>
                            {isArabic ? `الوظيفة المستهدفة: ${jobTitle}` : `Optimized for: ${jobTitle}`}
                        </div>
                    )}
                    <div
                        style={{
                            marginTop: 20,
                            paddingTop: 20,
                            borderTop: '1px solid rgba(255,255,255,0.2)',
                            fontSize: 18,
                            opacity: 0.5,
                        }}
                    >
                        watheqai.app | {isArabic ? 'محسّن سير ذاتية بالذكاء الاصطناعي للسعودية' : 'AI Resume Optimizer for Saudi Arabia'}
                    </div>
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

    // Lock body scroll when modal is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

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
                scale: 2,
                useCORS: true,
                backgroundColor: null,
                width: 1200,
                height: 630,
                windowWidth: 1200,
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

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-orange-400';
    };

    const modal = (
        <>
            {/* Hidden off-screen card for PNG capture */}
            <HiddenCanvasCard
                cardRef={cardRef}
                beforeScore={beforeScore}
                afterScore={afterScore}
                jobTitle={jobTitle}
                isArabic={isArabic}
            />

            {/* Modal overlay */}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="relative w-[min(90vw,420px)] bg-[#0a0a0a]/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Responsive preview card (not the canvas source) */}
                    <div className="m-4 mb-3 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-600 relative">
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

                        <div className="p-5 relative" dir={isArabic ? 'rtl' : 'ltr'}>
                            {/* Logo */}
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-sm font-bold text-white">
                                    {isArabic ? 'و' : 'W'}
                                </div>
                                <span className="text-lg font-bold text-white tracking-wide">
                                    {isArabic ? 'واثق' : 'Watheq'}
                                </span>
                            </div>

                            {/* Score comparison */}
                            <div className="flex items-center justify-center gap-4 mb-5">
                                {/* Before */}
                                <div className="text-center">
                                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                                        {isArabic ? 'قبل' : 'Before'}
                                    </div>
                                    <div className="text-4xl font-extrabold text-white/40 tabular-nums">
                                        {beforeScore}<span className="text-xl">%</span>
                                    </div>
                                </div>

                                {/* Arrow + improvement */}
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className="text-2xl text-white/60">{isArabic ? '←' : '→'}</div>
                                    <div className="px-3 py-1 rounded-full bg-white/20 text-sm font-bold text-white">
                                        +{improvement}%
                                    </div>
                                </div>

                                {/* After */}
                                <div className="text-center">
                                    <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">
                                        {isArabic ? 'بعد' : 'After'}
                                    </div>
                                    <div className={`text-4xl font-extrabold tabular-nums ${getScoreColor(afterScore)}`}>
                                        {afterScore}<span className="text-xl">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Share text */}
                            <p className="text-xs text-white/70 leading-relaxed mb-3">
                                {isArabic
                                    ? `نسبة توافق سيرتي الذاتية ارتفعت من ${beforeScore}% إلى ${afterScore}% عبر واثق 🎯🇸🇦`
                                    : `My resume match went from ${beforeScore}% → ${afterScore}% on Watheq 🇸🇦`}
                            </p>

                            {/* Footer */}
                            <div className="pt-3 border-t border-white/10 text-[10px] text-white/30">
                                watheqai.app | {isArabic ? 'محسّن سير ذاتية بالذكاء الاصطناعي' : 'AI Resume Optimizer for Saudi Arabia'}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex flex-col gap-2">
                        {typeof navigator.share === 'function' && (
                            <GlassButton
                                variant="primary"
                                size="md"
                                onClick={handleNativeShare}
                                leftIcon={<Share2 className="w-4 h-4" />}
                                className="w-full justify-center"
                            >
                                {isArabic ? 'مشاركة' : 'Share'}
                            </GlassButton>
                        )}

                        <div className="flex gap-2">
                            <GlassButton
                                variant="secondary"
                                size="sm"
                                onClick={handleDownloadPNG}
                                disabled={isGenerating}
                                leftIcon={<Download className="w-3.5 h-3.5" />}
                                className="flex-1 justify-center"
                            >
                                {isGenerating
                                    ? (isArabic ? 'جارٍ...' : 'Saving...')
                                    : (isArabic ? 'تحميل PNG' : 'Save PNG')
                                }
                            </GlassButton>

                            <GlassButton
                                variant="secondary"
                                size="sm"
                                onClick={handleCopyText}
                                leftIcon={copied
                                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    : <Copy className="w-3.5 h-3.5" />
                                }
                                className="flex-1 justify-center"
                            >
                                {copied
                                    ? (isArabic ? 'تم النسخ!' : 'Copied!')
                                    : (isArabic ? 'نسخ النص' : 'Copy Text')
                                }
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modal, document.body);
}

export default ShareScoreCard;
