# Watheq i18n Glossary

This glossary preserves existing Arabic wording from the app. Use these terms consistently when translating new keys.

| English | Arabic | Context |
|---|---|---|
| resume | السيرة الذاتية | General UI, uploads, parsing |
| ATS | نظام تتبع المتقدمين ATS | First mention in a flow; short labels may use ATS |
| job match | مطابقة الوظيفة | Match analysis, scores |
| optimization | التحسين | AI rewrite suggestions |
| credits | الرصيد / الأرصدة | Credit system |
| waitlist | قائمة الانتظار | Pro plan waitlist |
| application | طلب التقديم | Job application context |
| cover letter | خطاب التقديم | Cover letter generator |
| interview prep | التحضير للمقابلة | Interview preparation feature |
| Vision 2030 | رؤية 2030 | Saudi national priorities |
| template | القالب | Resume template selection |
| keyword | الكلمة المفتاحية | Keyword analysis feature |
| export | تصدير / تحميل | PDF export (both used) |
| upload | رفع | Resume upload |
| dashboard | لوحة التحكم | User dashboard |
| settings | الإعدادات | Account/settings modal |
| feedback | الملاحظات | User feedback modal |
| account | الحساب | Auth, settings |
| sign in | دخول | Authentication |
| sign out | خروج | Authentication |
| save | حفظ | General action |
| cancel | إلغاء | General action |
| delete | حذف | General action |
| retry | إعادة المحاولة | Error states |
| loading | يحمّل... | Loading states |

## Tone Notes

- Use formal but clear Saudi-friendly SaaS Arabic (not overly academic, not overly casual).
- Keep heavy dialect out of core product, auth, privacy, legal, pricing, credits, analysis, ATS, and export flows. Light Saudi warmth is acceptable only in helper/assistant microcopy.
- Preserve all interpolation variables exactly as `{{variableName}}`.
- Preserve HTML tags (`<strong>`, `<em>`) when present in English.
