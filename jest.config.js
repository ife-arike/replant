// KAN-83 — Jest config (initial FE test stack scaffold).
//
// Preset = jest-expo: matches the Expo/RN ecosystem (TS + JSX out of the
// box, babel-jest transform, native module mocks where applicable). The
// helper being tested (`src/utils/getLeaderDisplayName.ts`) is pure and
// doesn't exercise the RN parts of the preset, but using jest-expo keeps
// the door open for future component tests without re-configuring.
//
// `testMatch` is constrained to `src/**` so the Deno test files inside
// `supabase/functions/*/` are NOT picked up (they import from
// `https://...` URLs and use the Deno global — Jest would explode).

module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
};
