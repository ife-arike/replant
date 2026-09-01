// KAN-346 — pins that the Settings form can never mount on defaults
// after a failed or empty self-row read.
import { classifySettingsRead } from './settingsLoad';

describe('classifySettingsRead (KAN-346)', () => {
  it('query error is error, even with data', () => {
    expect(classifySettingsRead({ message: 'boom' }, { anonymous: true })).toBe('error');
  });

  it('missing row is error, not defaults', () => {
    expect(classifySettingsRead(null, null)).toBe('error');
    expect(classifySettingsRead(null, undefined)).toBe('error');
  });

  it('a real row is ready', () => {
    expect(classifySettingsRead(null, { anonymous: true })).toBe('ready');
  });
});
