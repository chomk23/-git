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

다음 규칙을 반드시 따르세요:
1. 실제 해당 서비스처럼 보이는 디자인 (브랜드 색상, 로고 텍스트 등)
2. 한국어로 작성
3. 수신자 이름은 반드시 {NAME} 플레이스홀더 사용
4. 클릭 유도 버튼의 href는 반드시 {TRACKING_URL} 플레이스홀더 사용
5. max-width: 600px, 인라인 스타일만 사용
6. 발신자 이름과 이메일 주소도 해당 서비스처럼 설정 (예: "NAVER 보안센터 <onboarding@resend.dev>")
7. 제목(subject)도 실감나게 작성

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "from": "발신자명 <onboarding@resend.dev>",
  "subject": "이메일 제목",
  "html": "전체 HTML 코드"
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
