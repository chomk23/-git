export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.body || {};

  const prompts = {
    ox: `당신은 정보보안 교육 전문가입니다. 직장인을 위한 정보보안 OX 퀴즈 10문항을 생성하세요.

다양한 주제(피싱, 악성코드, 비밀번호, 네트워크 보안, 소셜 엔지니어링, 랜섬웨어, 데이터 보호, 모바일 보안, 클라우드 보안 등)를 골고루 포함하세요.
매번 다른 문항을 생성하세요. 랜덤 시드: ${Date.now()}

반드시 아래 JSON 배열 형식만 출력하세요 (다른 설명 없이):
[
  {"q": "문항 내용", "a": true, "exp": "해설 1~2문장"},
  ...
]

조건:
- 정확히 10문항
- a는 true(O 정답) 또는 false(X 정답)
- exp는 한국어 1~2문장 해설
- 문항은 직장인이 이해하기 쉬운 실용적인 내용`,

    phishing: `당신은 정보보안 교육 전문가입니다. 직장인 피싱 탐지 훈련을 위한 이메일 시나리오 6개를 생성하세요.

구성: 피싱 4개 + 정상 2개
다양한 유형(은행/포털/택배/공공기관/사내 IT/클라우드 서비스 등)을 사용하세요.
매번 다른 시나리오를 생성하세요. 랜덤 시드: ${Date.now()}

반드시 아래 JSON 배열 형식만 출력하세요 (다른 설명 없이):
[
  {
    "isPhishing": true,
    "from": "발신자명 <email@domain.com>",
    "subject": "이메일 제목",
    "body": "이메일 본문 2~4문장",
    "link": "http://링크URL",
    "clues": ["탐지 단서1", "탐지 단서2", "탐지 단서3"]
  },
  ...
]

조건:
- 피싱(isPhishing: true): clues에 피싱 징후 3~4개
- 정상(isPhishing: false): link는 공식 도메인 URL, clues에 정상인 이유 3~4개
- 한국어로 작성, 현실적이고 실제처럼 느껴지는 시나리오`
  };

  if (!prompts[type]) {
    return res.status(400).json({ error: 'Invalid type. Use "ox" or "phishing".' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompts[type] }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 3000,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'AI API error', detail: errText });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 배열 추출
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON array in response:', text);
      return res.status(502).json({ error: 'Invalid AI response format' });
    }

    const questions = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ questions });

  } catch (error) {
    console.error('generate-quiz error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}
