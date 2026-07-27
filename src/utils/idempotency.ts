// Idempotency key generator — UUID v4.
//
// Required by every signup-class write under Founder ruling #28 (KAN-44 +
// underground flow). The same key MUST be reused across all retries of a
// single user-intent submission — that's the whole point. Calling
// newIdempotencyKey() at submit time and reusing it for retries is the
// caller's responsibility; we just mint it.
//
// expo-crypto's randomUUID() returns a v4 UUID per the spec — random bytes
// with the version + variant nibbles overwritten. 16 chars min, 128 max per
// the BE validator (IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_\-:.+/=]{16,128}$/) —
// a v4 UUID is 36 chars and passes cleanly.

import * as Crypto from 'expo-crypto';

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}
