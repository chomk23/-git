// 간단한 Supabase 기반 rate limiter
// 사용: const ok = await checkRateLimit({ supabaseUrl, serviceKey, identifier, endpoint, maxPerWindow, windowSec });
//       if (!ok) → 429
export async function checkRateLimit({ supabaseUrl, serviceKey, identifier, endpoint, maxPerWindow, windowSec }) {
  try {
    const sinceIso = new Date(Date.now() - windowSec * 1000).toISOString();
    const url = `${supabaseUrl}/rest/v1/api_rate_limit?identifier=eq.${encodeURIComponent(identifier)}&endpoint=eq.${encodeURIComponent(endpoint)}&called_at=gte.${encodeURIComponent(sinceIso)}&select=id`;
    const r = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'count=exact',
      },
    });
    const range = r.headers.get('content-range') || '*/0';
    const count = parseInt(range.split('/')[1] || '0');

    if (count >= maxPerWindow) {
      return { allowed: false, count, max: maxPerWindow, windowSec };
    }

    // 호출 기록
    await fetch(`${supabaseUrl}/rest/v1/api_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, endpoint }),
    });

    return { allowed: true, count: count + 1, max: maxPerWindow, windowSec };
  } catch (e) {
    // rate limiter 자체가 실패해도 본 요청은 통과시킴 (가용성 우선)
    console.error('rate-limit error:', e);
    return { allowed: true };
  }
}

// 클라이언트 IP 가져오기 (Vercel)
export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
