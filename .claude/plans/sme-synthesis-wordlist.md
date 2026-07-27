# FLAG_TAXONOMY Wordlist — Starter Patterns (v0.draft)

> **AC-12 note:** this file contains regex pattern strings. **Do NOT commit this file to git.** Transfer the pattern lists into `/Users/ife/replant/flag_taxonomy_secret.json`, bump `taxonomy_version` to 1.1.0, regenerate `taxonomy-codes.ts`, and delete this file (or move to a gitignored location). Per AC-12 secrecy invariant, patterns never live in any committed file.

## How to use

Each pattern below is a literal lowercase phrase. The matcher wraps it with `\b...\b` boundaries (currently — see Matcher hardening section) and applies the `i` flag. NFKC + whitespace collapse runs first. **You don't need to write regex source — write plain phrases. The matcher escapes metacharacters.**

These are *starter* lists drawn from published research, open T&S catalogs, and academic literature. Calibrate against your own admin queue once shipped — drop patterns that over-fire on legitimate Replant traffic, add patterns you see actually appearing. The first 90 days of live observation are the real calibration.

Sources drawn from: Columbia C-SSRS framework, Joiner's Interpersonal Theory of Suicide, QPR / ASIST / Mental Health First Aid framings, Klonsky & Nock NSSI literature, Hassan's BITE model, Lifton's thought-reform criteria, Wade's *Spiritual Abuse Recovery*, Johnson & VanVonderen's *Subtle Power of Spiritual Abuse*, Oakley & Kinmond's *Breaking the Silence*, Apostles' Creed minimum-affirmation floor, FBI IC3 419 advisory, OWASP Phishing reference, Stripe Radar published rules, FTC CAN-SPAM enforcement language, Perspective API methodology, Discord T&S Open Hub, Unicode TR39 confusables.

---

## Source-prefix posture changes (LOCKED 2026-06-30)

Flip ONLY `false_teaching` from `auto:` to `manual:` (mirrors existing `idolatry_promotion` / `occult_reference` / `drunkenness`):

| Code | Posture | Reason |
|---|---|---|
| `false_teaching` | **`manual:`** | Cross-tradition fairness — Apostles' Creed floor only; doctrinal adjudication is human work across 10+ traditions; same-string-opposite-intent risk. Admins reviewing other-flagged content can manually tag with this for forensic completeness. |
| `threats` | **`auto:`** with patterns below | Non-imminent threats (future / conditional / intimidation) are distinct from imminent_threat. Ship the starter patterns. |
| `spam_pattern` | **`auto:`** with patterns below + separate Jira for velocity layer | Templated openers ARE phrase-detectable; ship that subset. File backend velocity-based detection as separate Jira. |
| `pastoral_care_signal` | **`auto:`** with curated patterns below + 30-day calibration commitment | Patterns drafted to minimize lawful-lament FPs; calibrate aggressively from admin disposition data in first 30 days; drop patterns that over-fire. |

**Note on `manual:` semantics:** `manual:` means the matcher SKIPS the code entirely — no messages auto-fire it, no patterns evaluated. The code exists in the taxonomy so admins can apply it as a forensic tag when reviewing messages flagged by OTHER codes. Manual codes are NOT a discovery surface; there is no entry point if there are no patterns.

---

## Pattern lists per code

### `self_harm_indicator` (T1, pastoral) — additions to existing 30 patterns

Sources: Columbia C-SSRS, Joiner Interpersonal Theory of Suicide (hopelessness + burdensomeness), QPR, Mental Health First Aid.

**Hopelessness cluster:**
```
no hope left
there's no hope
there is no hope
nothing matters anymore
what's the point anymore
why bother anymore
no reason to keep going
ready to give up
```

**Burdensomeness cluster (Joiner predictor):**
```
i'm a burden
i am a burden
a burden to everyone
everyone would be relieved
world would be better without me
they'd be better off without me
better off without me
```

**Passive death wishes (clinically high-risk):**
```
wish i were dead
wish i was dead
wish i'd never been born
don't want to wake up
hope i don't wake up
ready to die
```

**Tired-cluster siblings to existing "tired of living":**
```
tired of being alive
tired of this life
can't take this anymore
```

**Method ideation (C-SSRS escalation markers):**
```
thought about pills
thinking about pills
thinking about ending
thinking about ending it
writing my goodbyes
saying my goodbyes
```

**Tighten — review for replacement:**
- Existing `"saying goodbye"` → replace with `"saying my goodbyes"` (higher precision — eliminates travel/transition FPs)
- Keep existing `"end it all"` / `"can't go on"` / `"can't do this anymore"` despite known FPs on Christian-leader corpus; FN cost dominates per Columbia consensus

---

### `self_harm` (T2, pastoral) — starter set

Sources: Klonsky & Nock NSSI research; DBT clinical lexicon; published self-injury epidemiology.

**Non-suicidal self-injury (NSSI) explicit:**
```
cutting myself
cut myself
cutting my arms
cutting my legs
cutting my wrists
burning myself
burn myself
hurting myself
hurt myself again
scratching myself
punching myself
punching walls until
hitting my head against
```

**Disordered eating + self-starvation:**
```
starving myself
stopped eating again
haven't eaten in days
making myself throw up
purging again
relapsed on purging
```

