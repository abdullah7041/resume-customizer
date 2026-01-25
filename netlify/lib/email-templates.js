/**
 * Email Templates for Watheq
 * Includes HTML and plain text versions for:
 * - Credits Refreshed notification
 * - Monthly Usage Summary
 *
 * Supports: Arabic (RTL) + English (LTR) languages
 * Brand Colors: Saudi Green (#006C35), Warm Gold (#DAA520)
 */

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
      <p style="color: #333; font-size: 16px;">Hi <strong>${userName}</strong>,</p>

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
        <strong>Tip:</strong> You can earn more credits by inviting friends (5 bonus credits per referral) or leaving feedback on your experience.
      </p>

      <a href="https://watheq.app" class="cta-button">Start Using Your Credits</a>
    </div>

    <div class="footer">
      <p>This is an automated email from Watheq Resume Optimizer</p>
      <p><a href="https://watheq.app">Visit Watheq</a> | <a href="https://watheq.app/settings">Manage Preferences</a></p>
      <p>&copy; 2026 Watheq. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, credits) => `
Hi ${userName},

Great news! Your monthly Watheq credits have been refreshed.

You now have ${credits} credits available.

What you can do with your credits:
- AI Resume Matching (2 credits) - Analyze how your resume matches job descriptions
- Resume Optimization (5 credits) - Get AI-powered suggestions to improve your resume
- Vision 2030 Alignment (2 credits) - See how your background aligns with Saudi Vision 2030
- Interview Preparation (3 credits) - Generate likely interview questions
- Cover Letter Generation (4 credits) - Create tailored cover letters

Tip: You can earn more credits by inviting friends (5 bonus credits per referral) or leaving feedback.

Start optimizing: https://watheq.app

---
Watheq Resume Optimizer
https://watheq.app
      `
    },
    ar: {
      subject: '✨ تم تحديث رصيد الواثق الخاص بك!',
      html: (userName, credits) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تحديث الرصيد</title>
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
      <h1>🎉 تم تحديث رصيدك!</h1>
      <p>تم تحديث مخصصك الشهري من الرصيد</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">مرحباً <strong>${userName}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        أخبار سارة! تم تحديث رصيدك الشهري من الواثق. لديك الآن مجموعة جديدة من الرصيد لتحسين سيرتك الذاتية والحصول على وظيفة أحلامك.
      </p>

      <div class="credits-box">
        <div class="credits-amount">${credits}</div>
        <div class="credits-label">رصيد متاح لهذا الشهر</div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">ماذا يمكنك أن تفعل برصيدك:</h3>
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
        <strong>نصيحة:</strong> يمكنك الحصول على رصيد إضافي بدعوة الأصدقاء (5 رصيد مكافأة لكل إحالة) أو تقديم تعليقاتك على تجربتك.
      </p>

      <a href="https://watheq.app" class="cta-button">ابدأ باستخدام رصيدك</a>
    </div>

    <div class="footer">
      <p>هذا بريد إلكتروني تلقائي من الواثق</p>
      <p><a href="https://watheq.app">زر الواثق</a> | <a href="https://watheq.app/settings">إدارة التفضيلات</a></p>
      <p>&copy; 2026 الواثق. جميع الحقوق محفوظة.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: (userName, credits) => `
مرحباً ${userName},

أخبار سارة! تم تحديث رصيدك الشهري من الواثق.

لديك الآن ${credits} رصيد متاح.

ماذا يمكنك أن تفعل برصيدك:
- مطابقة السيرة الذاتية (رصيد 2) - حلل مدى توافق سيرتك مع الوظيفة
- تحسين السيرة الذاتية (رصيد 5) - احصل على اقتراحات ذكية
- توافق رؤية 2030 (رصيد 2) - اكتشف كيف تتوافق مع رؤية 2030
- إعداد المقابلات (رصيد 3) - أنشئ أسئلة محتملة للمقابلة
- إنشاء خطاب التقديم (رصيد 4) - اكتب خطابات مخصصة

نصيحة: احصل على رصيد إضافي بدعوة الأصدقاء أو تقديم تعليقات.

ابدأ الآن: https://watheq.app

---
الواثق - محسّن السيرة الذاتية
https://watheq.app
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
      <p style="color: #333; font-size: 16px;">Hi <strong>${userName}</strong>,</p>

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
            <td>${feature}</td>
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

      <a href="https://watheq.app" class="cta-button">Continue Optimizing</a>
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
Hi ${userName},

Here's your Watheq monthly usage summary:

Credits Used: ${stats.totalUsed || 0}
Credits Remaining: ${stats.remaining || 0}
Total Actions: ${stats.totalActions || 0}
Monthly Usage: ${Math.round((stats.usagePercentage || 0) * 100) / 100}%

Breakdown by Feature:
${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `${feature}: ${data.count || 0} times (${data.credits || 0} credits)`).join('\n') : 'No usage data available'}

Tip: Next month's credits will be available on ${stats.nextResetDate || 'your signup anniversary'}.
Want more credits? Invite friends and earn 5 bonus credits per referral!

Continue optimizing: https://watheq.app

---
Watheq Resume Optimizer
https://watheq.app
      `
    },
    ar: {
      subject: '📊 ملخص استخدام الواثق الشهري',
      html: (userName, stats) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ملخص الاستخدام الشهري</title>
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
      <h1>📊 ملخص استخدامك الشهري</h1>
      <p>ملخص نشاطك على الواثق هذا الشهر</p>
    </div>

    <div class="content">
      <p style="color: #333; font-size: 16px;">مرحباً <strong>${userName}</strong>,</p>

      <p style="color: #666; font-size: 14px; line-height: 1.6;">
        إليك ملخص استخدامك لرصيد الواثق هذا الشهر. استمر في التحسين!
      </p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalUsed || 0}</div>
          <div class="stat-label">الرصيد المستخدم</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.remaining || 0}</div>
          <div class="stat-label">الرصيد المتبقي</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalActions || 0}</div>
          <div class="stat-label">الإجراءات المنفذة</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round((stats.usagePercentage || 0) * 100) / 100}%</div>
          <div class="stat-label">استخدام الرصيد</div>
        </div>
      </div>

      <h3 style="color: #333; margin: 30px 0 15px 0; font-size: 16px;">توزيع حسب الميزة:</h3>
      <table class="usage-table">
        <thead>
          <tr>
            <th>الميزة</th>
            <th>مرات الاستخدام</th>
            <th>الرصيد المستخدم</th>
          </tr>
        </thead>
        <tbody>
          ${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `
          <tr>
            <td>${feature}</td>
            <td>${data.count || 0}</td>
            <td>${data.credits || 0}</td>
          </tr>
          `).join('') : '<tr><td colspan="3" style="text-align: center; color: #999;">لا توجد بيانات استخدام</td></tr>'}
        </tbody>
      </table>

      <p style="color: #666; font-size: 14px; line-height: 1.6; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
        <strong>💡 نصيحة:</strong> سيكون رصيد الشهر القادم متاحاً في <strong>${stats.nextResetDate || 'تاريخ تسجيلك'}</strong>.
        هل تريد رصيد إضافي؟ ادعُ أصدقاءك واكسب 5 رصيد مكافأة لكل إحالة!
      </p>

      <a href="https://watheq.app" class="cta-button">استمر في التحسين</a>
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
مرحباً ${userName},

إليك ملخص استخدامك الشهري على الواثق:

الرصيد المستخدم: ${stats.totalUsed || 0}
الرصيد المتبقي: ${stats.remaining || 0}
الإجراءات المنفذة: ${stats.totalActions || 0}
استخدام الرصيد: ${Math.round((stats.usagePercentage || 0) * 100) / 100}%

توزيع حسب الميزة:
${stats.breakdown ? Object.entries(stats.breakdown).map(([feature, data]) => `${feature}: ${data.count || 0} مرة (${data.credits || 0} رصيد)`).join('\n') : 'لا توجد بيانات استخدام'}

نصيحة: سيكون رصيد الشهر القادم متاحاً في ${stats.nextResetDate || 'تاريخ تسجيلك'}.
هل تريد رصيد إضافي؟ ادعُ أصدقاءك واكسب 5 رصيد مكافأة لكل إحالة!

استمر في التحسين: https://watheq.app

---
الواثق - محسّن السيرة الذاتية
https://watheq.app
      `
    }
  }
};
