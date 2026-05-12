// KAN-137 post-flag-effects — pure logic for routing keyword matches
// to moderation_state writes + T1 pastoral alert triggering.
//
// AC-6 BE function-call shape (Founder-ratified lean (a)): after the
// send-message message INSERT commits, this orchestrator:
//   (1) Buckets matches by routing axis (admin / pastoral) from the
//       taxonomy metadata each match already carries.
//   (2) Computes per-axis meta payload (min tier, matched code names)
//       for the moderation_state row.
//   (3) Classifies whether a Tier-1 pastoral signal fired — the trigger
//       for emitPastoralT1Alert per AC-1.
//
// DELIVER-ALWAYS — D-45 clause 3 (locked decision):
// The functions here are pure record-shaping helpers; they never throw,
// never decide on delivery, never gate INSERTs. The orchestrator (in
// index.ts) catches all I/O errors from moderation_state writes + T1
// emit and continues. The original message has ALREADY committed by
// the time these helpers run.
//
// SEC c.11750 #1 + #6 — pattern secrecy + cross-definer chain audit:
// The meta payload this module emits carries only AGGREGATE code names
// (which are public via taxonomy-codes.ts) + tier integers. No leader
// identifiers, no message content, no flag_reason string (the codes
// are in flag_reason already on the messages row; the same code names
// appear in moderation_state.meta.matched_codes for forensic linkage
// without surface duplication).

import { type TaxonomyCode } from "./taxonomy.ts";

export type RoutingAxis = "admin" | "pastoral";

export interface AxisModerationPayload {
  axis: RoutingAxis;
  // Most-expedited tier among matches in this axis (1, 2, or 3).
  tier: 1 | 2 | 3;
  // Code names matched in this axis. Used as moderation_state.meta.
  // matched_codes for forensic linkage and pastoral-queue rendering.
  matched_codes: string[];
}

export interface FlagEffectsPlan {
  // One entry per routing axis that had at least one match. Order is
  // deterministic: admin first, then pastoral (insertion-order matches
  // the cross-axis dual-route semantic from KAN-124 AC-17 — neither
  // axis suppresses the other).
  axes: AxisModerationPayload[];
  // True iff at least one Tier-1 pastoral code matched. AC-1 trigger
  // condition for the Resend Template 9 (immediate alert) emit path.
  fire_pastoral_t1_alert: boolean;
}

// classifyMatches — buckets matches by routing axis + computes per-axis
// moderation_state payload + the T1-pastoral-fire flag.
//
// Empty input → empty plan (axes: [], fire_pastoral_t1_alert: false).
// Caller skips moderation_state writes and T1 emit entirely on empty.
export function classifyMatches(matches: TaxonomyCode[]): FlagEffectsPlan {
  if (!matches || matches.length === 0) {
    return { axes: [], fire_pastoral_t1_alert: false };
  }

  const admin = matches.filter((m) => m.routing === "admin");
  const pastoral = matches.filter((m) => m.routing === "pastoral");

  const axes: AxisModerationPayload[] = [];

  if (admin.length > 0) {
    axes.push({
      axis: "admin",
      tier: minTier(admin),
      matched_codes: admin.map((m) => m.code),
    });
  }
  if (pastoral.length > 0) {
    axes.push({
      axis: "pastoral",
      tier: minTier(pastoral),
      matched_codes: pastoral.map((m) => m.code),
    });
  }

  // AC-1 trigger: ANY pastoral match with tier === 1 fires the T1
  // alert. Multiple T1 pastoral matches don't fire multiple alerts —
  // the per-leader Upstash rate limit (pastoral-t1-email-emit:{leader})
  // bounds to 1 emit per hour regardless.
  const fire_pastoral_t1_alert = pastoral.some((m) => m.tier === 1);

  return { axes, fire_pastoral_t1_alert };
}

function minTier(codes: TaxonomyCode[]): 1 | 2 | 3 {
  // Caller ensures non-empty input. Tier values are constrained to
  // 1|2|3 by the FLAG_TAXONOMY shape validator (taxonomy.ts).
  return Math.min(...codes.map((c) => c.tier)) as 1 | 2 | 3;
}