**Self-destructive substance use:**
```
drinking until i black out
drinking myself to
taking too many pills
overdosing on
mixing pills with
```

**NSSI relapse markers:**
```
self harm again
self-harm again
relapsed on cutting
started cutting again
the urges are back
```

---

### `pastoral_care_signal` (T2, pastoral) — starter set

Sources: pastoral counseling literature (Stone's *Crisis Counseling*, Hsu's *Reaching Out*); MHFA framing of "explicit distress disclosure"; published lament-vs-distress markers.

**Recommend ship `manual:` at MVP** given the high-FP risk against Christian lament — but starter set provided if you want auto:

**Explicit distress disclosure:**
```
i'm not okay
i am not okay
i'm not doing okay
i'm not doing well
i'm struggling
i am struggling
i'm really struggling
i'm drowning
i can't breathe
i feel like i'm drowning
```

**Spiritual struggle markers:**
```
i can't pray
i can't even pray
losing my faith
i'm losing my faith
doubting everything
where is god
where is God in this
my faith is shaking
```

**Isolation / disconnection:**
```
i feel so alone
no one understands
everyone has abandoned me
i feel abandoned
nothing makes sense anymore
i don't know what to do
```

**Burnout / exhaustion:**
```
i'm exhausted
i'm so tired
i can't do this alone
i need help
i need someone
```

**Pastoral check-in invitations (distress-paired only — bare "please pray for me" dropped because near-100% FP on a leader-DM corpus):**
```
please pray for me i'm at my limit
please pray for me i don't know what to do
please pray for me i can't keep going
i need someone to pray with me right now
i need urgent prayer
```

**Calibration commitment:** drop patterns from disposition data in first 30 days. The high-FP risk on lawful lament is the load-bearing concern — be willing to drop half of the starter list if admin data shows them firing mostly on legitimate prayer requests.

---

### `false_teaching` (T2, admin) — Apostles' Creed floor

**Recommend ship `manual:` at MVP** — but if you ship `auto:`, restrict to universal-heresy floor. Any tradition (Roman Catholic / Eastern Orthodox / Oriental Orthodox / Anglican / Lutheran / Reformed / Methodist / Baptist / Pentecostal / Anabaptist) would call these heresy.

**Trinitarian denials:**
```
jesus was just a man
jesus is just a man
jesus was only a man
jesus is only a man
jesus is merely a man
jesus was just a prophet
jesus was only a prophet
jesus was only a teacher
jesus was not god
jesus is not god
the holy spirit is not god
holy spirit was not god
the father is not god
there is no trinity
deny the trinity
god is only one person
```

**Resurrection denials:**
```
jesus did not rise
jesus didn't rise
jesus didn't resurrect
the resurrection is a metaphor
the resurrection is a symbol
the resurrection is a myth
resurrection was a myth
the resurrection never happened
```

**Prosperity-gospel-as-required-for-salvation:**
```
you must pay to be saved
you must tithe to be saved
you must give to be saved
salvation requires a donation
salvation requires a payment
jesus died so you would be rich
jesus died so we would be wealthy
poverty is lack of faith
being poor means lack of faith
god will not save you unless you give
god won't save you unless you pay
```

**Pelagian works-only (the floor — not Catholic/Orthodox cooperation-with-grace):**
```
salvation is by works alone
grace is not necessary for salvation
grace is not needed for salvation
```

**Docetic christological denials (the floor — does NOT catch Coptic/OO miaphysite formulae):**
```
jesus only seemed to suffer
jesus only seemed to die
christ was not truly human
christ was not truly man
```

**Tradition-fairness invariants (DO NOT add patterns for):** speaking in tongues, paedobaptism, credobaptism, Real Presence, free will / predestination, Marian doctrines, sola Scriptura, eschatology variants, episcopal/presbyterian/congregational polity, sanctification distinctives, mode of baptism, Lord's Supper frequency.

---

### `divisive_speech` (T2, admin) — personal/factional contempt

Sources: harassment research (Pew Online Harassment studies), Perspective API "identity attack" framing adapted to inter-Christian contempt.

**"Real Christians" gatekeeping:**
```
real christians don't
real christians won't
real christians never
no real christian would
not a real christian
not a true christian
real believers don't
true believers don't
true believers never
```

**Denomination-blanket dismissal:**
```
catholics are not saved
catholics are not christian
catholics are not believers
protestants are not saved
pentecostals are not saved
orthodox are not saved
baptists are not saved
methodists are not saved
anglicans are not saved
lutherans are not saved
reformed are not saved
```

**Denomination-blanket damnation:**
```
catholics are all heretics
catholics are all apostates
catholics are all going to hell
protestants are all heretics
pentecostals are all heretics
orthodox are all heretics
baptists are all heretics
all catholics are damned
all protestants are damned
all pentecostals are damned
every catholic is
every protestant is
every pentecostal is
```

**Personal contempt for leaders by tradition:**
```
those people aren't really
they're not really christians
they're not really saved
they're not really believers
damned for their theology
damned for their denomination
doomed for their doctrine
going to hell for their tradition
that pastor is a heretic
that pastor is a deceiver
that pastor is a wolf
that leader is a heretic
should be defrocked from
should be excommunicated from
should be removed from ministry
```

