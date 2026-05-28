// KAN-20 — display-label assertions for the church profile sheet.
// Guards the QA contract: church type renders as a human label, never a
// raw enum; congregation size maps to the dispatch labels.

import { getChurchTypeLabel, getCongregationSizeLabel } from './displayHelpers';

describe('getChurchTypeLabel (KAN-20 QA)', () => {
  it("renders branch as 'Church (Branch)' — never 'Church Branch'", () => {
    expect(getChurchTypeLabel('branch')).toBe('Church (Branch)');
    expect(getChurchTypeLabel('branch')).not.toBe('Church Branch');
  });

  it('renders the other known church types as labels', () => {
    expect(getChurchTypeLabel('house_church')).toBe('House Church');
    expect(getChurchTypeLabel('ministry')).toBe('Ministry');
    expect(getChurchTypeLabel('main_campus')).toBe('Church (Main Campus)');
  });

  it('falls through to the raw value for unknown types', () => {
    expect(getChurchTypeLabel('something_new')).toBe('something_new');
  });
});

describe('getCongregationSizeLabel (KAN-20)', () => {
  it('maps each enum value to its dispatch label', () => {
    expect(getCongregationSizeLabel('under_50')).toBe('Under 50');
    expect(getCongregationSizeLabel('50_to_200')).toBe('50–200');
    expect(getCongregationSizeLabel('200_to_500')).toBe('200–500');
    expect(getCongregationSizeLabel('over_500')).toBe('500+');
  });

  it('returns null for not_specified / null / unknown so the caller can omit', () => {
    expect(getCongregationSizeLabel('not_specified')).toBeNull();
    expect(getCongregationSizeLabel(null)).toBeNull();
    expect(getCongregationSizeLabel(undefined)).toBeNull();
    expect(getCongregationSizeLabel('weird')).toBeNull();
  });
});
