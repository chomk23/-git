// 관리자 전용: courses 행의 일부 필드를 수정
// 허용 필드: max_score, active, title, subtitle, color, sort_order
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { id, ...rawPatch } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

  // 화이트리스트 필드만 허용
  const ALLOWED = ['max_score', 'active', 'title', 'subtitle', 'color', 'sort_order'];
  const patch = {};
  for (const k of ALLOWED) if (k in rawPatch) patch[k] = rawPatch[k];
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  }

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/courses?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(patch),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    return res.status(200).json({ success: true, course: data?.[0] });
  } catch (err) {
    console.error('admin-courses error:', err);
    return res.status(500).json({ error: err.message });
  }
}
