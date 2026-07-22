// ─────────────────────────────────────────────
// useComposeIdentity — the leader's own identity for the attribution
// control + the live preview.
//
// This is a SELF-view. A leader always sees their own real name / church
// on their own surface (never governed by the anonymous flag or
// display_name_preference — same rule as HamburgerPanel's identity card).
//
// Region is DISPLAY-ONLY here and authoritative SERVER-SIDE. The client
// cannot safely derive the CD's sub-region:
//   - underground churches have NULL city/lat/lng by CHECK constraint, and
//   - coordinates live on church_profiles (RLS-restricted), not churches.
// So `region` stays null for now and the attribution helper degrades
// gracefully ("A Pastor from your region."). When DBA lands a client-safe
// macro-region label (see the NetworkFeed `macro_region_label` TODO), this
// hook is the single place to fill it in — the submit payload never sends
// region regardless (the server re-derives + scrubs).
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getRoleLabel } from '../../../utils/displayHelpers';
import type { Attribution } from './types';

export interface ComposeIdentity {
  roleLabel: string; // e.g. "Pastor" (getRoleLabel — always resolves)
  firstName: string | null;
  churchName: string | null;
  isUnderground: boolean;
  region: string | null; // display-only; null until a client-safe field exists
  loading: boolean;
}

const EMPTY: ComposeIdentity = {
  roleLabel: 'Minister',
  firstName: null,
  churchName: null,
  isUnderground: false,
  region: null,
  loading: true,
};

export function useComposeIdentity(): ComposeIdentity {
  const [identity, setIdentity] = useState<ComposeIdentity>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const authId = sessionData?.session?.user?.id ?? null;
      if (!authId) {
        if (!cancelled) setIdentity((p) => ({ ...p, loading: false }));
        return;
      }
      // Same shape HamburgerPanel uses — role + embedded church row.
      const { data } = await supabase
        .from('users')
        .select('full_name, role, church:church_id(name, type)')
        .eq('auth_id', authId)
        .maybeSingle();
      if (cancelled) return;

      const row = data as unknown as {
        full_name: string | null;
        role?: string | null;
        church?: unknown;
      } | null;

      if (!row) {
        setIdentity((p) => ({ ...p, loading: false }));
        return;
      }

      const cf = row.church;
      const c = (Array.isArray(cf) ? (cf[0] ?? null) : (cf ?? null)) as
        | { name?: string | null; type?: string | null }
        | null;
      const fullName = row.full_name ?? null;

      setIdentity({
        roleLabel: getRoleLabel(row.role ?? null),
        firstName: fullName ? fullName.trim().split(/\s+/)[0] : null,
        churchName: c?.name ?? null,
        isUnderground: c?.type === 'underground',
        region: null,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return identity;
}

// Grammar helper — "A Pastor" / "An Apostle". The CD copy always leads with
// an article; vowel-initial role labels take "An".
export function articleFor(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? 'An' : 'A';
}

// Single-line byline for the publish-shape reading card (§G / testimony
// preview). show_name → "Pastor Elias · Living Word Assembly";
// role_region → "A Pastor from South Asia".
export function readingAttributionLine(
  identity: ComposeIdentity,
  attribution: Attribution,
): string {
  if (attribution === 'show_name') {
    const who = [identity.roleLabel, identity.firstName].filter(Boolean).join(' ');
    return identity.churchName ? `${who} · ${identity.churchName}` : who;
  }
  return `${articleFor(identity.roleLabel)} ${identity.roleLabel} from ${identity.region ?? 'your region'}`;
}

// Author block for the live LeaderWordCard preview (word type).
export function previewAuthor(
  identity: ComposeIdentity,
  attribution: Attribution,
): { initial: string; name: string; church: string } {
  if (attribution === 'show_name') {
    const name = [identity.roleLabel, identity.firstName].filter(Boolean).join(' ');
    return {
      initial: (identity.firstName ?? identity.roleLabel).charAt(0).toUpperCase(),
      name,
      church: identity.churchName ?? '',
    };
  }
  return {
    initial: identity.roleLabel.charAt(0).toUpperCase(),
    name: `${articleFor(identity.roleLabel)} ${identity.roleLabel} from ${identity.region ?? 'your region'}`,
    church: '',
  };
}
