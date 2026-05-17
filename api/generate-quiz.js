export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type } = req.body || {};

  // 매 요청마다 다른 주제 조합을 강제로 지정
  const oxTopics = [
    ['피싱 이메일', '랜섬웨어', '비밀번호 관리', '2단계 인증'],
    ['소셜 엔지니어링', '악성코드', '공공 Wi-Fi 보안', 'USB 보안'],
    ['클라우드 보안', '모바일 보안', '내부자 위협', '데이터 백업'],
    ['웹 브라우저 보안', '이메일 보안', '네트워크 침입', '보안 패치'],
    ['암호화', 'VPN', '제로데이 취약점', '계정 탈취'],
    ['개인정보 보호', '스피어 피싱', '크리덴셜 스터핑', '보안 인식'],
  ];
  const phishingTypes = [
    ['인터넷 뱅킹', '포털 계정', '택배 사칭', '공공기관'],
    ['클라우드 스토리지', '사내 IT 공지', '결제 서비스', '보안 알림'],
    ['SNS 계정', '이커머스', '건강보험', '소프트웨어 업데이트'],
    ['항공권 예약', '스트리밍 서비스', '세금 환급', '채용 공고'],
  ];

  const seed = Date.now();
  const oxSet = oxTopics[seed % oxTopics.length];
  const phishSet = phishingTypes[seed % phishingTypes.length];

  const prompts = {
    ox: `당신은 정보보안 교육 전문가입니다. 직장인을 위한 정보보안 OX 퀴즈 10문항을 생성하세요.

이번 세트에서 반드시 다뤄야 할 핵심 주제: ${oxSet.join(', ')}
위 주제들을 포함하되 나머지 문항은 다른 보안 주제로 채우세요.
이전과 완전히 다른 새로운 문장과 상황으로 만드세요. 시드: ${seed}

반드시 아래 JSON 배열 형식만 출력하세요 (다른 설명 없이):
[
  {"q": "문항 내용", "a": true, "exp": "해설 1~2문장"},
  ...
]

조건:
- 정확히 10문항
- a는 true(O 정답) 또는 false(X 정답)
- exp는 한국어 1~2문장 해설
- 문항은 직장인이 이해하기 쉬운 실용적인 내용
- 이전과 유사한 문장 표현 절대 금지, 새로운 시나리오와 표현 사용`,

    phishing: `당신은 정보보안 교육 전문가입니다. 직장인 피싱 탐지 훈련을 위한 이메일 시나리오 6개를 생성하세요.

이번 세트 유형: ${phishSet.join(', ')} 사칭 포함
구성: 피싱 4개 + 정상 2개
이전과 완전히 다른 발신자, 도메인, 상황으로 만드세요. 시드: ${seed}

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
- 피싱(isPhishing: true): clues에 피싱 징후 3~4개, 가짜 도메인 사용
- 정상(isPhishing: false): link는 실제 공식 도메인 URL, clues에 정상인 이유 3~4개
- 이전과 유사한 제목/본문 표현 절대 금지
- 한국어로 작성, 현실적이고 실제처럼 느껴지는 시나리오`
  };

  if (!prompts[type]) {
    return res.status(400).json({ error: 'Invalid type. Use "ox" or "phishing".' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 3000,
        temperature: 1.0,
        messages: [{ role: 'user', content: prompts[type] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'AI API error', detail: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

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