**Explicitly NOT included:** "I disagree with" / "Calvinism is false" / "the Reformation was a mistake" / cessationist-continuationist disputes / paedo-credo disagreement / any honest theological disagreement.

---

### `spiritual_coercion` (T2, admin) — cult-recovery & spiritual-abuse patterns

Sources: Hassan BITE model (Behavior-Information-Thought-Emotion control); Lifton's *Thought Reform* criteria; Wade's *Spiritual Abuse Recovery*; Johnson & VanVonderen's *Subtle Power of Spiritual Abuse*; Oakley & Kinmond's *Breaking the Silence*.

**"Touch not the Lord's anointed" weaponization:**
```
touch not the lord's anointed
touch not the anointed
touch not god's anointed
touch not my anointed
do not touch the anointed
```

**Questioning-as-sin:**
```
you cannot question your pastor
you can't question your pastor
you cannot question the pastor
you cannot question the man of god
you cannot question the anointed
you cannot question leadership
questioning me is questioning god
questioning the pastor is questioning god
questioning leadership is questioning god
questioning me is sin
questioning the pastor is sin
questioning leadership is rebellion
questioning leadership is witchcraft
rebellion is as the sin of witchcraft
```

**Debt-of-salvation:**
```
you owe me your salvation
you owe the pastor your salvation
you owe the church your salvation
you cannot be saved unless you submit
you cannot be saved unless you obey
you will not be saved unless you submit
you won't be saved unless you obey
to leave this church is to leave god
to leave this church is to leave christ
to leave this ministry is to leave god
leaving this church is leaving god
leaving this ministry is leaving christ
if you leave you will lose your salvation
if you leave you will lose your covering
no covering means no protection
outside this covering means no grace
outside the authority means no salvation
```

**Isolation / BITE behavior + information control:**
```
do not talk to unbelievers
don't talk to unbelievers
stop talking to unbelievers
do not associate with non-christians
cut off all contact with your family
sever all contact with your family
your family is a hindrance
your parents are a hindrance
your friends are a hindrance
do not read anything outside this church
don't read anything outside this church
don't consume teaching outside this ministry
do not listen to any other teaching
```

**Coerced giving / financial servitude:**
```
if you give more god will
unless you give enough god will not
if you tithe more god will
withholding your tithe is robbing god
withholding your offering is robbing god
you must give a specific amount
you need to give this amount
faith requires a seed
faith requires a sacrifice of
breakthrough requires a sacrifice of
breakthrough requires a seed
```

**Silencing abuse victims (Wade / Oakley-Kinmond):**
```
do not tell anyone what happened
do not speak of this to anyone
do not report this to anyone
this stays in the church
this stays in the ministry
what happened stays between us
reporting this is gossip
telling anyone is gossip
reporting this is slander
reporting this is disloyalty
telling is unforgiveness
you must forgive immediately
you must forgive and forget
real forgiveness means you don't speak
true forgiveness means you don't report
```

**Thought control / loyalty tests:**
```
doubting the ministry is sin
doubting the vision is demonic
doubting the pastor is sin
any doubt is from the enemy
any doubt is demonic
all doubt comes from the enemy
you are in rebellion
you are under a spirit of rebellion
you are under a spirit of jezebel
you are under a spirit of witchcraft
you have a critical spirit
```

**Founder edit 2026-06-30:** dropped `"rebellion is as the sin of witchcraft"` (1 Sam 15:23) from the starter set — too high FP on legitimate Pentecostal/Baptist spiritual-warfare teaching.

---

### `threats` (T3, admin) — non-imminent threats

Sources: T&S harassment taxonomy; legal-threat language patterns. Distinct from `imminent_threat` which catches real-time danger ("they are at the door"). This bucket catches future/conditional/intimidation.

```
i will hurt you
i will hurt your family
i will make you pay
you will pay for this
your family will pay
you will regret this
you'll regret this
i know where you live
i know where your family lives
i know where your church meets
watch your back
watch your family
be careful what you say
be careful where you go
something will happen to you
something will happen to your family
you don't know who you're dealing with
you don't know what i can do
next time it will be worse
this isn't over
we'll meet again
i won't forget this
you will face consequences
consequences for your family
i'll be coming for you
coming after your family
```

---

### `hate_or_targeting` (T3, admin) — generalized group degradation

Source: Perspective API "identity attack" attribute methodology (publicly published). Structural patterns, NOT a slur list. Replant corpus IS persecution testimony — slur-list approach would overfire on every leader describing violence they survived.

**Categorical attack cadences:**
```
all muslims are
all jews are
all christians are
all hindus are
all buddhists are
all atheists are
should be wiped out
should be eliminated
should be removed from this country
go back to where you came from
go back to your country
they all deserve what
people like them deserve
deserve what's coming
```

**Categorical dehumanization markers:**
```
are not even human
are subhuman
are not really human
are like animals
are nothing but
```

---

### `fundraising` (T3, admin)

Sources: Stripe Radar published solicitation rules; FTC CAN-SPAM enforcement language patterns.

