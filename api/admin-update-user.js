export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { currentEmail, newEmail, newPassword } = req.body || {};
  if (!currentEmail) return res.status(400).json({ error: 'currentEmail is required' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase admin credentials not configured' });
  }

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // 1. 이메일로 auth 유저 조회
  const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(currentEmail)}`, { headers });
  const listData = await listRes.json();
  const authUser = listData?.users?.[0];
  if (!authUser) return res.status(404).json({ error: '해당 이메일의 사용자를 찾을 수 없습니다.' });

  // 2. 변경할 내용 구성
  const updates = {};
  if (newEmail && newEmail !== currentEmail) updates.email = newEmail;
  if (newPassword) updates.password = newPassword;
  if (Object.keys(updates).length === 0) return res.status(200).json({ success: true, message: 'No auth updates needed' });

  // 3. auth 정보 업데이트
  const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return res.status(400).json({ error: errText });
  }

  return res.status(200).json({ success: true });
}
