// persecutedNewLogic tests — tier system + continent filter
// (design_handoff_persecuted_NEW; Founder rulings 2026-07-26).

import { Colors } from '../../../constants/theme';
import {
  ALL_CONTINENTS,
  PERSECUTED_TABS,
  continentOptions,
  feedSectionLabel,
  isFilledTier,
  pulsesTier,
  tierTint,
  tierWord,
} from './persecutedNewLogic';

describe('tier system — two intensities, one pulse', () => {
  it('fills only the top two tiers (plus the legacy alias)', () => {
    expect(isFilledTier('critical')).toBe(true);
    expect(isFilledTier('urgent')).toBe(true);
    expect(isFilledTier('active_persecution')).toBe(true);
    expect(isFilledTier('serious')).toBe(false);
    expect(isFilledTier('ongoing')).toBe(false);
    expect(isFilledTier('informational')).toBe(false);
  });

  it('tier word is the sender’s choice — critical never reads "Active"', () => {
    expect(tierWord('critical')).toBe('Critical');
    expect(tierWord('active_persecution')).toBe('Critical');
    expect(tierWord('urgent')).toBe('Urgent');
    expect(tierWord('informational')).toBe('Informational');
  });

  it('red for the top two, brightness below', () => {
    expect(tierTint('critical')).toBe(Colors.red);
    expect(tierTint('urgent')).toBe(Colors.red);
    expect(tierTint('serious')).toBe('rgba(240,237,230,0.72)');
    expect(tierTint('ongoing')).toBe('rgba(240,237,230,0.55)');
    expect(tierTint('informational')).toBe('rgba(240,237,230,0.42)');
  });

  it('only critical pulses', () => {
    expect(pulsesTier('critical')).toBe(true);
    expect(pulsesTier('active_persecution')).toBe(true);
    expect(pulsesTier('urgent')).toBe(false);
    expect(pulsesTier('serious')).toBe(false);
  });
});

describe('continent filter — derived from the feed, Antarctica-free by construction', () => {
  const rows = [
    { continent: 'Asia' },
    { continent: 'Africa' },
    { continent: null },
    { continent: 'Asia' },
  ];

  it('derives sorted distinct continents behind the all option', () => {
    expect(continentOptions(rows)).toEqual([ALL_CONTINENTS, 'Africa', 'Asia']);
  });

  it('empty feed yields only the all option', () => {
    expect(continentOptions([])).toEqual([ALL_CONTINENTS]);
  });

  it('section label doubles as the heading', () => {
    expect(feedSectionLabel(ALL_CONTINENTS)).toBe('Heartcries from the body');
    expect(feedSectionLabel('Africa')).toBe('Heartcries from Africa');
  });
});

describe('tab set', () => {
  it('three tabs, My Voice is not one of them', () => {
    expect(PERSECUTED_TABS.map((t) => t.id)).toEqual(['heartcries', 'witnesses', 'takeheart']);
    expect(PERSECUTED_TABS.map((t) => t.label)).toEqual(['Heartcries', 'Witnesses', 'Take heart']);
  });
});