**Explicit-ask-with-rails:**
```
send funds to
send money to
gcash number
gcash account
venmo me
cashapp me
zelle me
my paypal is
my paypal account
my gofundme
my patreon
donate to my
donate to our
support our ministry at
contribute to our cause
your financial gift
your love offering
seed offering of
wire transfer to
bank transfer to
western union to
moneygram to
my account number is
my routing number is
```

**Crypto wallets:** not regex-friendly as phrase patterns. Recommend separate matcher-layer regex family detecting hex/base58 strings of wallet-address length (post-MVP — file as separate Jira).

---

### `financial_exploitation` (T3, admin) — 419 / advance-fee

Sources: FBI IC3 419 advisory; OWASP Phishing reference appendix; Sophos and Trend Micro published scam corpora.

```
next of kin
sum of us$
sum of us dollars
late client
deceased relative
deceased customer
inheritance fund
unclaimed funds
unclaimed deposit
late father deposited
late uncle deposited
beneficiary of the funds
beneficiary of the inheritance
i am a barrister
i am an attorney
attorney to the late
diplomatic delivery
consignment box
blessed brother in christ
greetings to you in jesus name
i write with utmost confidence
strictly confidential business
```

**Founder edit 2026-06-30:** dropped `"my dear beloved in christ"` (legitimate West African + South Asian ministry salutation). Spam_pattern templated-opener list catches similar 419 cadences without burning the legitimate-salutation FP.

---

### `external_link` (T3, admin) — URL detection at matcher layer

Not a phrase list. One regex family added to matcher, evaluated after `collectMatches`. URL detection + citation allowlist for scripture hosts.

```js
// Add to matcher.ts after pattern collection:
const EXTERNAL_LINK_RE = /(?<![@\w])\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|co|app|dev|link|me|ly|gg|tv|biz|info|us|uk|de|fr|jp|ng|in|br|cn|kr|ph|sg|hk|tw|mx|pl|ru|tr|sa|ae|eg|za|ke|cm))[^\s]*/i;

const CITATION_ALLOWLIST = [
  'biblegateway.com', 'youversion.com', 'bible.com',
  'esv.org', 'blueletterbible.org', 'biblehub.com',
  'projectreplant.org', 'projectreplant.com',
  'openbible.info', 'crosswalk.com',
];

// In collectMatches, after existing match loop:
const linkMatch = normalized.match(EXTERNAL_LINK_RE);
if (linkMatch) {
  const host = extractHost(linkMatch[0]);
  if (!CITATION_ALLOWLIST.some(allowed => host.endsWith(allowed))) {
    matches.push({ code: 'external_link', ... });
  }
}
```

---

### `spam_pattern` (T3, admin) — templated-opener subset

Real spam detection is velocity-based, not phrase-based. But the obvious copy-paste-spam openings ARE phrase-detectable. Ship this subset; file velocity-based detection as separate Jira.

```
dear friend my name is
greetings in the name of our lord
dear beloved one
compliments of the day to you
i hope this email meets you in good
i hope this message meets you well
permit me to introduce myself
i got your contact from
your contact was given to me
i was referred to you by
i found your contact through
how are you and your family doing today
trust this message finds you well
```

These overlap with `financial_exploitation` (419) intentionally — same shape, multiple flag_reasons stack.

---

## Normalization preamble (integrated SEC + I18N + CONTENT)

Replace current `normalizeForMatching` in `supabase/functions/send-message/matcher.ts` (and the parallel file in `send-branch-message`):

```ts
export function normalizeForMatching(content: string): string {
  // 1. Detect dominant scripts present
  const scripts = detectScripts(content);  // returns Set<'Latin'|'Han'|'Arabic'|'Hangul'|'Devanagari'|'Cyrillic'|'Hebrew'|'Ge'ez'>
  
  // 2. Cross-script confusable defense — Cyrillic/Greek → Latin map
  //    Pragmatic 30-entry map for MVP; Unicode TR39 confusables for post-MVP
  let s = applyConfusableFold(content);
  
  // 3. Per-script normalization
  if (scripts.has('Han') || scripts.has('Hangul') || scripts.has('Arabic') 
      || scripts.has('Hebrew') || scripts.has('Devanagari') || scripts.has('Ge'ez')) {
    s = s.normalize('NFC');
  } else {
    s = s.normalize('NFKC');
  }
  
  // 4. Per-script transformations
  if (scripts.has('Arabic')) {
    s = s.replace(/[ً-ْٰۖ-ۭ]/g, '');  // strip tashkeel
    s = s.replace(/ـ/g, '');                               // strip kashida
    s = s.replace(/ی/g, 'ي').replace(/ک/g, 'ك');  // Persian → Arabic letter fold
  }
  if (scripts.has('Hebrew')) {
    s = s.replace(/[֑-ׇ]/g, '');  // strip niqqud
  }
  if (scripts.has('Han')) {
    s = foldHanTradToSimp(s);  // via opencc-js
  }
  
  // 5. Strip zero-width + bidi controls (SEC bypass defense)
  s = s.replace(/[​-‏‪-‮⁠-⁤﻿]/g, '');
  
  // 6. Casefold via Unicode default (replaces /i regex flag)
  s = s.toLocaleLowerCase('und');
  
  // 7. Leet substitution (fill existing stub)
  s = applyLeetSubstitution(s);  // 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i
  
  // 8. Collapse ALL non-alphanumeric to single space (SEC \b bypass defense)
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  
  // 9. Final whitespace trim
  return s.replace(/\s+/g, ' ').trim();
}
```

