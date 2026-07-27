// KAN-338 FE cutover — the seven reachable comment identity states, pinned.
// These mirror the get_comments v3 server contract (kan338_0006); if a
// server change shifts a state, this table is the tripwire.

import { MASKED_COMMENT_NAME, commentIdentity } from './CommentThreadLogic';

describe('commentIdentity — the 7-state truth table (KAN-338)', () => {
  it('1. none: square · real initial · real church', () => {
    const r = commentIdentity({
      display_name: 'Pastor Ife James', name_held: false,
      church_label: 'Maranatha Ministries', church_held: false, is_underground: false,
    });
    expect(r).toMatchObject({ displayName: 'Pastor Ife James', churchLine: 'Maranatha Ministries', round: false, glyph: 'initial', initial: 'P' });
  });

  it('2. anon + public church: square · "A" · real church line', () => {
    const r = commentIdentity({
      display_name: 'A fellow pastor', name_held: true,
      church_label: 'Maranatha Ministries', church_held: false, is_underground: false,
    });
    expect(r).toMatchObject({ displayName: 'A fellow pastor', churchLine: 'Maranatha Ministries', round: false, glyph: 'letterA' });
  });

  it('3. anon + UG safe: round · lock · region line (the fixed F1 state)', () => {
    const r = commentIdentity({
      display_name: 'A fellow pastor', name_held: true,
      church_label: 'South Asia', church_held: true, is_underground: true,
    });
    expect(r).toMatchObject({ round: true, glyph: 'lock', churchLine: 'South Asia' });
  });

  it('4. anon + UG brave: round · lock · real UG church line', () => {
    const r = commentIdentity({
      display_name: 'A fellow elder', name_held: true,
      church_label: 'Hidden Fellowship', church_held: false, is_underground: true,
    });
    expect(r).toMatchObject({ round: true, glyph: 'lock', churchLine: 'Hidden Fellowship' });
  });

  it('5. UG non-anon + safe: round · initial · region line', () => {
    const r = commentIdentity({
      display_name: 'Pastor Amara', name_held: false,
      church_label: 'Eastern Europe & Central Asia', church_held: true, is_underground: true,
    });
    expect(r).toMatchObject({ displayName: 'Pastor Amara', round: true, glyph: 'initial', initial: 'P' });
  });

  it('6. UG non-anon + brave: round · initial · real church line', () => {
    const r = commentIdentity({
      display_name: 'Bishop T', name_held: false,
      church_label: 'Hidden Fellowship', church_held: false, is_underground: true,
    });
    expect(r).toMatchObject({ round: true, glyph: 'initial', churchLine: 'Hidden Fellowship' });
  });

  it('7. no_church: round · lock · empty church line', () => {
    const r = commentIdentity({
      display_name: MASKED_COMMENT_NAME, name_held: true,
      church_label: '', church_held: true, is_underground: false,
    });
    expect(r).toMatchObject({ displayName: MASKED_COMMENT_NAME, churchLine: '', round: true, glyph: 'lock' });
  });
});

describe('commentIdentity — defensive fallbacks (server owns masking)', () => {
  it('legacy row without composed fields: renders author_name, never re-derives masking', () => {
    const r = commentIdentity({ author_name: 'Pastor Ife James', church_name: 'Maranatha Ministries', masked_region: null });
    expect(r).toMatchObject({ displayName: 'Pastor Ife James', churchLine: 'Maranatha Ministries', glyph: 'initial' });
  });

  it('legacy masked row: masked constant + lock, region line via masked_region', () => {
    const r = commentIdentity({ author_name: null, church_name: null, masked_region: 'South Asia' });
    expect(r).toMatchObject({ displayName: MASKED_COMMENT_NAME, churchLine: 'South Asia', round: true, glyph: 'lock' });
  });

  it('blank display_name falls through to the masked constant with a middle-dot initial guard', () => {
    const r = commentIdentity({ display_name: '   ', name_held: true, church_label: '', church_held: true, is_underground: false });
    expect(r.displayName).toBe(MASKED_COMMENT_NAME);
    expect(r.initial).toBe('A');
  });
});

describe('commentIdentity — avatar initial comes from the NAME, not the role prefix', () => {
  it('uses the server initial: "Bishop Ifeoluwa Arike" renders I, never B', () => {
    const r = commentIdentity({
      display_name: 'Bishop Ifeoluwa Arike', name_held: false,
      church_label: 'Blessings Abound Church', church_held: false,
      is_underground: false, avatar_initial: 'I',
    });
    expect(r.initial).toBe('I');
    expect(r.glyph).toBe('initial');
  });

  it('honours last-name-first preference via the server value', () => {
    const r = commentIdentity({
      display_name: 'Pastor Arike Ifeoluwa', name_held: false,
      church_label: 'Grace Chapel', church_held: false,
      is_underground: false, avatar_initial: 'A',
    });
    expect(r.initial).toBe('A');
  });

  it('legacy row without avatar_initial still renders (imprecise fallback)', () => {
    const r = commentIdentity({ author_name: 'Ifeoluwa Arike', church_name: 'Grace Chapel' });
    expect(r.initial).toBe('I');
  });
});
