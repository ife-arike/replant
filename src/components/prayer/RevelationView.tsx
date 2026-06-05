// ─────────────────────────────────────────────
// RevelationView — Prayer Wall redesign (Revelation surface)
//
// The Spirit's word to the seven churches of Revelation 2–3 (KJV/NASB
// blend per CD copy). Two internal states:
//
//   list   → "The Seven Churches" intro + 7 archetype cards + footer
//            (Rev 2:7). Philadelphia carries a sky affirming border;
//            Smyrna carries a red border and, on tap, navigates OUT to
//            the Persecuted tab rather than opening a detail view.
//   detail → Christ Speaks / The Conviction / The Counsel / The Promise
//            scripture sections + "Voices from the Body" placeholder
//            (compose prompt + type chips are visual-only at MVP — no
//            backend, no insight cards).
//
// All seven churches are hardcoded here from scripture — this is a
// fixed scriptural surface, not a DB-backed feed. The shape mirrors the
// CD ARCHETYPES structure (data.jsx) plus full detail fields.
//
// Cross-tab: Smyrna → onNavigateToPersecuted() (wired in PrayerWallScreen
// to navigation.navigate('Persecuted')).
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography } from '../../constants/theme';

// ── Tokens (README global colour table) ──────────────────────────────
const BLACK = '#080808';
const SURFACE = '#121214';
const OFFWHITE = '#F0EDE6';
const CREAM = '#E6E1D5';
const MUTED_55 = 'rgba(240,237,230,0.55)';
const MUTED_32 = 'rgba(240,237,230,0.32)';
const FAINT = 'rgba(240,237,230,0.08)';
const SKY = '#6BB5E8';
const SKY_MID = 'rgba(107,181,232,0.35)';
const RED = '#D9594F';

// ── Archetype data — 7 churches of Revelation 2–3 ────────────────────

interface Archetype {
  id: string;
  condition: string;
  city: string;
  ref: string;
  brief: string;
  affirming?: true;
  linksTo?: 'persecuted';
  address: string;
  conviction: string;
  counsel: string;
  promise: string;
  promiseRef: string;
}

