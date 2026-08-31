// KAN-347 — pins the error-vs-empty contract for the reader surfaces.
import { classifyFetch } from './readerLoadState';

describe('classifyFetch (KAN-347)', () => {
  it('error wins, even when rows arrived alongside it', () => {
    expect(classifyFetch({ message: 'boom' }, [{ id: 1 }])).toBe('error');
    expect(classifyFetch({ message: 'boom' }, null)).toBe('error');
  });

  it('a successful call with rows is ready', () => {
    expect(classifyFetch(null, [{ id: 1 }])).toBe('ready');
  });

  it('a successful call with nothing is empty — never error, never ready', () => {
    expect(classifyFetch(null, [])).toBe('empty');
    expect(classifyFetch(null, null)).toBe('empty');
    expect(classifyFetch(undefined, undefined)).toBe('empty');
  });
});
