// ─────────────────────────────────────────────
// useComposeIdentity — the leader's attribution as it will ACTUALLY publish.
//
// Sourced from the my_attribution_preview() SECURITY DEFINER RPC
// (kan338_0007), which returns the EXACT strings content_submission_publish
// stamps — composed by the same server helpers (content_named_leader_label
// + content_role_region_label). The compose preview therefore equals the
// published artifact byte-for-byte (KAN-338 FE lane F5: the preview must
// not promise a name the publish path denies, and must never say "your
// region" when publish says "South Asia").
//
// No client-side identity read or name composition happens here anymore —
// the old .from('users') self-read + JS byline builder is deleted. The
// server owns every string; region is real (macro-region label), not a
// placeholder. The submit payload still sends no region/name — the server
// re-derives at publish.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Attribution } from './types';

export interface ComposeIdentity {
  // "Minister Ruth James" — the frozen show_name byline (null while loading
  // or if unresolvable). Church rides showNameSublabel, not this string.
  showNameLabel: string | null;
  // "Maranatha Ministries" — the church sublabel for a named post ('' when
  // the leader has no surfaced church).
  showNameSublabel: string | null;
  // "A Minister from North America" — the role+region byline (also what an
  // underground leader always publishes as).
  roleRegionLabel: string | null;
  isUnderground: boolean;
  // A surface, non-anonymous leader may choose show_name; everyone else is
  // role_region only (server-forced for underground).
  canShowName: boolean;
  loading: boolean;
}

const EMPTY: ComposeIdentity = {
  showNameLabel: null,
  showNameSublabel: null,
  roleRegionLabel: null,
  isUnderground: false,
  canShowName: false,
  loading: true,
};

export function useComposeIdentity(): ComposeIdentity {
  const [identity, setIdentity] = useState<ComposeIdentity>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('my_attribution_preview');
      if (cancelled) return;
      const row = (Array.isArray(data) ? data[0] : data) as
        | {
            show_name_label: string | null;
            show_name_sublabel: string | null;
            role_region_label: string | null;
            is_underground: boolean | null;
            can_show_name: boolean | null;
          }
        | null;
      if (error || !row) {
        setIdentity((p) => ({ ...p, loading: false }));
        return;
      }
      setIdentity({
        showNameLabel: row.show_name_label ?? null,
        showNameSublabel: row.show_name_sublabel ?? null,
        roleRegionLabel: row.role_region_label ?? null,
        isUnderground: !!row.is_underground,
        canShowName: !!row.can_show_name,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return identity;
}

// Single-line byline for the publish-shape reading card (§G / testimony
// preview). Pure passthrough of the server strings — no composition.
//   show_name   → "Minister Ruth James · Maranatha Ministries"
//   role_region → "A Minister from North America"
export function readingAttributionLine(
  identity: ComposeIdentity,
  attribution: Attribution,
): string {
  if (attribution === 'show_name') {
    const label = identity.showNameLabel ?? '';
    return identity.showNameSublabel
      ? `${label} · ${identity.showNameSublabel}`
      : label;
  }
  return identity.roleRegionLabel ?? '';
}

// Author block for the live LeaderWordCard preview (word type). Mirrors the
// published card exactly: the Replant seal avatar + the frozen byline in the
// name slot + the church sublabel (attribution is frozen at publish — the
// feed never renders a leader initial for these cards).
export function previewAuthor(
  identity: ComposeIdentity,
  attribution: Attribution,
): { seal: true; name: string; church: string } {
  if (attribution === 'show_name') {
    return {
      seal: true,
      name: identity.showNameLabel ?? '',
      church: identity.showNameSublabel ?? '',
    };
  }
  return { seal: true, name: identity.roleRegionLabel ?? '', church: '' };
}