Regex construction drops `\b` and uses leading/trailing space boundaries:
```ts
const re = new RegExp(`(?:^| )${escapeRegex(pattern)}(?: |$)`, '');
```

This defeats:
- `renounce.Jesus` / `renounce_Jesus` / `renounce-Jesus` (SEC Blocker 1 — punctuation insertion)
- `renou​nce Jesus` (SEC Blocker 2 — zero-width injection)
- `renounсe Jesus` with Cyrillic `с` (SEC Blocker 3 — homoglyph)
- Persian/Arabic letter variation (`ی` vs `ي`)
- Han Traditional vs Simplified mismatch
- Arabic tashkeel / Hebrew niqqud differences
- Case differences across non-bicameral scripts

---

## Pre-launch hardening checklist

1. **Apply normalization preamble** (above) to `send-message/matcher.ts` + `send-branch-message/matcher.ts`
2. **Fix admin FE drift:** revert `replant-admin/src/lib/taxonomy.js` `TAXONOMY_VERSION` to `'1.0.0'` + drop `financial_coercion` from `TIER_MAP` + `CODE_LABELS`
3. **Codegen validation:** extend `gen-taxonomy-codes.ts` to refuse upload if any pattern contains characters outside `[\p{L}\p{N} '\-]` (ReDoS defense at authoring layer)
4. **Inline comment** on `matcher.ts:149-150`: `// m.index and m[0] MUST stay internal — adding either to a log line leaks the wordlist.`
5. **Add `CODE_DESCRIPTIONS`** tooltip dictionary to admin FE (23 entries, ~30-line addition to `taxonomy.js`)
6. **Add admin chrome copy** *"A flag is visibility, not verdict"* to `Flagged.jsx` header + admin training doc
7. **Bump `taxonomy_version`** to 1.1.0 in `flag_taxonomy_secret.json` once patterns above are merged in

---

## Audit transparency framework (LOCKED 2026-06-30)

Founder load-bearing principle: *"we shouldnt be flagging/reviewing messages for any little reason because these people are supposed to feel safe in this space. the reason for us reading any messages should carry weight and we should easily be able to defend why."*

### Retention policy on audit reads

| Audit type | Retention |
|---|---|
| Life-safety codes (`self_harm_indicator`, `urgent_safety_request`, `imminent_threat`, `duress_signal`) — every read | **Forever** — defensible as ongoing care |
| ESCALATED flags (any code escalated to Manager queue) — every read | **Forever** — action consequence |
| CLEARED flags on all other codes — `flag_read` rows | **Age out at 30 days** — `pg_cron` daily sweep deletes rows older than threshold where action='flag_read' AND associated `messages.flag_status='cleared'` |

### Tier-gated content viewing (LOCKED 2026-06-30)

| Tier | Can see |
|---|---|
| Regular admin | Flagged-message line + chip + sender/receiver/church. CAN read the immediate flagged message to assess the signal. Expand-context (5+5 / full thread) button HIDDEN. BE returns 403 on direct call. |
| super_admin + Manager | Everything regular admin sees PLUS can expand to 5+5 context AND full thread. **Required justification field** (≥50 chars, scrubAndCap-bound) before expansion fires. |

**Honest framing:** any admin who opens the Flagged or Pastoral queue is, by definition, reading the messages that flagged — that's the queue's purpose. The tier line is at CONTEXT expansion (5+5 / full thread), not at the immediate flagged message itself. The disclosure surfaces below must reflect this honestly.

### Pre-expand disclaimer modal (LOCKED copy)

> **Opening additional context.**
> 
> Opening additional context is logged with your identity, the flag, your justification, and a timestamp. This action is reserved for investigating the claim that triggered the flag.
> 
> Misuse — opening for any reason other than investigating the flag — is grounds for immediate revocation of admin access.
> 
> Your justification will be visible in the audit log permanently.
> 
> [Justification: required, min 50 characters]
> 
> [Cancel] [Open context]

### New audit action

`flag_context_expanded` — added to `audit_log_action_check` constraint. Meta shape:
```json
{
  "range": "5+5" | "full_thread",
  "justification": "<scrubbed via scrubAndCap, capped 500 chars>",
  "flag_reason": "<original auto:code>",
  "message_id": "<uuid>",
  "viewer_tier": "super_admin" | "top_tier"
}
```

Audit row written BEFORE content loads (KAN-117 Third Option) — read is recorded even if the FE crashes mid-load.

### In-app disclosure surfaces

**Note:** Community Covenant + Privacy Policy are separate Founder-drafted v1 documents. My role is to propose disclosure additions for those drafts, not author them from scratch. The Connect first-message modal is its own copy surface (references the Covenant in a sentence or two).

**1. Connect first-message-ever modal — proposed copy:**