const ARCHETYPES: Archetype[] = [
  {
    id: 'ephesus', condition: 'Loveless', city: 'Ephesus', ref: 'Revelation 2:1–7',
    brief: 'Doctrinally sound, laboring hard — but the first love has grown cold.',
    address: '"To the angel of the church in Ephesus write: ‘The One who holds the seven stars in His right hand, the One who walks among the seven golden lampstands, says this…’"',
    conviction: '"But I have this against you, that you have left your first love. Therefore remember from where you have fallen, and repent and do the deeds you did at first; or else I am coming to you and will remove your lampstand out of its place — unless you repent."',
    counsel: '"Yet this you do have, that you hate the deeds of the Nicolaitans, which I also hate."',
    promise: '"To him who overcomes, I will grant to eat of the tree of life which is in the Paradise of God."',
    promiseRef: 'Revelation 2:7',
  },
  {
    id: 'smyrna', condition: 'Persecuted', city: 'Smyrna', ref: 'Revelation 2:8–11',
    brief: 'Suffering, poor in the world’s eyes — yet rich. Faithful unto death.',
    linksTo: 'persecuted',
    address: '"To the angel of the church in Smyrna write: ‘The first and the last, who was dead, and has come to life, says this…’"',
    conviction: '"I know your tribulation and your poverty (but you are rich), and the blasphemy by those who say they are Jews and are not, but are a synagogue of Satan."',
    counsel: '"Do not fear what you are about to suffer. Behold, the devil is about to cast some of you into prison, so that you will be tested, and you will have tribulation for ten days. Be faithful until death, and I will give you the crown of life."',
    promise: '"He who overcomes will not be hurt by the second death."',
    promiseRef: 'Revelation 2:11',
  },
  {
    id: 'pergamon', condition: 'Compromising', city: 'Pergamon', ref: 'Revelation 2:12–17',
    brief: 'Holding fast to Christ’s name, yet tolerating teachings that lead astray.',
    address: '"To the angel of the church in Pergamon write: ‘He who has the sharp two-edged sword says this…’"',
    conviction: '"But I have a few things against you, because you have there some who hold the teaching of Balaam, who kept teaching Balak to put a stumbling block before the sons of Israel, to eat things sacrificed to idols and to commit acts of immorality."',
    counsel: '"Therefore repent; or else I am coming to you quickly, and I will make war against them with the sword of My mouth."',
    promise: '"To him who overcomes, to him I will give some of the hidden manna, and I will give him a white stone, and a new name written on the stone which no one knows but he who receives it."',
    promiseRef: 'Revelation 2:17',
  },
  {
    id: 'thyatira', condition: 'Corrupt', city: 'Thyatira', ref: 'Revelation 2:18–29',
    brief: 'Love, faith, and endurance abound — but a false prophet is tolerated within.',
    address: '"To the angel of the church in Thyatira write: ‘The Son of God, who has eyes like a flame of fire, and His feet are like burnished bronze, says this…’"',
    conviction: '"But I have this against you, that you tolerate the woman Jezebel, who calls herself a prophetess, and she teaches and leads My bond-servants astray so that they commit acts of immorality and eat things sacrificed to idols."',
    counsel: '"I gave her time to repent, and she does not want to repent of her immorality. Behold, I will throw her on a bed of sickness, and those who commit adultery with her into great tribulation, unless they repent of her deeds."',
    promise: '"He who overcomes, and he who keeps My deeds until the end, to him I will give authority over the nations… and I will give him the morning star."',
    promiseRef: 'Revelation 2:26, 28',
  },
  {
    id: 'sardis', condition: 'Dead', city: 'Sardis', ref: 'Revelation 3:1–6',
    brief: 'A name that says alive, but the works are incomplete before God.',
    address: '"To the angel of the church in Sardis write: ‘He who has the seven Spirits of God and the seven stars, says this…’"',
    conviction: '"I know your deeds, that you have a name that you are alive, but you are dead. Wake up, and strengthen the things that remain, which were about to die; for I have not found your deeds completed in the sight of My God."',
    counsel: '"So remember what you have received and heard; and keep it, and repent. Therefore if you do not wake up, I will come like a thief, and you will not know at what hour I will come to you."',
    promise: '"He who overcomes will thus be clothed in white garments; and I will not erase his name from the book of life, and I will confess his name before My Father and before His angels."',
    promiseRef: 'Revelation 3:5',
  },
  {
    id: 'philadelphia', condition: 'Faithful', city: 'Philadelphia', ref: 'Revelation 3:7–13',
    brief: 'Little strength, but the word is kept and the name is not denied.',
    affirming: true,
    address: '"To the angel of the church in Philadelphia write: ‘He who is holy, who is true, who has the key of David, who opens and no one will shut, and who shuts and no one opens, says this…’"',
    conviction: '"I know your deeds. Behold, I have put before you an open door which no one can shut, because you have a little power, and have kept My word, and have not denied My name."',
    counsel: '"Because you have kept the word of My perseverance, I also will keep you from the hour of testing, that hour which is about to come upon the whole world, to test those who dwell on the earth. I am coming quickly; hold fast what you have, so that no one will take your crown."',
    promise: '"He who overcomes, I will make him a pillar in the temple of My God, and he will not go out from it anymore; and I will write on him the name of My God, and the name of the city of My God, the new Jerusalem, which comes down out of heaven from My God, and My new name."',
    promiseRef: 'Revelation 3:12',
  },
  {
    id: 'laodicea', condition: 'Lukewarm', city: 'Laodicea', ref: 'Revelation 3:14–22',
    brief: 'Neither hot nor cold — self-sufficient, unaware of true poverty.',
    address: '"To the angel of the church in Laodicea write: ‘The Amen, the faithful and true Witness, the Beginning of the creation of God, says this…’"',
    conviction: '"I know your deeds, that you are neither cold nor hot. I wish that you were cold or hot. So because you are lukewarm, and neither hot nor cold, I will spit you out of My mouth."',
    counsel: '"I advise you to buy from Me gold refined by fire so that you may become rich, and white garments so that you may clothe yourself, and eye salve to anoint your eyes so that you may see. Those whom I love, I reprove and discipline; therefore be zealous and repent."',
    promise: '"To the one who overcomes, I will grant to sit down with Me on My throne, as I also overcame and sat down with My Father on His throne."',
    promiseRef: 'Revelation 3:21',
  },
];

interface Props {
  onNavigateToPersecuted: () => void;
}

