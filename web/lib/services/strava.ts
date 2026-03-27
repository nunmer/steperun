import crypto from "crypto";

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE  = "https://www.strava.com/api/v3";

// ---------------------------------------------------------------------------
// CSRF state
// ---------------------------------------------------------------------------

export function generateStravaState(userId: string): string {
  const timestamp = Date.now().toString();
  const hmac = crypto
    .createHmac("sha256", process.env.SECRET_KEY!)
    .update(`${userId}:${timestamp}`)
    .digest("hex");
  return Buffer.from(JSON.stringify({ userId, timestamp, hmac })).toString("base64url");
}

export function verifyStravaState(state: string, expectedUserId: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId, timestamp, hmac } = decoded;
    if (userId !== expectedUserId) return false;

    // Reject states older than 10 minutes
    if (Date.now() - Number(timestamp) > 10 * 60 * 1000) return false;

    const expected = crypto
      .createHmac("sha256", process.env.SECRET_KEY!)
      .update(`${userId}:${timestamp}`)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// OAuth URLs
// ---------------------------------------------------------------------------

export function stravaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID!,
    redirect_uri:  process.env.STRAVA_REDIRECT_URI!,
    response_type: "code",
    approval_prompt: "auto",
    scope:         "read,activity:read",
    state,
  });
  return `${STRAVA_AUTH_URL}?${params}`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface StravaTokenResponse {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;   // Unix timestamp
  athlete: { id: number };
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Activity fetch
// ---------------------------------------------------------------------------

export interface StravaActivity {
  id:               number;
  start_date_local: string;
  distance:         number;
  moving_time:      number;
  type:             string;
}

export async function fetchAthleteActivities(
  accessToken: string,
  opts: { after?: number; before?: number; perPage?: number } = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: String(opts.perPage ?? 200) });
  if (opts.after)  params.set("after",  String(opts.after));
  if (opts.before) params.set("before", String(opts.before));

  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava activities fetch failed: ${res.status}`);
  }
  return res.json();
}
