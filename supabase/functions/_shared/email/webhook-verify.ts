// KAN-80 Batch 2 — Svix-scheme webhook signature verification for Resend.
//
// Resend signs webhooks via Svix. Headers:
//   svix-id         — unique message id (doubles as our replay-protection key)
//   svix-timestamp  — unix seconds
//   svix-signature  — one or more space-separated "v1,<base64hmac>" entries
//
// Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256
// keyed with the base64-DECODED portion of the `whsec_...` signing secret.
//
// SEC posture (panel 2026-06-24, SEC Finding 3):
//   - constant-time comparison on every candidate signature
//   - ±5 minute timestamp tolerance window
//   - missing headers → reject WITHOUT audit (don't log attacker probes)
//   - present-but-wrong signature → reject WITH audit (active-attack signal)

const TOLERANCE_SECONDS = 5 * 60;

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let result = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ai = i < aBytes.length ? aBytes[i] : 0;
    const bi = i < bBytes.length ? bBytes[i] : 0;
    result |= ai ^ bi;
  }
  return result === 0;
}

export type VerifyResult =
  | { ok: true; svixId: string }
  | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

export async function verifySvixSignature(
  headers: Headers,
  rawBody: string,
  signingSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: "missing_headers" };
  }

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  // Secret arrives as "whsec_<base64>"; the HMAC key is the decoded bytes.
  const secretB64 = signingSecret.startsWith("whsec_")
    ? signingSecret.slice("whsec_".length)
    : signingSecret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, reason: "bad_signature" };
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

  // svix-signature may carry multiple space-separated versions; accept any
  // v1 match. Constant-time compare runs on EVERY candidate (no early exit
  // before the comparison itself).
  let anyMatch = false;
  for (const part of svixSignature.split(" ")) {
    const [version, sig] = part.split(",", 2);
    if (version !== "v1" || sig === undefined) continue;
    if (timingSafeEqualStrings(sig, expected)) anyMatch = true;
  }
  return anyMatch ? { ok: true, svixId } : { ok: false, reason: "bad_signature" };
}
