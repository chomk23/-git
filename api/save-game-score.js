// 게임 점수 저장 — 클라이언트 위조 방지를 위해 서버에서만 insert
// 검증:
//  - JWT 인증된 사용자만
//  - game_type 은 active courses 의 game_type 목록 안에 있어야 함
//  - score 는 0~100 정수
//  - 같은 사용자/게임 첫 플레이만 저장 (재시도 점수 무시)
export default async function handler(req, res) {
  const allowedOrigin = process.env.SITE_URL || 'https://git-ashen-xi.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── JWT 인증 ──
  const callerToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!callerToken) return res.status(401).json({ error: 'Unauthorized' });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${callerToken}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid session' });
  const callerUser = await userRes.json();
  const userEmail = callerUser.email;
  if (!userEmail) return res.status(401).json({ error: 'No email' });

  // ── 입력 검증 ──
  const { game_type, score } = req.body || {};
  if (typeof game_type !== 'string' || !game_type.match(/^[a-z_]+$/)) {
    return res.status(400).json({ error: 'invalid game_type' });
  }
  const s = parseInt(score);
  if (!Number.isInteger(s) || s < 0 || s > 100) {
    return res.status(400).json({ error: 'score must be 0~100' });
  }

  try {
    // ── game_type이 active 강의에 등록된 값인지 확인 ──
    const courseRes = await fetch(
      `${supabaseUrl}/rest/v1/courses?game_type=eq.${encodeURIComponent(game_type)}&active=eq.true&select=game_type`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const courses = await courseRes.json();
    if (!courses || courses.length === 0) {
      return res.status(400).json({ error: 'unknown or inactive game_type' });
    }

    // ── 첫 플레이만 저장: 기존 점수가 있으면 skip ──
    const existRes = await fetch(
      `${supabaseUrl}/rest/v1/game_scores?user_email=eq.${encodeURIComponent(userEmail)}&game_type=eq.${encodeURIComponent(game_type)}&select=id&limit=1`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const existing = await existRes.json();
    if (existing && existing.length > 0) {
      return res.status(200).json({ saved: false, reason: 'already played' });
    }

    // ── insert ──
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/game_scores`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail,
        game_type:  game_type,
        score:      s,
      }),
    });
    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      throw new Error(errBody);
    }
    return res.status(200).json({ saved: true, score: s });
  } catch (err) {
    console.error('save-game-score error:', err);
    return res.status(500).json({ error: err.message });
  }
}
