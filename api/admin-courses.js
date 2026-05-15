export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

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

  const baseHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'POST') {
      const { title, subtitle, color, link, game_type, max_score, sort_order } = req.body || {};
      if (!title || !link) return res.status(400).json({ error: 'title과 link가 필요합니다.' });

      const r = await fetch(`${supabaseUrl}/rest/v1/courses`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ title, subtitle, color, link, game_type, max_score, sort_order, active: true }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json({ success: true, course: data?.[0] });
    }

    if (req.method === 'PUT') {
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

      const r = await fetch(`${supabaseUrl}/rest/v1/courses?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...baseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(patch),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data));
      return res.status(200).json({ success: true, course: data?.[0] });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

      const r = await fetch(`${supabaseUrl}/rest/v1/courses?id=eq.${id}`, {
        method: 'DELETE',
        headers: baseHeaders,
      });
      if (!r.ok) {
        const errBody = await r.text();
        throw new Error(errBody);
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin-courses error:', err);
    return res.status(500).json({ error: err.message });
  }
}
