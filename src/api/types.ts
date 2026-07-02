// Shared API types — mirrors BE role enum.
//
// BE enum locked in supabase/functions/join-underground-church/logic.ts
// ROLES. Keep this list in lockstep.

export type Role =
  | 'pastor'
  | 'apostle'
  | 'prophet'
  | 'evangelist'
  | 'teacher'
  | 'elder'
  | 'bishop'
  | 'reverend'
  | 'intercessor'
  | 'psalmist'
  | 'ministry_leader'
  | 'other';
