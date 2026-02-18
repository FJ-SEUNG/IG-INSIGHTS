export async function onRequestPost(context) {
  const token = context.env.GITHUB_PAT;
  if (!token) {
    return Response.json({ success: false, error: 'GITHUB_PAT not configured' }, { status: 500 });
  }

  const res = await fetch(
    'https://api.github.com/repos/Flying-Japan/IG-INSIGHTS/actions/workflows/daily-insights.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ig-insights-dashboard',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (res.status === 204) {
    return Response.json({ success: true });
  }

  const body = await res.text();
  return Response.json({ success: false, error: body }, { status: res.status });
}
