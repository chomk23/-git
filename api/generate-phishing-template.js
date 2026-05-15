export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

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

  const { description } = req.body || {};

  const prompt = `당신은 사이버 보안 교육 전문가입니다. 보안 인식 훈련용 모의 피싱 이메일 HTML을 생성해주세요.

${description
  ? `요청: "${description}"`
  : `요청: 자유롭게 선택하세요. 실제로 많이 쓰이는 피싱 유형 중 하나를 랜덤으로 골라 만들어주세요. (예: 금융기관 사칭, 택배 알림, 정부기관 환급, 포털 계정 보안, 기업 내부 문서 공유, 이벤트 당첨 등 다양하게)`}

다음 HTML 템플릿 구조를 정확히 따라주세요 (스팸 필터 회피용 검증된 구조):

\`\`\`html
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:[브랜드색상];padding:20px;text-align:center;">
    <span style="color:#fff;font-size:26px;font-weight:bold;">[브랜드명]</span>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#222;font-size:18px;">{NAME}님, [짧은 인사]</h2>
    <p style="color:#555;line-height:1.7;">[3~5문장 본문 — 자연스럽고 길게]</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="{TRACKING_URL}" style="background:[브랜드색상];color:#fff;padding:14px 36px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:15px;">[CTA 텍스트]</a>
    </div>
    <p style="color:#aaa;font-size:12px;">[안내 문구]</p>
  </div>
  <div style="background:#f5f5f5;padding:16px;text-align:center;">
    <p style="color:#aaa;font-size:11px;">© [브랜드명]</p>
  </div>
</div>
\`\`\`

규칙:
1. 위 구조를 그대로 사용 (구조 변경 금지, 색상/내용만 채우기)
2. 한국어로 작성
3. 수신자 이름은 반드시 {NAME} 플레이스홀더
4. CTA 버튼 href는 반드시 {TRACKING_URL} 플레이스홀더
5. <style> 태그, <script> 태그, <table>, 외부 이미지 사용 금지
6. 본문은 자연스럽고 충분히 긴 텍스트 (최소 3문장)
7. "무료", "긴급", "당첨", "지금 즉시", "100%" 같은 스팸 키워드 금지
8. 제목은 자연스럽게 (느낌표/대문자 남용 금지)

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "from": "발신자 표시 이름 (예: NAVER 보안센터)",
  "subject": "이메일 제목",
  "html": "위 구조를 따른 전체 HTML",
  "text": "이메일 본문의 plain text 버전 (HTML 태그 없이, 줄바꿈 포함)"
}`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData?.content?.[0]?.text?.trim();
    if (!raw) throw new Error('AI 응답 없음');

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');

    const template = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ success: true, template });
  } catch (err) {
    console.error('generate-phishing-template error:', err);
    return res.status(500).json({ error: '템플릿 생성 실패: ' + err.message });
  }
}
