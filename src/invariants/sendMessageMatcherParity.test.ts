// Tripwire: send-branch-message ships byte-identical copies of
// send-message's matcher.ts + taxonomy.ts (the KAN-214 OQ-3 ruling keeps
// the two edge functions isolated; unifying the copies into _shared/ is
// Phase 3 of the 2026-08-10 code-health remediation). Until that lands,
// any fix applied to one copy MUST be applied to the other —
// DELIVER-ALWAYS pastoral flagging rides on these files for BOTH DM
// surfaces, and only send-message's copy has a behavioural test suite.
// This test fails the moment the copies diverge, forcing the twin edit
// (or a deliberate, reviewed divergence that updates both files AND
// retires this tripwire).
import { readFileSync } from 'fs';
import { join } from 'path';

const FN_ROOT = join(__dirname, '..', '..', 'supabase', 'functions');

const read = (fn: string, file: string) =>
  readFileSync(join(FN_ROOT, fn, file), 'utf8');

describe('send-message ↔ send-branch-message matcher parity', () => {
  it.each(['matcher.ts', 'taxonomy.ts'])(
    '%s is byte-identical across both edge functions',
    (file) => {
      expect(read('send-branch-message', file)).toBe(read('send-message', file));
    },
  );
});
