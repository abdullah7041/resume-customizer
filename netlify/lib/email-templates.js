/**
 * Email Templates for Watheq
 * Includes HTML and plain text versions for:
 * - Credits Refreshed notification
 * - Monthly Usage Summary
 *
 * Supports: Arabic (RTL) + English (LTR) languages
 * Brand Colors: Saudi Green (#006C35), Warm Gold (#DAA520)
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const emailTemplates = {
  creditsRefreshed: {
    en: {
      subject: '✨ Your Watheq Credits Have Been Refreshed!',
      html: (userName, credits) => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credits Refreshed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 40px 30px; }
    .credits-box { background-color: #f0fdf4; border-left: 4px solid #006C35; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .credits-amount { font-size: 32px; font-weight: 700; color: #006C35; margin: 0; }
    .credits-label { color: #666; font-size: 14px; margin: 8px 0 0 0; }
    .feature-list { margin: 20px 0; }
    .feature-item { display: flex; align-items: flex-start; margin: 12px 0; }
    .feature-icon { width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; }
    .feature-text { color: #333; font-size: 14px; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
    .footer a { color: #006C35; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Credits Refreshed!</h1>
      <p>Your monthly credit allowance has been reset</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">Hi <strong>${escapeHtml(userName)}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Great news! Your monthly Watheq credits have been refreshed. You now have a fresh set of credits to optimize your resume and land your dream job.
      </p>

      <div class="credits-box">
        <div class="credits-amount">${credits}</div>
        <div class="credits-label">Credits available this month</div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">What you can do with your credits:</h3>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>AI Resume Matching</strong> (2 credits) - Analyze how your resume matches job descriptions</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Resume Optimization</strong> (5 credits) - Get AI-powered suggestions to improve your resume</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Vision 2030 Alignment</strong> (2 credits) - See how your background aligns with Saudi Vision 2030</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Interview Preparation</strong> (3 credits) - Generate likely interview questions</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Cover Letter Generation</strong> (4 credits) - Create tailored cover letters</span>
        </div>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        <strong>Tip:</strong> You can earn more credits by inviting friends (5 bonus credits per referral).
      </p>

      <a href="https://watheqai.app" class="cta-button">Start Using Your Credits</a>
    </div>

    <div class="footer">
      <p>This is an automated email from Watheq Resume Optimizer</p>
      <p><a href="https://watheqai.app">Visit Watheq</a> | <a href="https://watheqai.app/settings">Manage Preferences</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, credits) => `
Hi ${escapeHtml(userName)},

Great news! Your monthly Watheq credits have been refreshed.

You now have ${credits} credits available.

What you can do with your credits:
- AI Resume Matching (2 credits) - Analyze how your resume matches job descriptions
- Resume Optimization (5 credits) - Get AI-powered suggestions to improve your resume
- Vision 2030 Alignment (2 credits) - See how your background aligns with Saudi Vision 2030
- Interview Preparation (3 credits) - Generate likely interview questions
- Cover Letter Generation (4 credits) - Create tailored cover letters

Tip: You can earn more credits by inviting friends (5 bonus credits per referral).

Start optimizing: https://watheqai.app

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '✨ أبشرك! رصيدك في واثق تجدّد',
      html: (userName, credits) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تجديد الرصيد</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 40px 30px; }
    .credits-box { background-color: #f0fdf4; border-right: 4px solid #006C35; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .credits-amount { font-size: 32px; font-weight: 700; color: #006C35; margin: 0; }
    .credits-label { color: #666; font-size: 14px; margin: 8px 0 0 0; }
    .feature-list { margin: 20px 0; }
    .feature-item { display: flex; align-items: flex-start; margin: 12px 0; }
    .feature-icon { width: 24px; height: 24px; margin-left: 12px; flex-shrink: 0; }
    .feature-text { color: #333; font-size: 14px; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
    .footer a { color: #006C35; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 أبشرك! رصيدك تجدّد</h1>
      <p>رصيدك الشهري صار جاهز في حسابك</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">حيّاك الله <strong>${escapeHtml(userName)}</strong>،</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        جايبين لك علوم زينة! رصيدك الشهري في واثق تجدّد. الحين يمديك ترجع تضبط سيرتك الذاتية وتزيد فرصك الوظيفية.
      </p>

      <div class="credits-box">
        <div class="credits-amount">${credits}</div>
        <div class="credits-label">رصيد متاح في حسابك</div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">وش تقدر تسوي برصيدك:</h3>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>مطابقة السيرة الذاتية مع الوظيفة</strong> (رصيد 2) - حلل مدى توافق سيرتك الذاتية مع الوظيفة</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>تحسين السيرة الذاتية</strong> (رصيد 5) - احصل على اقتراحات ذكية لتحسين سيرتك</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>توافق رؤية 2030</strong> (رصيد 2) - اكتشف كيف يتوافق خلفيتك مع رؤية 2030</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>إعداد المقابلات</strong> (رصيد 3) - أنشئ أسئلة محتملة للمقابلة</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>إنشاء خطاب التقديم</strong> (رصيد 4) - اكتب خطابات تقديم مخصصة</span>
        </div>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        <strong>نصيحة:</strong> تبي رصيد زيادة؟ ادعُ أخوياك واكسب 5 رصيد مكافأة لكل واحد يسجل، أو عطنا رايك في تجربتك.
      </p>

      <a href="https://watheqai.app" class="cta-button">يلا نبدأ</a>
    </div>

    <div class="footer">
      <p>هذي رسالة آلية من واثق</p>
      <p><a href="https://watheqai.app">زور واثق</a> | <a href="https://watheqai.app/settings">إعداداتك</a></p>
      <p>&copy; 2026 واثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, credits) => `
حيّاك الله ${escapeHtml(userName)},

أبشرك! رصيدك الشهري في واثق تجدّد.

عندك الحين ${credits} رصيد جاهز في حسابك.

وش تقدر تسوي برصيدك:
- مطابقة السيرة الذاتية (رصيد 2) - حلل مدى توافق سيرتك مع الوظيفة
- تحسين السيرة الذاتية (رصيد 5) - احصل على اقتراحات ذكية
- توافق رؤية 2030 (رصيد 2) - اكتشف كيف تتوافق مع رؤية 2030
- إعداد المقابلات (رصيد 3) - أنشئ أسئلة محتملة للمقابلة
- إنشاء خطاب التقديم (رصيد 4) - اكتب خطابات مخصصة

نصيحة: تبي رصيد زيادة؟ ادعُ أخوياك واكسب 5 رصيد مكافأة، أو عطنا رايك.

يلا نبدأ: https://watheqai.app

---
الواثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  },

  monthlyUsageSummary: {
    en: {
      subject: '📊 Your Watheq Monthly Usage Summary',
      html: (userName, stats) => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Usage Summary</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat-card { background-color: #f9f9f9; padding: 15px; border-radius: 4px; border-left: 4px solid #006C35; }
    .stat-value { font-size: 24px; font-weight: 700; color: #006C35; margin: 0; }
    .stat-label { font-size: 12px; color: #999; margin: 5px 0 0 0; text-transform: uppercase; }
    .usage-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .usage-table th { background-color: #f0f0f0; padding: 12px; text-align: right; font-size: 12px; color: #666; font-weight: 600; }
    .usage-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .usage-table tr:last-child td { border-bottom: none; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Your Monthly Usage</h1>
      <p>Summary of your Watheq activity this month</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">Hi <strong>${escapeHtml(userName)}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Here's a summary of how you've used your Watheq credits this month. Keep optimizing!
      </p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalUsed || 0}</div>
          <div class="stat-label">Credits Used</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.remaining || 0}</div>
          <div class="stat-label">Credits Remaining</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalActions || 0}</div>
          <div class="stat-label">Actions Performed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round((stats.usagePercentage || 0) * 100) / 100}%</div>
          <div class="stat-label">Monthly Usage</div>
        </div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">Breakdown by Feature:</h3>
      <table class="usage-table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Times Used</th>
            <th>Credits Used</th>
          </tr>
        </thead>
        <tbody>
          ${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `
          <tr>
            <td>${escapeHtml(feature)}</td>
            <td>${data.count || 0}</td>
            <td>${data.credits || 0}</td>
          </tr>
          `).join('') : '<tr><td colspan="3" style="text-align: center; color: #999;">No usage data available</td></tr>'}
        </tbody>
      </table>

      <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
        <strong>💡 Tip:</strong> Next month's credits will be available on <strong>${stats.nextResetDate || 'your signup anniversary'}</strong>.
        Want more credits? Invite friends and earn 5 bonus credits per referral!
      </p>

      <a href="https://watheqai.app" class="cta-button">Continue Optimizing</a>
    </div>

    <div class="footer">
      <p>This is an automated email from Watheq Resume Optimizer</p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, stats) => `
Hi ${escapeHtml(userName)},

Here's your Watheq monthly usage summary:

Credits Used: ${stats.totalUsed || 0}
Credits Remaining: ${stats.remaining || 0}
Total Actions: ${stats.totalActions || 0}
Monthly Usage: ${Math.round((stats.usagePercentage || 0) * 100) / 100}%

Breakdown by Feature:
${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `${escapeHtml(feature)}: ${data.count || 0} times (${data.credits || 0} credits)`).join('\n') : 'No usage data available'}

Tip: Next month's credits will be available on ${stats.nextResetDate || 'your signup anniversary'}.
Want more credits? Invite friends and earn 5 bonus credits per referral!

Continue optimizing: https://watheqai.app

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '📊 ملخص استخدامك الشهري في واثق',
      html: (userName, stats) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ملخص شهرك معنا</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat-card { background-color: #f9f9f9; padding: 15px; border-radius: 4px; border-right: 4px solid #006C35; }
    .stat-value { font-size: 24px; font-weight: 700; color: #006C35; margin: 0; }
    .stat-label { font-size: 12px; color: #999; margin: 5px 0 0 0; text-transform: uppercase; }
    .usage-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .usage-table th { background-color: #f0f0f0; padding: 12px; text-align: right; font-size: 12px; color: #666; font-weight: 600; }
    .usage-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .usage-table tr:last-child td { border-bottom: none; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ملخص شهرك معنا</h1>
      <p>وش سويت في واثق هالشهر؟</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">حيّاك الله <strong>${escapeHtml(userName)}</strong>،</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        جبنا لك علوم استخدامك لرصيد واثق هالشهر. فالك التوفيق!
      </p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalUsed || 0}</div>
          <div class="stat-label">نقاط استخدمتها</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.remaining || 0}</div>
          <div class="stat-label">الباقي لك</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalActions || 0}</div>
          <div class="stat-label">حركات سويتها</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round((stats.usagePercentage || 0) * 100) / 100}%</div>
          <div class="stat-label">نسبة استخدامك</div>
        </div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">تفاصيلها:</h3>
      <table class="usage-table">
        <thead>
          <tr>
            <th>الخدمة</th>
            <th>كم مرة؟</th>
            <th>كم صرفت؟</th>
          </tr>
        </thead>
        <tbody>
          ${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `
          <tr>
            <td>${escapeHtml(feature)}</td>
            <td>${data.count || 0}</td>
            <td>${data.credits || 0}</td>
          </tr>
          `).join('') : '<tr><td colspan="3" style="text-align: center; color: #999;">ما استخدمت شي للحين</td></tr>'}
        </tbody>
      </table>

      <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
        <strong>💡 تلميحة:</strong> رصيدك الجاي بينزل في تاريخ <strong>${stats.nextResetDate || 'تاريخ تسجيلك'}</strong>.
        تبي نقاط زيادة؟ اعزِم ربعك واكسب 5 نقاط لكل واحد يسجل!
      </p>

      <a href="https://watheqai.app" class="cta-button">كمّل تضبيط سيرتك</a>
    </div>

    <div class="footer">
      <p>هذا بريد إلكتروني تلقائي من الواثق</p>
      <p>&copy; 2026 الواثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, stats) => `
حيّاك الله ${escapeHtml(userName)},

إليك ملخص استخدامك هالشهر في واثق:

نقاط استخدمتها: ${stats.totalUsed || 0}
الباقي لك: ${stats.remaining || 0}
حركات سويتها: ${stats.totalActions || 0}
نسبة استخدامك: ${Math.round((stats.usagePercentage || 0) * 100) / 100}%

التفاصيل:
${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `${escapeHtml(feature)}: ${data.count || 0} مرة (${data.credits || 0} نقطة)`).join('\n') : 'ما فيه بيانات'}

تلميحة: رصيدك الجاي بينزل في ${stats.nextResetDate || 'تاريخ تسجيلك'}.
تبي نقاط زيادة؟ اعزِم ربعك واكسب 5 نقاط لكل واحد يسجل!

كمّل تضبيط سيرتك: https://watheqai.app

---
الواثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  },

  waitlistNotification: {
    en: {
      subject: '🎉 Watheq Pro is Now Available!',
      html: (planType) => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watheq Pro Launch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .feature-list { margin: 20px 0; }
    .feature-item { display: flex; align-items: flex-start; margin: 12px 0; }
    .feature-icon { width: 24px; height: 24px; margin-right: 12px; flex-shrink: 0; color: #006C35; }
    .feature-text { color: #333; font-size: 14px; }
    .cta-button { background-color: #006C35; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; font-size: 16px; }
    .price-box { background-color: #f0fdf4; border: 2px solid #006C35; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .price { font-size: 36px; font-weight: 700; color: #006C35; margin: 10px 0; }
    .price-label { color: #666; font-size: 14px; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Watheq Pro is Here!</h1>
      <p>Thank you for your patience. We're excited to announce the launch!</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">Hi there,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        You signed up for our waitlist, and we're thrilled to let you know that <strong>Watheq Pro</strong> is now live!
        Get higher limits for AI-powered features and take your resume optimization to the next level.
      </p>

      <div class="price-box">
        <div class="price-label">Starting at</div>
        <div class="price">35 SAR/month</div>
        <div class="price-label">100 credits • No expiry</div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">What's included in Watheq Pro:</h3>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>100 Credits Per Month</strong> - Analyze ~20 job applications</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>All AI Features</strong> - Match, Optimize, Cover Letters, Interview Prep</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Vision 2030 Alignment</strong> - Align with Saudi Vision 2030 sectors</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Priority Support</strong> - Get help faster when you need it</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Early Access</strong> - Be the first to try new features</span>
        </div>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        <strong>Special Launch Offer:</strong> Upgrade in the next 7 days and get <strong>20% off</strong> your first month!
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app/pricing" class="cta-button">Upgrade to Pro Now</a>
      </div>

        Questions? Reply to this email.
      </p>
    </div>

    <div class="footer">
      <p>This email was sent because you joined the Watheq Pro waitlist</p>
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">Visit Watheq</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (planType) => `
Hi there,

You signed up for our waitlist, and we're thrilled to let you know that Watheq Pro is now live!

Get 100 credits per month to power your job search:
- All AI Features (Match, Optimize, Cover Letters, Interview Prep)
- Vision 2030 Alignment Analysis
- Priority Support
- Early Access to New Features

Starting at 35 SAR/month

Special Launch Offer: Upgrade in the next 7 days and get 20% off your first month!

Upgrade now: https://watheqai.app/pricing

Upgrade now: https://watheqai.app/pricing

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '🎉 واثق برو متاح الآن!',
      html: (planType) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>إطلاق واثق برو</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .feature-list { margin: 20px 0; }
    .feature-item { display: flex; align-items: flex-start; margin: 12px 0; }
    .feature-icon { width: 24px; height: 24px; margin-left: 12px; flex-shrink: 0; color: #006C35; }
    .feature-text { color: #333; font-size: 14px; }
    .cta-button { background-color: #006C35; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; font-size: 16px; }
    .price-box { background-color: #f0fdf4; border: 2px solid #006C35; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .price { font-size: 36px; font-weight: 700; color: #006C35; margin: 10px 0; }
    .price-label { color: #666; font-size: 14px; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 أبشرك! واثق برو وصل!</h1>
      <p>يعطيك العافية على صبرك. متحمسين نعلن لك الخبر!</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">يا هلا فيك،</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        سجلت معنا في قائمة الانتظار، واليوم نفرحك ونقول لك <strong>واثق برو</strong> صار جاهز!
        اضمن لك 100 رصيد شهرياً وعيش تجربة مختلفة في تحسين فرصك الوظيفية.
      </p>

      <div class="price-box">
        <div class="price-label">تبدأ من</div>
        <div class="price">35 ريال/شهر</div>
        <div class="price-label">100 نقطة • ما تنتهي</div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">ما يتضمنه واثق برو:</h3>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>100 رصيد شهرياً</strong> - حلل ~20 طلب توظيف</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>جميع ميزات الذكاء الاصطناعي</strong> - مطابقة، تحسين، خطابات، تحضير مقابلات</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>مطابقة رؤية 2030</strong> - اربط سيرتك بقطاعات رؤية 2030</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>دعم ذو أولوية</strong> - احصل على مساعدة أسرع</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>وصول مبكر</strong> - كن أول من يجرب الميزات الجديدة</span>
        </div>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        <strong>عرض خاص للإطلاق:</strong> رقّي حسابك خلال الـ 7 أيام الجاية وخذ <strong>خصم 20%</strong> على أول شهر!
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app/pricing" class="cta-button">رقّي لـ برو الحين</a>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
        &nbsp;
      </p>
    </div>

    <div class="footer">
      <p>تم إرسال هذا البريد لأنك انضممت إلى قائمة انتظار واثق برو</p>
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">زُر واثق</a></p>
      <p>&copy; 2026 واثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (planType) => `
حيّا الله من جانا،

سجلت معنا في قائمة الانتظار، واليوم نعلن لك أن واثق برو صار جاهز!

خذلك 100 رصيد شهرياً:
- كل ميزات الذكاء الاصطناعي (مطابقة، تحسين، خطابات، مقابلات)
- مطابقة رؤية 2030
- دعم فني خاص لك
- تجربة الميزات الجديدة قبل الكل

35 ريال/شهر

عرض خاص: رقّي حسابك خلال الـ 7 أيام الجاية ولك خصم 20% على أول شهر!

رقّي حسابك الحين: https://watheqai.app/pricing

رقّي حسابك الحين: https://watheqai.app/pricing

---
واثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  },

  waitlistConfirmation: {
    en: {
      subject: '✅ Welcome to Watheq Pro Waitlist - You\'re In!',
      html: `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Waitlist Confirmation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .check-icon { width: 64px; height: 64px; background-color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-center; margin: 0 auto 20px; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check-icon">
        <span style="font-size: 32px; line-height: 32px;">✓</span>
      </div>
      <h1>You're on the Waitlist!</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Thanks for your interest in <strong>Watheq Pro</strong>! You've been successfully added to our waitlist.
      </p>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        We're working hard to bring you higher-limit AI-powered resume optimization tools. You'll be among the first to know when we launch!
      </p>

      <div style="background-color: #f0fdf4; border-left: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">What happens next?</p>
        <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 14px;">
          <li>We'll email you when Pro launches</li>
          <li>Early waitlist members get priority access</li>
          <li>Special launch pricing for early adopters</li>
        </ul>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        In the meantime, you can continue using Watheq for free with 20 monthly credits to optimize your resume!
      </p>

      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
        &nbsp;
      </p>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">Visit Watheq</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: `
You're on the Waitlist!

Thanks for your interest in Watheq Pro! You've been successfully added to our waitlist.

We're working hard to bring you higher-limit AI-powered resume optimization tools. You'll be among the first to know when we launch!

What happens next?
- We'll email you when Pro launches
- Early waitlist members get priority access
- Special launch pricing for early adopters

In the meantime, you can continue using Watheq for free with 20 monthly credits to optimize your resume!

In the meantime, you can continue using Watheq for free with 20 monthly credits to optimize your resume!

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '✅ أهلاً بك في قائمة انتظار واثق برو - تم التسجيل!',
      html: `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>تأكيد الانضمام</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .check-icon { width: 64px; height: 64px; background-color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-center; margin: 0 auto 20px; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="check-icon" style="background-color: transparent; width: auto; height: auto;">
        <span style="font-size: 40px; line-height: 48px; color: white; font-weight: bold; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">واثق</span>
      </div>
      <h1>أبشر! حجزنا لك مكان</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        يعطيك العافية على اهتمامك بـ <strong>واثق برو</strong>! سجلناك معنا في القائمة وأمورك في السليم.
      </p>

      <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
        جالسين نشتغل ليل نهار عشان نقدم لك أدوات تضبط سيرتك بالذكاء الاصطناعي بلا حدود. وبتكون (إن شاء الله) من أول الناس اللي يدرون وقت الإطلاق!
      </p>

      <div style="background-color: #f0fdf4; border-right: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">وش اللي بيصير بعدين؟</p>
        <ul style="margin: 0; padding-right: 20px; color: #666; font-size: 14px;">
          <li>بنرسل لك إيميل أول ما نطلق "برو"</li>
          <li>لك الأولوية في تجربة الخدمة</li>
          <li>ولك سعر خاص لأنك من الأوائل</li>
        </ul>
      </div>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        على ما نجهز، يمديك تستخدم واثق مجاناً (عندك 20 رصيد شهري) وتضبط أمورك!
      </p>

      <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
        &nbsp;
      </p>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">زُر واثق</a></p>
      <p>&copy; 2026 واثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: `
أبشر! حجزنا لك مكان في القائمة

يعطيك العافية على اهتمامك بـ واثق برو! سجلناك معنا في القائمة وأمورك تمام.

جالسين نشتغل عشان نقدم لك أدوات تضبط سيرتك بالذكاء الاصطناعي بلا حدود. وبتكون من أول الناس اللي يدرون وقت الإطلاق!

وش اللي بيصير بعدين؟
- بنرسل لك إيميل أول ما نطلق "برو"
- لك الأولوية في تجربة الخدمة
- ولك سعر خاص لأنك من الأوائل

على ما نجهز، يمديك تستخدم واثق مجاناً (عندك 20 رصيد شهري) وتضبط أمورك!

على ما نجهز، يمديك تستخدم واثق مجاناً (عندك 20 رصيد شهري) وتضبط أمورك!

---
واثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  },

  referralRewardReferrer: {
    en: {
      subject: '🎉 You Earned 5 Credits from Your Referral!',
      html: (userName, refereeName) => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Referral Reward</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .credits-badge { background-color: #10b981; color: white; font-size: 48px; font-weight: 700; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 20px auto; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Referral Reward Unlocked!</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">Hi <strong>${escapeHtml(userName)}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Great news! ${refereeName ? `<strong>${escapeHtml(refereeName)}</strong>` : 'Your friend'} just used Watheq and completed their first action. As a thank you for the referral, we've added <strong>5 bonus credits</strong> to your account!
      </p>

      <div class="credits-badge">+5</div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Keep sharing your referral link to earn more credits!
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app" class="cta-button">Use Your Credits Now</a>
      </div>

      <div style="background-color: #f0fdf4; border-left: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">💡 Pro Tip</p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          Share your referral link with more friends! Each successful referral earns you 5 credits. Find your referral link in your account settings.
        </p>
      </div>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">Visit Watheq</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, refereeName) => `
Hi ${escapeHtml(userName)},

Great news! ${escapeHtml(refereeName || 'Your friend')} just used Watheq and completed their first action. As a thank you for the referral, we've added 5 bonus credits to your account!

+5 Credits Added

Keep sharing your referral link to earn more credits!

Use your credits now: https://watheqai.app

Pro Tip: Each successful referral earns you 5 credits. Find your referral link in your account settings.

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '🎉 جاك 5 رصيد هدية!',
      html: (userName, refereeName) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مكافأة الإحالة</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .credits-badge { background-color: #10b981; color: white; font-size: 48px; font-weight: 700; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 20px auto; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 تستاهل المكافأة!</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">يا هلا <strong>${escapeHtml(userName)}</strong>،</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        علوم طيبة! ${refereeName ? `<strong>${escapeHtml(refereeName)}</strong>` : 'خويك'} استخدم واثق عن طريقك وضبّط وضعه. وعشان كذا، لك منا <strong>5 نقاط إضافية</strong> في حسابك تستاهلها!
      </p>

      <div class="credits-badge">+5</div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; text-align: center; margin: 20px 0;">
        لا يوقف الخير عندك، انشر الرابط بين ربعك وزد رصيدك!
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app" class="cta-button">استخدم رصيدك الحين</a>
      </div>

      <div style="background-color: #f0fdf4; border-right: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">💡 تلميحة</p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          كل واحد يسجل عن طريقك، يجيك 5 نقاط. ادخل إعدادات حسابك وانسخ رابط الدعوة.
        </p>
      </div>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">زُر واثق</a></p>
      <p>&copy; 2026 واثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, refereeName) => `
حيّاك الله ${escapeHtml(userName)},

علوم طيبة! ${escapeHtml(refereeName || 'خويك')} استخدم واثق عن طريقك. وعشان كذا، لك منا 5 نقاط إضافية في حسابك تستاهلها!

+5 رصيد وصلك

لا يوقف الخير عندك، انشر الرابط بين ربعك وزد رصيدك!

استخدم رصيدك الحين: https://watheqai.app

تلميحة: كل واحد يسجل عن طريقك، يجيك 5 نقاط. ادخل إعدادات حسابك وانسخ رابط الدعوة.

---
واثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  },

  referralRewardReferee: {
    en: {
      subject: '🎁 Welcome Bonus: 5 Free Credits Added!',
      html: (userName, referrerName) => `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome Bonus</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .credits-badge { background-color: #10b981; color: white; font-size: 48px; font-weight: 700; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 20px auto; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎁 Welcome Bonus!</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">Hi <strong>${escapeHtml(userName)}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        Thanks for joining Watheq! ${referrerName ? `Since you were referred by <strong>${escapeHtml(referrerName)}</strong>, ` : ''}We've added <strong>5 bonus credits</strong> to your account to help you get started!
      </p>

      <div class="credits-badge">+5</div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; text-align: center; margin: 20px 0;">
        Use your credits to optimize your resume for the roles you want to pursue.
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app" class="cta-button">Start Optimizing</a>
      </div>

      <div style="background-color: #f0fdf4; border-left: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">💡 Earn More Credits</p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          You can earn 5 more credits by inviting your friends too! Find your referral link in your account settings.
        </p>
      </div>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">Visit Watheq</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, referrerName) => `
Hi ${escapeHtml(userName)},

Thanks for joining Watheq! ${referrerName ? `Since you were referred by ${escapeHtml(referrerName)}, ` : ''}We've added 5 bonus credits to your account to help you get started!

+5 Credits Added

Use your credits to optimize your resume for the roles you want to pursue.

Start optimizing: https://watheqai.app

Earn More Credits: You can earn 5 more credits by inviting your friends too! Find your referral link in your account settings.

---
Watheq Resume Optimizer
https://watheqai.app
      `
    },
    ar: {
      subject: '🎁 وصلتك 5 نقاط هدية ترحيبية!',
      html: (userName, referrerName) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مكافأة الترحيب</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; direction: rtl; }
    .container { max-width: 600px; margin: 0; auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #006C35 0%, #005a2d 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; }
    .credits-badge { background-color: #10b981; color: white; font-size: 48px; font-weight: 700; width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 20px auto; }
    .cta-button { background-color: #006C35; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 20px 0; font-weight: 600; }
    .footer { background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eee; }
    .footer p { margin: 8px 0; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎁 حياك الله في واثق!</h1>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">يا هلا وسهلا <strong>${escapeHtml(userName)}</strong>،</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        نوّرت واثق! ${referrerName ? `وبما أنك جاي من طرف <strong>${escapeHtml(referrerName)}</strong>، ` : ''}حطينا لك <strong>5 نقاط إضافية</strong> في حسابك كبداية قوية لك!
      </p>

      <div class="credits-badge">+5</div>

      <p style="color: #666; font-size: 14px; line-height: 1.6; text-align: center; margin: 20px 0;">
        استفد من رصيدك واضبط سيرتك الذاتية عشان تلقى وظيفة أحلامك!
      </p>

      <div style="text-align: center;">
        <a href="https://watheqai.app" class="cta-button">يلا نبدأ</a>
      </div>

      <div style="background-color: #f0fdf4; border-right: 4px solid #006C35; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #006C35; font-weight: 600; margin: 0 0 8px 0;">💡 تبي نقاط زود؟</p>
        <p style="margin: 0; color: #666; font-size: 14px;">
          يمديك تكسب 5 نقاط زيادة إذا عزمت أخوياك! تلقى رابط الدعوة في إعدادات حسابك.
        </p>
      </div>
    </div>

    <div class="footer">
      <p><a href="https://watheqai.app" style="color: #006C35; text-decoration: none;">زُر واثق</a></p>
      <p>&copy; 2026 واثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, referrerName) => `
يا هلا وسهلا ${escapeHtml(userName)},

نوّرت واثق! ${referrerName ? `وبما أنك جاي من طرف ${escapeHtml(referrerName)}، ` : ''}حطينا لك 5 نقاط إضافية في حسابك كبداية قوية لك!

+5 نقاط وصلتك

استفد من رصيدك واضبط سيرتك الذاتية عشان تلقى وظيفة أحلامك!

يلا نبدأ: https://watheqai.app

تبي نقاط زيادة؟ يمديك تكسب 5 نقاط زيادة إذا عزمت أخوياك! تلقى رابط الدعوة في إعدادات حسابك.

---
واثق - محسّن السيرة الذاتية
https://watheqai.app
      `
    }
  }
};
