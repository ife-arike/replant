// AUTO-GENERATED from FLAG_TAXONOMY secret. Do not edit manually.
// Regenerate via supabase/functions/_shared/gen-taxonomy-codes.ts
// Pattern strings are NEVER included here per AC-12 pattern secrecy.
// taxonomy_version: 1.0.0

export const TAXONOMY_VERSION = "1.0.0";

export const TAXONOMY_CODES = [
  { code: "location_disclosure",    source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "identity_probe",         source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "opsec_violation",        source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "recantation_pressure",   source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "slander_or_gossip",      source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "bribery_attempt",        source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "duress_signal",          source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "imminent_threat",        source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "urgent_safety_request",  source_prefix: "auto",   tier: 1, routing: "admin"    },
  { code: "self_harm_indicator",    source_prefix: "auto",   tier: 1, routing: "pastoral" },
  { code: "false_teaching",         source_prefix: "auto",   tier: 2, routing: "admin"    },
  { code: "divisive_speech",        source_prefix: "auto",   tier: 2, routing: "admin"    },
  { code: "spiritual_coercion",     source_prefix: "auto",   tier: 2, routing: "admin"    },
  { code: "threats",                source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "hate_or_targeting",      source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "fundraising",            source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "financial_exploitation", source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "external_link",          source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "spam_pattern",           source_prefix: "auto",   tier: 3, routing: "admin"    },
  { code: "self_harm",              source_prefix: "auto",   tier: 2, routing: "pastoral" },
  { code: "pastoral_care_signal",   source_prefix: "auto",   tier: 2, routing: "pastoral" },
  { code: "idolatry_promotion",     source_prefix: "manual", tier: 3, routing: "admin"    },
  { code: "occult_reference",       source_prefix: "manual", tier: 3, routing: "admin"    },
  { code: "drunkenness",            source_prefix: "manual", tier: 3, routing: "admin"    },
] as const;

export type TaxonomyCodeMeta = typeof TAXONOMY_CODES[number];
export type TaxonomyCodeName = TaxonomyCodeMeta["code"];
export type TaxonomyRouting = TaxonomyCodeMeta["routing"];
export type TaxonomyTier = TaxonomyCodeMeta["tier"];
