export default async function handler(req, res) {
  const { e, s } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  const rawSiteUrl  = process.env.SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const siteUrl     = rawSiteUrl.replace(/\/$/, '');
  const warningUrl  = `${siteUrl}/phishing-warning.html`;

  try {
    if (!e || !supabaseUrl || !serviceKey) throw new Error('missing params');

    const email = Buffer.from(e, 'base64').toString('utf-8');

    // ── phishing_clicked 업데이트 ──
    await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phishing_clicked: true, phishing_clicked_at: new Date().toISOString() }),
      }
    );

    // ── 관리자 알림 설정 조회 ──
    const adminRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?role=eq.admin&select=notif_phishing_alert,notif_email&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const admins = await adminRes.json();
    const admin  = admins?.[0];

    // ── 관리자 알림 메일 발송 ──
    if (admin?.notif_phishing_alert && admin?.notif_email && resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '보안 교육 플랫폼 <onboarding@resend.dev>',
          to: admin.notif_email,
          subject: '[보안 훈련] 피싱 메일 클릭 감지',
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:16px;border-radius:4px;margin-bottom:24px;">
              <h2 style="margin:0 0 8px;color:#DC2626;font-size:16px;">피싱 훈련 클릭 감지</h2>
              <p style="margin:0;color:#555;font-size:14px;"><strong>${email}</strong> 계정에서 피싱 훈련 메일을 클릭했습니다.</p>
            </div>
            <p style="color:#666;font-size:13px;">클릭 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
            <p style="color:#666;font-size:13px;">훈련 회차 ID: ${s || '-'}</p>
          </div>`,
        }),
      });
    }
  } catch (err) {
    console.error('phishing-click error:', err);
  }

  res.setHeader('Location', warningUrl);
  return res.status(302).end();
}
