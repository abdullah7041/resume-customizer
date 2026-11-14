import { withinAgeWindow } from '../../src/lib/jobs/age.js';
import { dropReason } from '../../src/lib/jobs/filters.js';
import type { FeedIntent, FeedPosting } from '../../src/lib/jobs/types.js';

export function selectAlertPostings(postings: FeedPosting[], intent: FeedIntent, excluded: Set<string>, now = Date.now()) {
  if (!intent.targetRoles.some(role => role.trim())) return [];
  return postings.filter(posting => !excluded.has(posting.id) && withinAgeWindow(posting, 1, now)
    && !dropReason(posting, intent) && /^https?:\/\//i.test(posting.applyUrl))
    .sort((a, b) => (b.postedAt ?? '').localeCompare(a.postedAt ?? ''));
}
export function canRetryDelivery(createdAt: string, now = Date.now()) {
  const age = now - Date.parse(createdAt);
  return age >= 0 && age < 24 * 3600000;
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
export function renderJobAlert(postings: FeedPosting[], language: 'ar' | 'en', origin: string, token: string) {
  const ar = language === 'ar';
  const subject = ar ? 'وظائف جديدة تناسب تفضيلاتك — واثق' : 'New jobs matching your preferences — Watheq';
  const intro = ar ? 'وظائف منشورة خلال آخر 24 ساعة تناسب تفضيلات البحث المحفوظة. البحث والتنبيهات مجانية.' : 'Jobs published within the past 24 hours matching your saved search preferences. Search and alerts are free.';
  const settings = `${origin}/?tab=job-feed`;
  const unsubscribe = `${origin}/.netlify/functions/job-alert-unsubscribe?token=${encodeURIComponent(token)}`;
  return {
    subject,
    html: `<div lang="${language}" dir="${ar ? 'rtl' : 'ltr'}"><h1>${escape(subject)}</h1><p>${escape(intro)}</p>${postings.map(p => `<p><a href="${escape(p.applyUrl)}">${escape(p.title)}</a><br>${escape(p.companyName)} · ${escape(p.location)}<br>${escape(p.postedAt ?? '')}</p>`).join('')}<p><a href="${settings}">${ar ? 'إعدادات التنبيهات' : 'Alert settings'}</a> · <a href="${unsubscribe}">${ar ? 'إلغاء الاشتراك' : 'Unsubscribe'}</a></p></div>`,
    text: `${subject}\n${intro}\n\n${postings.map(p => `${p.title} · ${p.companyName} · ${p.location} · ${p.postedAt}\n${p.applyUrl}`).join('\n\n')}\n\n${settings}\n${unsubscribe}`,
  };
}
