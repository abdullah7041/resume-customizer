# Saudi Arabic Localization Guide

## Tone

Watheq Arabic should feel native to Saudi job seekers while staying professional, concise, and trustworthy. Use clear Modern Standard Arabic as the baseline, with light Saudi warmth only in assistant/helper moments.

- Core product, auth, pricing, credits, privacy, legal, analysis, ATS, and export copy: formal, direct, and calm.
- Helper and assistant microcopy: slightly warmer, but not heavy dialect.
- Buttons: short, action-first, and easy to scan.
- Errors: explain what happened and what to do next without technical detail.

## Glossary

| English | Preferred Arabic |
|---|---|
| resume | السيرة الذاتية |
| upload resume | ارفع سيرتك الذاتية |
| analyze | حلّل السيرة |
| optimize | حسّن السيرة / حسّن النسخة |
| job match | مطابقة الوظيفة |
| credits | الرصيد / الأرصدة |
| credit unit | رصيد |
| ATS | نظام تتبع المتقدمين ATS |
| template | القالب |
| export | تصدير / تحميل |
| cover letter | خطاب التقديم |
| interview prep | التحضير للمقابلة |
| Vision 2030 | رؤية 2030 |
| pipeline | المسار |

Use “نظام تتبع المتقدمين ATS” on the first mention in a flow when space allows. Short labels can use “ATS” after that.

## Do / Do Not

| Do | Do not |
|---|---|
| ارفع سيرتك الذاتية | قم برفع السيرة الذاتية |
| ابدأ الآن | يلا ابدأ ببلاش |
| حلّل السيرة | شغّل التحليل |
| حسّن السيرة | قم بتحسين السيرة الذاتية |
| جرّب مرة ثانية | ما زبط |
| الرصيد غير كافٍ | ما عندك نقاط كفاية |
| سجل دخولك لحفظ تقدمك | سجّل دخول عشان تحفظ شغلك |

Avoid heavy dialect such as “وش تبي نسوي؟”, “ما زبط”, “لسه”, “هذي”, “بهالنسخة”, “يبي لك شدة حيل”, and regional expressions from other dialects. Avoid literal English translations and long button labels.

## Flow Tone Levels

- Landing: confident, product-led, Saudi-market aware. Warm but not casual.
- Header/nav: compact and neutral.
- Auth/sign-in gating: formal and precise about account-backed actions.
- Upload/paste: reassuring and action-first.
- Resume analysis, optimization, ATS, export/templates: professional and evidence-based.
- Clarification modal: friendly and concise; light warmth is acceptable.
- Pricing/credits/payment intent: formal, transparent, and careful.
- Errors/toasts: clear recovery action; no raw technical errors.
- Pipeline/workspace: practical and calm.
- HR Super Saud/helper copy: can use light warmth, but keep it career-appropriate.

## QA Checklist

- Arabic and English locale keys are aligned with `npm run i18n:validate`.
- Buttons stay short and do not overflow at mobile widths.
- RTL tabs, mobile menu, upload/paste, credit modal, clarification modal, templates/export, pipeline, and toasts remain usable.
- No trust-sensitive flow uses heavy dialect.
- No primary Arabic UX uses Egyptian or Levantine wording.
- No hardcoded visible English appears in Arabic mode for priority flows.
- Interpolation variables and HTML tags are preserved exactly.
