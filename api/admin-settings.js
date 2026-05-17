export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', (process.env.SITE_URL || '').replace(/\/$/, ''));
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

  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings 객체가 필요합니다.' });
  }

  const baseHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // upsert each key
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: value == null ? '' : String(value),
      updated_at: new Date().toISOString(),
    }));

    const r = await fetch(`${supabaseUrl}/rest/v1/app_settings`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    });

    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(errBody);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('admin-settings error:', err);
    return res.status(500).json({ error: err.message });
  }
}
