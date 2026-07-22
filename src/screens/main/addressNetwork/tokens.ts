// ─────────────────────────────────────────────
// Address the Network — local derived tokens.
//
// The base palette lives in constants/theme.ts. These are the sky /
// status TINTS the CD pack (address-network-cd.css :root) derives from
// the accent + RAG colours. They are declared once here — never hardcoded
// per component — matching the codebase convention (see ComingSoonModal's
// local SKY_BORDER, HeartcrySubmission's rgba tints).
//
// `HAIRLINE` is the 0.14 off-white the pack calls `Colors.hairline`; the
// theme exposes `border` at 0.08 but no 0.14 token, so it is named here
// (same value ComingSoonModal calls FAINT).
// ─────────────────────────────────────────────

import { Colors } from '../../../constants/theme';

// Sky (accent #6BB5E8) tints.
export const SKY_04 = 'rgba(107,181,232,0.04)';
export const SKY_08 = 'rgba(107,181,232,0.08)';
export const SKY_15 = 'rgba(107,181,232,0.15)';
export const SKY_25 = Colors.borderAccent; // rgba(107,181,232,0.25)

// Off-white 0.14 — the guardrail left rule + neutral hold border.
export const HAIRLINE = 'rgba(240,237,230,0.14)';

// Status pill tints (dot colour = the RAG token itself).
export const AMBER_BORDER = 'rgba(212,168,85,0.35)';
export const AMBER_BG = 'rgba(212,168,85,0.08)';
export const AMBER_CARD_BG = 'rgba(212,168,85,0.045)';
export const AMBER_CARD_BORDER = 'rgba(212,168,85,0.30)';

export const GREEN_BORDER = 'rgba(91,173,122,0.35)';
export const GREEN_BG = 'rgba(91,173,122,0.08)';

export const REVIEW_BG = 'rgba(240,237,230,0.03)';

export const RED_BORDER = 'rgba(224,85,85,0.30)';
export const RED_BG = 'rgba(224,85,85,0.06)';
export const RED_REASON_BG = 'rgba(224,85,85,0.05)';
export const RED_REASON_BORDER = 'rgba(224,85,85,0.18)';

// Plain modal scrim — no expo-blur (load-bearing invariant). Matches the
// HeartcrySubmission confirmation scrim / ComingSoonModal register.
export const SCRIM = 'rgba(8,8,8,0.80)';