> Your messages reach the leaders you send them to. They also pass through a keyword screen for safety signals — pattern matching only, never AI reading content.
> 
> When a keyword flags, an admin may read the immediate message line to assess the signal. If something alarming is found, a Manager may expand to surrounding context or the full thread, with a justification recorded permanently in our records.
> 
> Cleared flags on non-safety codes age out of our records after 30 days. Safety-related signals (self-harm, urgent safety, imminent threat, duress) stay in our records for ongoing care.
> 
> Our Community Covenant explains this in fuller terms. You can ask what's been read about you at any time by emailing `accounts@projectreplant.org`.
> 
> [I understand]

**2. Community Covenant v1 — proposed addition for the Founder-drafted document:**

> **Reviewing your messages.**
> 
> Replant screens DMs and branch messages for keyword patterns related to safety, abuse, financial exploitation, and a small set of other categories defined in our Privacy Policy. No AI reads your content; only fixed keyword patterns.
> 
> When a pattern fires, an admin reads the immediate flagged message line to assess the signal. If something genuinely alarming is found, a Manager may expand to surrounding context or the full thread — and only with a written justification permanently recorded in our records.
> 
> We retain records of safety-related reads (self-harm, urgent safety, imminent threat, duress) for ongoing care. Records of reads on cleared non-safety flags are deleted from our system after 30 days.
> 
> If you want to know what's been read about you, email `accounts@projectreplant.org`.

**3. Privacy Policy v1 — proposed addition for the Founder-drafted document:**

Same essential content as the Covenant block above, expanded with:
- Full list of safety-related codes and what each catches (without revealing the patterns)
- Retention schedule for each audit type
- Who has access (admin vs Manager vs super_admin)
- Appeal/inquiry path

**4. CovenantStrip on every composer (existing; updated):**

Existing — *"Protected within the network · flagged keywords are reviewed"*

Proposed — *"Protected within the network · keyword flags reviewed by an admin"*

(Adds "by an admin" — small but honest.)

---

## Manual taxonomy tagging — admin UI affordance (NEW — required for `manual:` codes to be useful)

Currently the admin Flagged surface shows auto-fired flags. There's NO UI for admins to manually tag messages with additional codes. For `false_teaching` (`manual:`) and any future manual-tagging needs, this affordance is needed.

### Proposal

**Location:** Flagged.jsx row drawer (when expanded) + Escalated Cases row drawer (same pattern after KAN-293 lands).

**Affordance:** "Add taxonomy tag" button, Manager+ only (manual tagging is a forensic action; mirrors expand-context tier-gate).

**Modal:**

```
Title: Add a taxonomy tag
Body: Tag this message with an additional taxonomy code. The original flag remains. Both tags are recorded in the audit log with your identity, the reason you provided, and a timestamp.

Code: [dropdown of all 24 codes, excluding the one already firing]
Reason: [required, min 30 chars, scrubAndCap-bound]

[Cancel] [Add tag]
```

**BE endpoint:** `add-manual-flag-tag.js`
- Auth gate: `verifyAnyAdmin` + `assertAtLeast('super_admin')` (admits Manager + super_admin per matrix)
- AAL2: `regular_destructive` (30 min) — destructive in the forensic-record sense
- Body: `{ message_id, code, reason }`
- Validates `code` is in the canonical taxonomy code list
- Writes audit row FIRST: `flag_tagged_manually` action
- Adds to `messages.flag_reason` as comma-joined `manual:<code>` (matches the existing `auto:<code>` source-prefix convention per KAN-71 c.11405)

**New canonical audit action:** `flag_tagged_manually` — add to `audit_log_action_check` CHECK constraint. Meta shape:
```json
{
  "message_id": "uuid",
  "code_added": "false_teaching",
  "reason": "<scrubAndCap, ≤500 chars>",
  "original_flag_reason": "auto:spiritual_coercion",
  "tagging_admin": "uuid",
  "tagging_tier": "super_admin" | "top_tier"
}
```

**Display in queue:** flagged-message chips render BOTH `auto:` codes AND `manual:` codes when present, visually distinguished — auto chips in their existing color; manual chips with a small "M" prefix or different border treatment.

**Multiple manual tags:** allowed. An admin can add multiple codes to one message during investigation (e.g., spiritual_coercion + false_teaching + financial_exploitation on a particularly egregious case).

---

## Compensating controls (ship at MVP for English-only language coverage)

1. **In-app "Report this message" affordance** in DM thread (Connect tab) — recipient one-tap escalation to pastoral/admin queue. Compensates for non-English language gap (works in any language a recipient understands). Separate workstream after wordlist ships.
2. **"Pastoral Support" page in hamburger menu** — leader-initiated self-escalation. Replaces existing "Language" hamburger entry (redundant with Settings). Standing affordance, not fire-triggered. Content skeleton:
   - **"If you need someone"** — direct path to the pinned Replant Team thread in Connect
   - **Crisis resources by region** — Befrienders Worldwide (befrienders.org global directory), 988 Lifeline (US), Samaritans (UK 116 123), Crisis Text Line (text HOME to 741741), regional listings for persecution zones
   - **Practical care notes** — brief sections on sleep / sabbath / community / pacing under persecution
   - **Scripture for hard moments** — one quiet rotating verse
   - File as small separate CD brief after wordlist + Reporting flow.