export default function RevelationView({ onNavigateToPersecuted }: Props) {
  // null → list; otherwise the selected archetype id → detail.
  const [detailId, setDetailId] = useState<string | null>(null);

  const detail = detailId ? ARCHETYPES.find((a) => a.id === detailId) ?? null : null;

  if (detail) {
    return <RevelationDetail archetype={detail} onBack={() => setDetailId(null)} />;
  }

  return (
    <RevelationList
      onSelect={(a) => {
        if (a.linksTo === 'persecuted') {
          onNavigateToPersecuted();
          return;
        }
        setDetailId(a.id);
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────────────

function RevelationList({ onSelect }: { onSelect: (a: Archetype) => void }) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>THE SEVEN CHURCHES</Text>
        <Text style={styles.introBody}>
          Seven archetypes. Every church carries one at any moment. Find insight,
          conviction, and revelation here — drawn from the Spirit&apos;s word to His
          Church across the ages.
        </Text>
      </View>

      <View style={styles.grid}>
        {ARCHETYPES.map((a, i) => (
          <ArchetypeCard key={a.id} archetype={a} index={i} onPress={() => onSelect(a)} />
        ))}
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>
          &quot;He who has an ear, let him hear what the Spirit says to the churches.&quot;
        </Text>
        <Text style={styles.footRef}>REVELATION 2:7</Text>
      </View>
    </ScrollView>
  );
}

function ArchetypeCard({
  archetype,
  index,
  onPress,
}: {
  archetype: Archetype;
  index: number;
  onPress: () => void;
}) {
  const isSmyrna = archetype.linksTo === 'persecuted';
  const chevronColor = isSmyrna ? RED : MUTED_32;
  const leftBorder = archetype.affirming
    ? styles.cardAffirming
    : isSmyrna
      ? styles.cardLinksOut
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`The Church at ${archetype.city} — ${archetype.condition}`}
      style={({ pressed }) => [styles.card, leftBorder, pressed && styles.cardPressed]}
    >
      <Text style={styles.cardNum}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.cardCondition}>{archetype.condition}</Text>
        <Text style={styles.cardCity}>THE CHURCH AT {archetype.city.toUpperCase()}</Text>
        <Text style={styles.cardBrief}>{archetype.brief}</Text>
        <Text style={styles.cardRef}>{archetype.ref.toUpperCase()}</Text>
      </View>
      <View style={styles.cardChevron}>
        <Chevron color={chevronColor} />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────

const TYPE_CHIPS = ['Commentary', 'Warning', 'Prophecy', 'Scripture'];

function RevelationDetail({
  archetype,
  onBack,
}: {
  archetype: Archetype;
  onBack: () => void;
}) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to the seven churches"
        hitSlop={8}
        style={styles.backRow}
      >
        <BackChevron color={SKY} />
        <Text style={styles.backLabel}>REVELATION</Text>
      </Pressable>

      <View style={styles.detailHead}>
        <Text style={styles.detailCondition}>{archetype.condition}</Text>
        <Text style={styles.detailCity}>The Church at {archetype.city}</Text>
        <Text style={styles.detailRef}>{archetype.ref.toUpperCase()}</Text>
      </View>

      <ScriptureSection label="CHRIST SPEAKS" verse={archetype.address} />
      <ScriptureSection label="THE CONVICTION" verse={archetype.conviction} />
      <ScriptureSection label="THE COUNSEL" verse={archetype.counsel} />

      <View style={styles.promiseCard}>
        <Text style={styles.sectionLabel}>THE PROMISE TO THE OVERCOMER</Text>
        <Text style={styles.sectionVerse}>{archetype.promise}</Text>
        <Text style={styles.promiseRef}>{archetype.promiseRef.toUpperCase()}</Text>
      </View>

      {/* ── Voices from the Body — visual placeholder only (no MVP backend) ── */}
      <View style={styles.voicesSection}>
        <Text style={styles.sectionLabel}>VOICES FROM THE BODY</Text>
        <Text style={styles.voicesSub}>
          Commentary, warnings, prophecies, and scripture from leaders who carry this word
        </Text>

        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          style={styles.composePrompt}
        >
          <PenGlyph color={SKY} />
          <Text style={styles.composePromptText}>Speak to the church here…</Text>
        </Pressable>

        <View style={styles.typeChips}>
          {TYPE_CHIPS.map((t) => (
            <View key={t} style={styles.typeChip}>
              <Text style={styles.typeChipText}>{t.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function ScriptureSection({ label, verse }: { label: string; verse: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionVerse}>{verse}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Glyphs
// ─────────────────────────────────────────────────────────────────────

function Chevron({ color }: { color: string }) {
  return (
    <Svg width={10} height={10} viewBox="0 0 12 12">
      <Path d="M4 2l5 4-5 4" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 14 14">
      <Path d="M9 2l-5 5 5 5" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PenGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16">
      <Path
        d="M8 2v5M6 4l2-2 2 2M4 14V9a2.5 2.5 0 0 1 5 0v3M7 12V9a2.5 2.5 0 0 1 5 0v5"
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK },
  listContent: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32 },
  detailContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 },

  // ── List · intro
  intro: { marginBottom: 22 },
  introEyebrow: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.24 * 9,
    textTransform: 'uppercase',
    color: SKY,
    marginBottom: 12,
  },
  introBody: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 23,
    color: CREAM,
    letterSpacing: 0.15,
  },

  // ── List · cards
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 18,
    paddingRight: 18,
    paddingBottom: 16,
    paddingLeft: 18,
    borderRadius: 8,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: FAINT,
  },
  cardPressed: { opacity: 0.85 },
  cardAffirming: { borderLeftWidth: 2, borderLeftColor: SKY },
  cardLinksOut: { borderLeftWidth: 2, borderLeftColor: RED },
  cardNum: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: MUTED_32,
    paddingTop: 6,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardCondition: {
    fontFamily: Typography.displayRegular,
    fontSize: 20,
    color: OFFWHITE,
    letterSpacing: 0.2,
  },
  cardCity: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    textTransform: 'uppercase',
    color: MUTED_55,
    marginTop: 4,
  },
  cardBrief: {
    fontFamily: Typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED_55,
    marginTop: 10,
  },
  cardRef: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.18 * 8.5,
    textTransform: 'uppercase',
    color: SKY,
    marginTop: 12,
  },
  cardChevron: { flexShrink: 0, paddingTop: 6 },

  // ── List · footer
  foot: {
    marginTop: 28,
    paddingTop: 22,
    borderTopWidth: 0.5,
    borderTopColor: FAINT,
    alignItems: 'center',
  },
  footText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 15,
    lineHeight: 23,
    color: CREAM,
    textAlign: 'center',
    letterSpacing: 0.15,
    maxWidth: 300,
    marginBottom: 12,
  },
  footRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.22 * 9,
    textTransform: 'uppercase',
    color: MUTED_55,
  },

  // ── Detail · back row
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  backLabel: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.22 * 9.5,
    textTransform: 'uppercase',
    color: MUTED_55,
  },

  // ── Detail · head
  detailHead: { marginBottom: 24 },
  detailCondition: {
    fontFamily: Typography.scriptureLight,
    fontSize: 30,
    lineHeight: 36,
    color: OFFWHITE,
  },
  detailCity: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: MUTED_55,
    marginTop: 4,
  },
  detailRef: {
    fontFamily: Typography.mono,
    fontSize: 9.5,
    letterSpacing: 0.22 * 9.5,
    textTransform: 'uppercase',
    color: SKY,
    marginTop: 8,
  },

  // ── Detail · scripture sections
  section: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: FAINT,
  },
  sectionLabel: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.22 * 9,
    textTransform: 'uppercase',
    color: SKY,
    marginBottom: 12,
  },
  sectionVerse: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 16,
    lineHeight: 26,
    color: CREAM,
    letterSpacing: 0.16,
  },

  // ── Detail · promise card
  promiseCard: {
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: SKY_MID,
    // gradient approximated with a faint sky wash (no BlurView / gradients
    // dependency required) — README: from rgba(107,181,232,0.04).
    backgroundColor: 'rgba(107,181,232,0.04)',
  },
  promiseRef: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 0.22 * 9,
    textTransform: 'uppercase',
    color: SKY,
    marginTop: 12,
  },

  // ── Detail · voices
  voicesSection: { marginTop: 8 },
  voicesSub: {
    fontFamily: Typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED_55,
    marginTop: -4,
    marginBottom: 16,
  },
  composePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: SKY_MID,
    backgroundColor: SURFACE,
  },
  composePromptText: {
    fontFamily: Typography.scriptureItalic,
    fontSize: 14,
    color: MUTED_55,
    flex: 1,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  typeChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: FAINT,
  },
  typeChipText: {
    fontFamily: Typography.mono,
    fontSize: 8.5,
    letterSpacing: 0.16 * 8.5,
    textTransform: 'uppercase',
    color: MUTED_32,
  },
});
