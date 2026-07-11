// Netlify Function: handles Strava OAuth token exchange and activity fetch
// Deployed automatically by Netlify — no configuration needed

const STRAVA_CLIENT_ID = '264372';
const STRAVA_CLIENT_SECRET = 'c5a2fa8c9f2526ffe891eb3eeec4cad8d75926f8';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const action = params.action;

  // ── ACTION: exchange code for token ──────────────────────────────
  if (action === 'exchange') {
    const code = params.code;
    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing authorization code' })
      };
    }

    try {
      // redirect_uri must match exactly what was sent during authorization
      const redirect_uri = params.redirect_uri || 'https://codystrainingplan.netlify.app/';
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          redirect_uri,
          grant_type: 'authorization_code'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Token exchange failed');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          athlete: {
            firstname: data.athlete?.firstname,
            lastname: data.athlete?.lastname,
            profile: data.athlete?.profile_medium
          }
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // ── ACTION: refresh token ─────────────────────────────────────────
  if (action === 'refresh') {
    const refresh_token = params.refresh_token;
    if (!refresh_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing refresh token' })
      };
    }

    try {
      const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Token refresh failed');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // ── ACTION: fetch activities ──────────────────────────────────────
  if (action === 'activities') {
    const access_token = params.access_token;
    if (!access_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing access token' })
      };
    }

    try {
      // Fetch last 60 activities (covers the full 22-week block)
      const res = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?per_page=60&page=1',
        { headers: { 'Authorization': `Bearer ${access_token}` } }
      );

      const activities = await res.json();
      if (!res.ok) throw new Error(activities.message || 'Activity fetch failed');

      // Return only what we need — date, distance, moving time, type
      const simplified = activities.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,                          // Run, TrailRun, Walk etc
        date: a.start_date_local.slice(0, 10), // YYYY-MM-DD
        distance_km: +(a.distance / 1000).toFixed(2),
        moving_time_s: a.moving_time,
        elapsed_time_s: a.elapsed_time,
        elevation_m: a.total_elevation_gain
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(simplified)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: 'Unknown action. Use: exchange, refresh, or activities' })
  };
};