3. **`non_latin_unmatched` observability flag** logged when a message contains non-Latin script and produced no regex matches. NO content logged (SAFE-LOG). Sizes the language-coverage gap empirically over first weeks of launch.
4. **Operator-facing language disclosure** in admin sidebar: *"Auto-flag coverage: English-language patterns at this release. Report-message escalation available in all languages."*

---

## Separate Jiras to file

1. **Velocity-based spam detection layer** — backend cross-message state tracking (NOT regex)
2. **Matcher infrastructure for multilingual readiness** — script-tagged patterns, per-language matcher hints, Han Trad↔Simp via `opencc-js`, native-speaker review pipeline (Tier-1 leader-volunteer with segregated identity per [[feedback-underground-protection-focus]] / Tier-2 Wycliffe-SIL-seminary partnerships / Tier-3 vendor stopgap)
3. **P0 UG-leak audit on 6 Netlify functions** — `list-flagged-messages` / `open-flagged-message` / `list-pastoral-queue` / `expand-pastoral-context` / `triage-pastoral-action` / `escalate-flag` / `clear-flag` — verify UG-exclusion gate per [[ug-flag-dual-source-bug]]
4. **Secret distribution + rotation framework** — 1Password vault, dual-control upload, quarterly review, SHA-256 hash verification, canary message post-deploy test, `audit_log action='taxonomy_updated'` row per update
5. **ReDoS runtime mitigation** (post-MVP) — `Promise.race(setTimeout(50))` per pattern; codegen validation (item 3 above) is the load-bearing defense

---

## SEC audit findings (added 2026-06-30 after re-dispatch)

SEC audited the locked decisions + live code. 3 BLOCKING findings discovered as **pre-existing prod gaps** (not new wordlist work — they predate this synthesis and live in prod today):

### F1 — BLOCKING — UG dual-source gate MISSING from every flagged-message admin path

Files: `list-flagged-messages.js` / `open-flagged-message.js` / `list-pastoral-queue.js` / `expand-pastoral-context.js` / `clear-flag.js` / `escalate-flag.js`. None check if sender/receiver is in a `churches.type='underground'` church. Non-UG admin reads UG content today.

**Mitigation:**
- Add `senderOrReceiverInUgChurch(supabaseAdmin, senderId, receiverId)` helper in `_lib/supabase-admin.js`
- In `list-flagged-messages.js` post-fetch: partition UG-touched vs non-UG-touched; for `!isUndergroundAdmin(jwt)` callers filter UG-touched OUT + set `omitted_count` field
- In `open-flagged-message.js` / `expand-pastoral-context.js` / `clear-flag.js` / `escalate-flag.js`: 403 + `flag_read` audit with `meta.failure_reason='forbidden_underground_admin'` BEFORE returning content
- RLS belt-and-braces: extend `messages_select_own` policy with UG predicate at the DB layer

### F2 — BLOCKING — Tier-gating for 5+5 / full thread is paper policy, not BE-enforced

`expand-pastoral-context.js` enforces AAL2 but NEVER checks `claims.admin_tier`. 50-char justification field doesn't exist. `flag_context_expanded` audit action doesn't exist in CANONICAL_ACTIONS or DB CHECK. A regular admin with a step-up token can hit `full_thread` and get the whole thread today.

**Mitigation:**
- In `expand-pastoral-context.js`: add `const tier = decodeJwtPayload(jwt)?.admin_tier; if (tier !== 'top_tier' && tier !== 'super_admin') return fail('Tier required', 403)` after AAL2 check
- Add `expansionLevel` validation: require `justification` field on `extended_5_5` + `full_thread` branches; reject `<50 chars` with 400; route through `scrubAndCap(justification, 500)`
- Migration: add `flag_context_expanded` + `flag_tagged_manually` to `audit_log_action_check` CHECK constraint
- Update CANONICAL_ACTIONS Set in `_lib/supabase-admin.js`
- `Flagged.jsx`: hide expand-context button entirely for `admin_tier === 'regular'`

### F3 — BLOCKING — `open-flagged-message.js` allows message_id enumeration past `flagged=true` gate

No rate limit (KAN-112 added one for LIST, not OPEN), no UG gate, no tier gate, audit writes on 404 paths polluting forensics.

**Mitigation:**
- Add Upstash rate-limit 60/min per admin (mirror `_lib/rate-limit.js` pattern from list-flagged-messages)
- Add UG gate from F1
- Add tier gate from F2 (regular OK for immediate message but log `viewer_tier` on audit row)
- Move audit write to AFTER the messages SELECT succeeds — don't pollute forensics with probed-but-missed UUIDs
- Audit row: add `flag_reason`, hash one side of the leader pair (sender or receiver) to limit pairing leak

**Sequencing implication:** F1 + F2 must merge BEFORE the Connect first-message modal + Covenant + Privacy Policy disclosure copy ships. The disclosure is a written promise the BE doesn't enforce.

### F4 — HIGH — ReDoS surface from content × patterns × normalization

600 patterns × 9 normalization passes × unbounded content length. Adversarial long-content spam under coordinated incident exhausts edge fn isolates.

**Mitigation:**
- Content length cap at 8000 chars in `validateBody`
- Codegen authoring-time char allowlist `[\p{L}\p{N} '\-]` in `gen-taxonomy-codes.ts` — refuses patterns with attack-surface chars at upload time
- Per-pattern runtime timeout deferred post-MVP

