export default async function handler(req, res) {
  const { e } = req.query;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawSiteUrl  = process.env.SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const siteUrl     = rawSiteUrl.replace(/\/$/, '');
  const warningUrl  = `${siteUrl}/phishing-warning.html`;

  try {
    if (!e || !supabaseUrl || !serviceKey) throw new Error('missing params');

    const email = Buffer.from(e, 'base64').toString('utf-8');

    await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phishing_clicked: true, phishing_clicked_at: new Date().toISOString() }),
      }
    );
  } catch (err) {
    console.error('phishing-click error:', err);
  }

  res.setHeader('Location', warningUrl);
  return res.status(302).end();
}
