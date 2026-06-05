// SeverityTag — colored pill for heartcry severity on My Heartcries.
// Active (#B83A30), Urgent (Colors.red), Serious (Colors.amber),
// Ongoing (amber 70%), Informational (Colors.textMuted).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography } from '../../../../constants/theme';

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  active_persecution: {
    color: '#B83A30',
    bg: 'rgba(184,58,48,0.06)',
    border: '#B83A30',
    label: 'Active',
  },
  critical: {
    color: '#B83A30',
    bg: 'rgba(184,58,48,0.06)',
    border: '#B83A30',
    label: 'Active',
  },
  urgent: {
    color: Colors.red,
    bg: 'rgba(224,85,85,0.06)',
    border: 'rgba(224,85,85,0.5)',
    label: 'Urgent',
  },
  serious: {
    color: Colors.amber,
    bg: 'rgba(212,168,85,0.06)',
    border: Colors.amber,
    label: 'Serious',
  },
  ongoing: {
    color: 'rgba(212,168,85,0.7)',
    bg: 'rgba(212,168,85,0.04)',
    border: 'rgba(212,168,85,0.5)',
    label: 'Ongoing',
  },
  informational: {
    color: Colors.textMuted,
    bg: 'rgba(240,237,230,0.03)',
    border: Colors.textMuted,
    label: 'Informational',
  },
  info: {
    color: Colors.textMuted,
    bg: 'rgba(240,237,230,0.03)',
    border: Colors.textMuted,
    label: 'Informational',
  },
};

interface SeverityTagProps {
  severity: string;
}

export default function SeverityTag({ severity }: SeverityTagProps) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.informational;
  return (
    <View style={[styles.container, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 2,
    borderWidth: 0.5,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Typography.mono,
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em × 9
    textTransform: 'uppercase',
  },
});
