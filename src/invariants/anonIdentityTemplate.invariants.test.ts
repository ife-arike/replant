// KAN-349 tripwire — the "A fellow …" anon-identity template lives in
// exactly ONE client-side place: utils/displayHelpers.anonLeaderLabel().
// Server-composed strings (get_comments v3 et al.) arrive over the wire;
// any NEW inline client composition re-opens the drift the 2026-08-10
// audit found (three simultaneous renderings of one identity string).
// If the Founder rules the church surfaces onto server passthrough, the
// helper's call sites are the complete migration inventory — this test
// keeps that inventory complete.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..');
const ALLOWED = join('utils', 'displayHelpers.ts');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

// Comment-aware scan: strips // comments and /* … */ spans (including
// multi-line JSX block comments) before looking for the literal, so
// documentation may NAME the pattern while code may not COMPOSE it.
function codeLineHits(content: string, literal: string): number[] {
  const hits: number[] = [];
  let inBlock = false;
  content.split('\n').forEach((line, i) => {
    let code = line;
    if (inBlock) {
      const end = code.indexOf('*/');
      if (end === -1) return;
      code = code.slice(end + 2);
      inBlock = false;
    }
    code = code.replace(/\/\/.*$/, '');
    let open = code.indexOf('/*');
    while (open !== -1) {
      const close = code.indexOf('*/', open + 2);
      if (close === -1) {
        code = code.slice(0, open);
        inBlock = true;
        break;
      }
      code = code.slice(0, open) + code.slice(close + 2);
      open = code.indexOf('/*');
    }
    if (code.includes(literal)) hits.push(i + 1);
  });
  return hits;
}

describe('anon identity template single-owner (KAN-349)', () => {
  it("no file outside displayHelpers composes 'A fellow ' inline", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.endsWith(ALLOWED)) continue;
      for (const line of codeLineHits(readFileSync(file, 'utf8'), 'A fellow ')) {
        offenders.push(`${file}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
