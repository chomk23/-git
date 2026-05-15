export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  // ── phishing_sessions 전체 삭제 ──
  try {
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/phishing_sessions?id=not.is.null`,
      {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=minimal',
        },
      }
    );
    if (!delRes.ok) {
      const errBody = await delRes.text();
      throw new Error(`Supabase ${delRes.status}: ${errBody}`);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('reset-phishing-sessions error:', err);
    return res.status(500).json({ error: err.message });
  }
}
