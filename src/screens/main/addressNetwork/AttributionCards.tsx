// ─────────────────────────────────────────────
// AttributionCards — "How you'll appear".
//
// Public leader  → two radio cards (Show my name default / Role and region).
// Underground    → NO choice. A single locked "Role and region" card with an
//                  "Only option" pill. Role + region, never a name, never a
//                  church, NEVER a city (Ruling 3). Reads as a fact, not a
//                  block: no error styling, no red. Role+region is also
//                  forced server-side for underground (defense in depth) and
//                  is never offered to them client-side.
// ─────────────────────────────────────────────

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../constants/theme';
import type { Attribution } from './types';
import { articleFor, type ComposeIdentity } from './useComposeIdentity';
import { SKY_04, SKY_25 } from './tokens';

interface Props {
  identity: ComposeIdentity;
  value: Attribution;
  onChange: (a: Attribution) => void;
}

// "Pastor Elias, Living Word Assembly."
function showNameHelper(identity: ComposeIdentity): string {
  const who = [identity.roleLabel, identity.firstName].filter(Boolean).join(' ');
  return identity.churchName ? `${who}, ${identity.churchName}.` : `${who}.`;
}

// Public: "A Pastor from West Africa. No name, no church."
function roleRegionHelperPublic(identity: ComposeIdentity): string {
  const lead = `${articleFor(identity.roleLabel)} ${identity.roleLabel}`;
  return identity.region
    ? `${lead} from ${identity.region}. No name, no church.`
    : `${lead}. No name, no church.`;
}

// Underground: "A Pastor from South Asia." — region resolved server-side;
// falls back to "your region" until a client-safe label exists.
function roleRegionHelperUnderground(identity: ComposeIdentity): string {
  const lead = `${articleFor(identity.roleLabel)} ${identity.roleLabel}`;
  return `${lead} from ${identity.region ?? 'your region'}.`;
}

function Radio({ on }: { on: boolean }) {
  return (
    <View style={[styles.radio, on && styles.radioOn]}>
      {on ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

function Pill({ label, sky }: { label: string; sky?: boolean }) {
  return (
    <View style={[styles.pill, sky && styles.pillSky]}>
      <Text style={[styles.pillText, sky && styles.pillTextSky]}>{label}</Text>
    </View>
  );
}

export default function AttributionCards({ identity, value, onChange }: Props) {
  if (identity.isUnderground) {
    return (
      <View style={styles.list}>
        <View
          style={[styles.card, styles.cardOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: true, disabled: true }}
          accessibilityLabel={`Role and region. Only option. ${roleRegionHelperUnderground(identity)}`}
        >
          <View style={styles.head}>
            <Radio on />
            <Text style={styles.title}>Role and region</Text>
            <Pill label="Only option" sky />
          </View>
          <Text style={styles.helper}>{roleRegionHelperUnderground(identity)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Pressable
        onPress={() => onChange('show_name')}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'show_name' }}
        accessibilityLabel={`Show my name. ${showNameHelper(identity)}`}
        style={[styles.card, value === 'show_name' && styles.cardOn]}
      >
        <View style={styles.head}>
          <Radio on={value === 'show_name'} />
          <Text style={styles.title}>Show my name</Text>
          <Pill label="Default" />
        </View>
        <Text style={styles.helper}>{showNameHelper(identity)}</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange('role_region')}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === 'role_region' }}
        accessibilityLabel={`Role and region. ${roleRegionHelperPublic(identity)}`}
        style={[styles.card, value === 'role_region' && styles.cardOn]}
      >
        <View style={styles.head}>
          <Radio on={value === 'role_region'} />
          <Text style={styles.title}>Role and region</Text>
        </View>
        <Text style={styles.helper}>{roleRegionHelperPublic(identity)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 17,
    paddingHorizontal: 16,
    gap: 7,
  },
  cardOn: {
    borderColor: SKY_25,
    backgroundColor: SKY_04,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(240,237,230,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  title: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15.5,
    color: Colors.text,
  },
  helper: {
    fontFamily: Typography.sansLight,
    fontSize: 12.5,
    lineHeight: 20, // 1.6 × 12.5
    color: Colors.textMuted,
    paddingLeft: 31,
  },
  pill: {
    marginLeft: 'auto',
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  pillSky: {
    borderColor: SKY_25,
  },
  pillText: {
    fontFamily: Typography.mono,
    fontSize: 8,
    letterSpacing: 0.96, // 0.12em × 8
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  pillTextSky: {
    color: Colors.accent,
  },
});
