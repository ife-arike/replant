// KAN-18/19 — get-nearby-churches Edge Function
//
// Authenticated POST endpoint. Returns nearby churches around the
// viewer's GPS within a server-decided radius (50km default; auto-
// expands to 100km if <3 results). Underground exclusion is enforced
// at the view level (KAN-211) and inside find_nearby_churches RPC; no
// FE-side defense.
//
// Masking layers:
//   1. Underground rows: never reach this function (view-level filter).
//   2. Unverified callers: per-row `name` is OMITTED (not nulled —
//      absent from the JSON), and `leaders` is `[]`. Top-level
//      `caller_verified: false` signals the masking. The FE renders
//      type + "VERIFY TO VIEW DETAILS" on these rows.
//   3. Anonymous leaders: server-side at the RPC layer
//      (find_nearby_churches), `first_name` + `last_name` are NULL,
//      `anon: true`. The FE displays "role · Hidden".
//
// is_own boolean: tags the caller's own church (matched by
// caller.church_id from public.users).
//
// SEC posture (locked Founder 2026-05-28): no SECURITY DEFINER write,
// 30 req/hr per user_id (Upstash), fail-open if Upstash unreachable,
// strict JSON parse, hard caps on radius + lat/lng range.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RADIUS_DEFAULT_KM   = 50;
const RADIUS_EXPANDED_KM  = 100;
const EXPANSION_THRESHOLD = 3; // expand to 100km if first pass returns <3
const RATE_LIMIT_MAX      = 30;
const RATE_LIMIT_WINDOW_S = 3600;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LeaderRow {
  role: string;
  first_name: string | null;
  last_name:  string | null;
  anon:       boolean;
}

interface NearbyRow {
  id:                  string;
  name:                string;
  type:                string;
  city:                string | null;
  country:             string | null;
  lat:                 number;
  lng:                 number;
  rag_status:          string;
  verification_status: string;
  distance_km:         number;
  leaders:             LeaderRow[] | null;
}

interface ResponseChurch {
  id:           string;
  name?:        string;  // OMITTED when caller unverified
  type:         string;
  city:         string | null;
  country:      string | null;
  lat:          number;
  lng:          number;
  rag_status:   string;
  distance_km:  number;
  leaders:      LeaderRow[];
  is_own:       boolean;
}

interface ResponseBody {
  churches:        ResponseChurch[];
  expanded:        boolean;
  radius_km:       number;
  caller_verified: boolean;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" && Number.isFinite(lat) && lat >= -90  && lat <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}

// ── Upstash rate limit (per user_id) — mirrors search-churches ──
async function upstashIncr(url: string, token: string, key: string): Promise<number | null> {
  const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Upstash INCR ${res.status}`);
  const { result } = (await res.json()) as { result: number };
  return result;
}

async function upstashExpire(url: string, token: string, key: string, ttl: number): Promise<void> {
  const res = await fetch(
    `${url}/expire/${encodeURIComponent(key)}/${ttl}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Upstash EXPIRE ${res.status}`);
}

async function rateLimit(userId: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const url   = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return { allowed: true }; // fail-open
  const key = `get_nearby_churches:${userId}`;
  try {
    const count = await upstashIncr(url, token, key);
    if (count === null) return { allowed: true };
    if (count === 1) await upstashExpire(url, token, key, RATE_LIMIT_WINDOW_S);
    if (count > RATE_LIMIT_MAX) return { allowed: false, retryAfterSeconds: RATE_LIMIT_WINDOW_S };
    return { allowed: true };
  } catch (e) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "get-nearby-churches.upstash-failed",
        message: (e as Error).message,
        ts: new Date().toISOString(),
      }),
    );
    return { allowed: true };
  }
}

// ── Per-row masking + own-church flag ──
function maskRow(row: NearbyRow, callerVerified: boolean, callerChurchId: string | null): ResponseChurch {
  const isOwn  = callerChurchId !== null && row.id === callerChurchId;
  const common = {
    id:          row.id,
    type:        row.type,
    city:        row.city,
    country:     row.country,
    lat:         row.lat,
    lng:         row.lng,
    rag_status:  row.rag_status,
    distance_km: row.distance_km,
    is_own:      isOwn,
  };
  if (callerVerified) {
    return { ...common, name: row.name, leaders: row.leaders ?? [] };
  }
  // Unverified — name OMITTED (not null); leaders = [].
  return { ...common, leaders: [] };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST")    return json(405, { error: "method_not_allowed" });

  // ── Env ──
  const supabaseUrl    = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "server_misconfigured" });
  }
  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  // ── Auth gate ──
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing_token" });

  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData?.user?.id) return json(401, { error: "invalid_token" });
  const authId = userData.user.id;

  // ── Body ──
  let body: { lat?: unknown; lng?: unknown; radius_km?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!isValidLatLng(body.lat, body.lng)) {
    return json(400, { error: "invalid_lat_lng" });
  }
  const viewerLat = body.lat as number;
  const viewerLng = body.lng as number;
  // Client may suggest a radius but server enforces the policy (50 →
  // expand to 100 if <3). Per dispatch: "client does NOT send 100 —
  // server decides." A client-provided radius below 50 is honoured;
  // above 50 is clamped to 50 for the first pass.
  const requestedRadiusKm = typeof body.radius_km === "number" && Number.isFinite(body.radius_km)
    ? Math.max(1, Math.min(RADIUS_DEFAULT_KM, body.radius_km))
    : RADIUS_DEFAULT_KM;

  // ── Caller record (verification + own church) ──
  const { data: callerRow, error: callerErr } = await admin
    .from("users")
    .select("verification_status, church_id")
    .eq("auth_id", authId)
    .single();
  if (callerErr || !callerRow) {
    return json(404, { error: "user_not_found" });
  }
  const callerVerified  = callerRow.verification_status === "verified";
  const callerChurchId  = callerRow.church_id as string | null;

  // ── Rate limit (per user_id, AFTER auth) ──
  const rl = await rateLimit(authId);
  if (!rl.allowed) {
    return json(429, { error: "rate_limited", retry_after_seconds: rl.retryAfterSeconds });
  }

  // ── Two-pass radius ──
  let radiusKm = requestedRadiusKm;
  let expanded = false;

  const passOne = await admin.rpc("find_nearby_churches", {
    p_viewer_lng:    viewerLng,
    p_viewer_lat:    viewerLat,
    p_radius_meters: Math.round(radiusKm * 1000),
  });
  if (passOne.error) {
    console.error(JSON.stringify({
      level: "error",
      event: "get-nearby-churches.rpc-failed",
      message: passOne.error.message,
      ts: new Date().toISOString(),
    }));
    return json(500, { error: "rpc_failed" });
  }
  let rows = (passOne.data ?? []) as NearbyRow[];

  if (rows.length < EXPANSION_THRESHOLD && requestedRadiusKm < RADIUS_EXPANDED_KM) {
    const passTwo = await admin.rpc("find_nearby_churches", {
      p_viewer_lng:    viewerLng,
      p_viewer_lat:    viewerLat,
      p_radius_meters: RADIUS_EXPANDED_KM * 1000,
    });
    if (!passTwo.error) {
      rows = (passTwo.data ?? []) as NearbyRow[];
      radiusKm = RADIUS_EXPANDED_KM;
      expanded = true;
    }
  }

  // ── Mask + flag ──
  const churches: ResponseChurch[] = rows.map((r) => maskRow(r, callerVerified, callerChurchId));

  const out: ResponseBody = {
    churches,
    expanded,
    radius_km:       radiusKm,
    caller_verified: callerVerified,
  };
  return json(200, out);
}

Deno.serve(handler);
