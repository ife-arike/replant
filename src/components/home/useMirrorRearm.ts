// ─────────────────────────────────────────────
// useMirrorRearm — makes the offscreen-mirror measurement DETERMINISTIC.
//
// The read-on/fold cue depends on one onTextLayout event from a hidden
// mirror <Text>. On Fabric that event can fire during the mount commit
// BEFORE the JS listener is attached; when fonts are already warm there
// is no second layout pass, so the only event is lost and the cue never
// appears. The loss is a race — some launches win it, some don't — which
// is exactly the intermittent "read on went away again" symptom
// (Founder reports 2026-07-27 + 2026-07-28).
//
// Fix: shortly after first paint, remount the mirror node by bumping its
// key. A brand-new text node MUST lay out, so onTextLayout fires with the
// listener attached. If the first event already landed, the re-measure
// returns the same count and the newest-valid setState is a no-op. This
// PRESERVES the self-correcting-measurement ruling (never latch, take
// the newest valid measurement) — it just guarantees a measurement
// exists to take.
//
// Usage: const mirrorKey = useMirrorRearm([bodyText]);
//        <Text key={`m${mirrorKey}`} onTextLayout={...} ...>
// Deps: the same value(s) that reset naturalLines, so a content change
// re-arms alongside the reset.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';

const REARM_DELAY_MS = 60;

export function useMirrorRearm(deps: readonly unknown[]): number {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setKey((k) => k + 1), REARM_DELAY_MS);
    return () => clearTimeout(t);
    // The caller passes the content dep(s) the mirror measures — the same
    // list its naturalLines reset effect uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return key;
}
