export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  const rawSiteUrl  = process.env.SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const siteUrl     = rawSiteUrl.replace(/\/$/, '');

  if (!supabaseUrl || !serviceKey || !resendKey || !siteUrl) {
    return res.status(500).json({ error: '환경변수가 설정되지 않았습니다.' });
  }

  // ── 관리자 인증 ──
  const callerToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!callerToken) return res.status(401).json({ error: 'Unauthorized' });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${callerToken}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' });
  const callerUser = await userRes.json();

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(callerUser.email)}&select=role`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json();
  if (profiles?.[0]?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { emailType, customTemplate, targets } = req.body || {};
  if ((!emailType && !customTemplate) || !targets?.length) {
    return res.status(400).json({ error: 'emailType 또는 customTemplate과 targets가 필요합니다.' });
  }

  // ── 훈련 회차 생성 ──
  const sessionRes = await fetch(`${supabaseUrl}/rest/v1/phishing_sessions`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ email_type: emailType || 'AI 생성', sent_count: targets.length }),
  });
  const sessionData = await sessionRes.json();
  const sessionId = sessionData?.[0]?.id || 'unknown';

  // ── 이메일 발송 ──
  const tmpl = customTemplate || getTemplate(emailType);
  let successCount = 0;

  const fromAddr = (tmpl.from || '').includes('@') ? tmpl.from : `보안 교육 플랫폼 <onboarding@resend.dev>`;

  for (const t of targets) {
    const trackingUrl = `${siteUrl}/api/phishing-click?e=${Buffer.from(t.email).toString('base64')}&s=${sessionId}`;
    const name = t.name || '수강생';
    const subject = (tmpl.subject || '').replace(/\{NAME\}/g, name);
    const html = tmpl.html
      .replace(/\{NAME\}/g, name)
      .replace(/\{TRACKING_URL\}/g, trackingUrl);

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to: t.email, subject, html }),
    });
    if (r.ok) {
      successCount++;
    } else {
      const errBody = await r.json().catch(() => ({}));
      console.error('Resend error:', r.status, JSON.stringify(errBody));
    }
  }

  return res.status(200).json({ success: true, sent: successCount, sessionId });
}

function getTemplate(type) {
  const T = {
    '계정 보안 알림 (네이버)': {
      from: 'NAVER 보안센터 <onboarding@resend.dev>',
      subject: '[네이버] 계정 보안 알림 — 즉시 확인이 필요합니다',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#03C75A;padding:20px;text-align:center;"><span style="color:#fff;font-size:26px;font-weight:bold;">NAVER</span></div>
        <div style="padding:32px;">
          <h2 style="color:#222;font-size:18px;">안녕하세요, {NAME}님</h2>
          <p style="color:#555;line-height:1.7;">회원님의 계정에서 비정상적인 로그인 시도가 감지되었습니다.<br>
          아래 버튼을 클릭하여 본인 확인 후 계정을 보호하세요.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{TRACKING_URL}" style="background:#03C75A;color:#fff;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">지금 바로 확인하기</a>
          </div>
          <p style="color:#aaa;font-size:12px;">본인이 아닌 경우 이 메일을 무시하셔도 됩니다.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;"><p style="color:#aaa;font-size:11px;">© NAVER Corp.</p></div>
      </div>`,
    },
    '비밀번호 변경 요청 (카카오)': {
      from: 'Kakao 고객센터 <onboarding@resend.dev>',
      subject: '[카카오] 비밀번호 변경 요청이 접수되었습니다',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#FEE500;padding:20px;text-align:center;"><span style="color:#3C1E1E;font-size:26px;font-weight:bold;">kakao</span></div>
        <div style="padding:32px;">
          <h2 style="color:#222;font-size:18px;">{NAME}님의 비밀번호 변경 요청</h2>
          <p style="color:#555;line-height:1.7;">카카오 계정 비밀번호 변경 요청이 접수되었습니다.<br>
          본인이 요청한 경우 아래 버튼을 클릭하여 변경을 완료해 주세요.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{TRACKING_URL}" style="background:#FEE500;color:#3C1E1E;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">비밀번호 변경하기</a>
          </div>
          <p style="color:#aaa;font-size:12px;">본인이 요청하지 않은 경우 즉시 고객센터로 연락하세요.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;"><p style="color:#aaa;font-size:11px;">© Kakao Corp.</p></div>
      </div>`,
    },
    '업무 공유 문서 (Google Docs)': {
      from: 'Google Docs <onboarding@resend.dev>',
      subject: '{NAME}님, 중요 문서가 공유되었습니다',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;">
        <div style="padding:24px 32px;border-bottom:1px solid #e0e0e0;"><span style="color:#4285F4;font-size:20px;font-weight:bold;">Google Docs</span></div>
        <div style="padding:32px;">
          <h2 style="color:#222;font-size:18px;">{NAME}님, 문서가 공유되었습니다</h2>
          <p style="color:#555;line-height:1.7;">관리팀에서 중요 문서를 공유했습니다. 아래 버튼을 클릭해 확인하세요.</p>
          <div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="margin:0;font-weight:bold;color:#222;">📄 2024년 보안 정책 개정안.docx</p>
            <p style="margin:4px 0 0;color:#999;font-size:12px;">공유자: 관리팀 (admin@company.com)</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="{TRACKING_URL}" style="background:#4285F4;color:#fff;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">Google Docs에서 열기</a>
          </div>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;"><p style="color:#aaa;font-size:11px;">© 2024 Google LLC</p></div>
      </div>`,
    },
    '택배 배송 안내 (CJ대한통운)': {
      from: 'CJ대한통운 <onboarding@resend.dev>',
      subject: '[CJ대한통운] 택배 배송 예정 — 수령 장소를 확인하세요',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#E8380D;padding:20px;text-align:center;"><span style="color:#fff;font-size:22px;font-weight:bold;">CJ대한통운</span></div>
        <div style="padding:32px;">
          <h2 style="color:#222;font-size:18px;">{NAME}님, 택배가 곧 도착합니다</h2>
          <p style="color:#555;line-height:1.7;">고객님의 택배가 배송 중입니다. 정확한 일정 확인 및 수령 장소 변경은 아래를 클릭하세요.</p>
          <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="margin:0;color:#555;font-size:13px;">운송장 번호: <strong>123456789012</strong></p>
            <p style="margin:4px 0 0;color:#555;font-size:13px;">배송 상태: <strong style="color:#E8380D;">배송 중</strong></p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="{TRACKING_URL}" style="background:#E8380D;color:#fff;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">배송 조회하기</a>
          </div>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;"><p style="color:#aaa;font-size:11px;">© CJ대한통운</p></div>
      </div>`,
    },
    '국세청 세금 환급 안내': {
      from: '국세청 홈택스 <onboarding@resend.dev>',
      subject: '[국세청] 세금 환급금 지급 안내 — 신청 기한 확인 필요',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#003DA5;padding:20px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:bold;">국세청 홈택스</span></div>
        <div style="padding:32px;">
          <h2 style="color:#222;font-size:18px;">{NAME}님께 세금 환급금이 있습니다</h2>
          <p style="color:#555;line-height:1.7;">납부하신 세금 중 환급 가능한 금액이 확인되었습니다.<br>
          아래 버튼을 클릭하여 환급 신청을 완료해 주세요.</p>
          <div style="background:#EEF3FF;border-radius:8px;padding:16px;margin:24px 0;text-align:center;">
            <p style="margin:0;color:#003DA5;font-size:24px;font-weight:bold;">환급 예정액: 127,400원</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="{TRACKING_URL}" style="background:#003DA5;color:#fff;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">환급 신청하기</a>
          </div>
          <p style="color:#aaa;font-size:12px;">신청 기한: 2024년 12월 31일까지</p>
        </div>
        <div style="background:#f5f5f5;padding:16px;text-align:center;"><p style="color:#aaa;font-size:11px;">© 국세청</p></div>
      </div>`,
    },
  };
  return T[type] || T['계정 보안 알림 (네이버)'];
}
