#!/usr/bin/env -S deno run --allow-read --allow-write
// KAN-124 codegen — emits the FE-safe taxonomy-codes.ts mirror from a
// FLAG_TAXONOMY JSON file. Pattern strings are stripped by construction
// per AC-12 pattern secrecy — `patterns` is NEVER written to the output.
//
// Operator usage:
//
//   deno run --allow-read --allow-write \
//     supabase/functions/_shared/gen-taxonomy-codes.ts \
//     --in flag_taxonomy_secret.json \
//     --out supabase/functions/_shared/taxonomy-codes.ts
//
// CI drift check (forward-track): run with the live FLAG_TAXONOMY
// secret content, diff against committed taxonomy-codes.ts; fail loud
// on drift. Not wired here — separate OPS pass.

interface TaxonomyCode {
  code: string;
  source_prefix: "auto" | "manual";
  tier: 1 | 2 | 3;
  routing: "admin" | "pastoral";
  patterns: string[];
}

interface Taxonomy {
  taxonomy_version: string;
  codes: TaxonomyCode[];
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = "";
  let output = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") input = argv[++i] ?? "";
    else if (argv[i] === "--out") output = argv[++i] ?? "";
  }
  if (!input || !output) {
    console.error(
      "Usage: gen-taxonomy-codes --in <flag_taxonomy_secret.json> --out <taxonomy-codes.ts>",
    );
    Deno.exit(2);
  }
  return { input, output };
}

function quote(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

const { input, output } = parseArgs(Deno.args);
const raw = await Deno.readTextFile(input);
const taxonomy = JSON.parse(raw) as Taxonomy;

// Validation: refuse to emit if shape is wrong. CI guards against a
// half-broken secret silently producing a half-broken mirror.
if (typeof taxonomy.taxonomy_version !== "string" || !Array.isArray(taxonomy.codes)) {
  console.error("Invalid taxonomy shape — expected { taxonomy_version, codes }");
  Deno.exit(3);
}

// Width-align the 4 metadata columns for human-readability — the file
// is committed and reviewed.
const widths = {
  code: Math.max(...taxonomy.codes.map((c) => c.code.length)),
  source: Math.max(...taxonomy.codes.map((c) => c.source_prefix.length)),
  routing: Math.max(...taxonomy.codes.map((c) => c.routing.length)),
};

const lines: string[] = [
  "// AUTO-GENERATED from FLAG_TAXONOMY secret. Do not edit manually.",
  "// Regenerate via supabase/functions/_shared/gen-taxonomy-codes.ts",
  "// Pattern strings are NEVER included here per AC-12 pattern secrecy.",
  `// taxonomy_version: ${taxonomy.taxonomy_version}`,
  "",
  `export const TAXONOMY_VERSION = ${quote(taxonomy.taxonomy_version)};`,
  "",
  "export const TAXONOMY_CODES = [",
];

for (const c of taxonomy.codes) {
  const codePadded = (quote(c.code) + ",").padEnd(widths.code + 4);
  const sourcePadded = (quote(c.source_prefix) + ",").padEnd(widths.source + 4);
  const routingPadded = quote(c.routing).padEnd(widths.routing + 2);
  lines.push(
    `  { code: ${codePadded} source_prefix: ${sourcePadded} tier: ${c.tier}, routing: ${routingPadded} },`,
  );
}

lines.push("] as const;");
lines.push("");
lines.push("export type TaxonomyCodeMeta = typeof TAXONOMY_CODES[number];");
lines.push('export type TaxonomyCodeName = TaxonomyCodeMeta["code"];');
lines.push('export type TaxonomyRouting = TaxonomyCodeMeta["routing"];');
lines.push('export type TaxonomyTier = TaxonomyCodeMeta["tier"];');
lines.push("");

await Deno.writeTextFile(output, lines.join("\n"));

// SAFE-LOG: code count + taxonomy_version. No patterns. No code names.
console.log(
  `Wrote ${taxonomy.codes.length} codes (taxonomy_version=${taxonomy.taxonomy_version}) to ${output}`,
);