### F5 — HIGH — Secret single-point-of-failure on Founder's laptop (LOCKED 2026-06-30: 1Password)

`flag_taxonomy_secret.json` lives only at `/Users/ife/replant/flag_taxonomy_secret.json`. Laptop dies = wordlist lost; compromised = AC-12 breached.

**Mitigation:**
- 1Password vault entry "REPLANT_FLAG_TAXONOMY_v1.x.x" — Founder + accounts@ only; canonical recovery copy
- Add `sha256` field to JSON header; verify at codegen
- Quarterly rotation cadence on the OPS calendar
- Compromise playbook: treat patterns as known-evaded → bump `taxonomy_version` major → ship next-gen wordlist from 1Password staging → forensic query of suspicious near-misses in prior N days
- New canonical audit action: `taxonomy_updated` written manually on every secret rotation

### F6 — HIGH — `flag_reason` reverse-engineering surface for compromised admin

Cross-admin reading of `flag_reason` + content lets compromised admin derive patterns by clustering. Accept as residual risk SO LONG AS F1-F3 merge. Defer `flag_reason_hash` HMAC post-MVP.

### F7 — STANDARD — Disclosure copy granularity (LOCKED 2026-06-30)

Current Connect CovenantStrip already vague + safe — *"Conversations within Replant are governed by our community covenant. Chats are protected within the network. Keywords flagged for review if misuse is detected."* — NO CHANGE.

Simplified first-message MODAL (Founder ratified — referenced not restated):

> Replant screens DMs for safety-related keyword patterns. You'll see this once. See the Community Covenant for the full picture, including what's read and how long records stay.
> 
> You can ask what's been read about you at any time by emailing `accounts@projectreplant.org`.
> 
> [I understand]

Community Covenant v1 — proposed addition for the Founder-drafted document — drop the parenthetical category list (self-harm / urgent safety / imminent threat / duress); use *"safety-related signals"* generically. Full text:

> **Reviewing your messages.**
> 
> Replant screens DMs and branch messages for keyword patterns related to safety and a small number of integrity categories. No AI reads your content; only fixed keyword patterns.
> 
> When a pattern fires, an admin reads the immediate flagged message line to assess the signal. If something genuinely alarming is found, a Manager may expand to surrounding context or the full thread — and only with a written justification permanently recorded.
> 
> Safety-related signals stay in our records for ongoing care. Records of reads on cleared non-safety flags are deleted from our system after 30 days.
> 
> If you want to know what's been read about you, email `accounts@projectreplant.org`.

Privacy Policy v1 — categories named not code names; full code list lives in Founder-only operations doc for regulatory defense if asked.

### F8 — STANDARD — `flag_context_expanded` justification field = content-exfil surface

Admin could copy-paste 500 chars of message content INTO the justification field, durably stored in audit. `scrubAndCap` redacts email/URL/IP/phone but NOT arbitrary content.

**Mitigation (LOCKED 2026-06-30 — SOFT):**
- Admin-facing guidance copy in the justification modal: *"Do not paste message content into this field. Describe in your own words why you're opening additional context."*
- Monthly OPS anomaly query for high-cosine-similarity justifications against the referenced `messages.content`
- Hard Levenshtein gate deferred — preserves admin autonomy + creates forensic signal without blocking legitimate paraphrases

---

## Decisions locked 2026-06-30

1. **SEC matcher hardening blocks MVP launch.** Normalization preamble + drop `\b` + confusable fold + zero-width strip lands BEFORE any MVP launch.
2. **No paid advisory.** Outreach to Open Doors USA / VOM / Persecution.org pastoral-care arms via email/DM for free review with mutual-value angle (feature their work on the blog or via app surfaces as the trade). Paid Unicode adversarial security review deferred until Replant has support/funding.
3. **Pastoral queue clinical receiver — TBD specific path.** Options on the table: QPR (Question/Persuade/Refer) ~$30-50/seat online; crisis-line referral script + Befrienders Worldwide / 988 Lifeline / Samaritans directory; volunteer pastoral counselor from network. Founder picks before launch.
4. **Native-speaker pipeline: Tier-1 volunteer-heavy.** Free volunteers from leader network with segregated identity per UG protection. No budget commitment until opportunity/support emerges.
5. **Audit retention: 30 days for cleared non-safety flag reads.** Life-safety codes + escalated flag reads retained forever. Locked.
6. **Tier-gated content viewing: 5+5 + full thread restricted to super_admin + Manager.** Required justification (≥50 chars, audit-permanent). Regular admins see chip + preview only.
7. **Source-prefix flips: only `false_teaching` to `manual:`.** `threats` / `spam_pattern` / `pastoral_care_signal` ship `auto:` with curated starter patterns + 30-day calibration discipline.
8. **In-app disclosure copy added to Connect first-message modal + Community Covenant v1 + CovenantStrip.** Drafted above.

---

*Authored 2026-06-30. Starter patterns drawn from published research; calibrate from your own admin queue post-launch. Move patterns to `flag_taxonomy_secret.json`, regenerate codegen, delete this file (or move to gitignored location).*
