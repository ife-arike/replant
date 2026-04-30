// ─────────────────────────────────────────────
// Screen 04 — Account Setup Page 2
// Church association — join existing or register new.
// 2-leader cap enforced. Cannot submit without church.
// Account created + countdown begins on final submit.
// → BE: wire church search to get-nearby-churches RPC
// → BE: wire submit to account creation edge function
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useOnboarding } from '../../context/OnboardingContext';
import { getChurchTypeLabel, getRagLabel } from '../../utils/displayHelpers';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'AccountSetupPage2'>;

interface ChurchResult {
  id: string;
  name: string;   // may be absent for unverified — handled below
  type: string;
  city: string;
  country: string;
  rag_status: string;
  verification_status: string;
  leader_count: number;
}

const RAG_COLORS: Record<string, string> = {
  green: Colors.green,
  amber: Colors.amber,
  red: Colors.red,
};

export default function AccountSetupPage2Screen({ navigation }: Props) {
  const { state, setChurchDetails } = useOnboarding();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ChurchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<ChurchResult | null>(null);
  const [capError, setCapError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!selectedChurch && !capError;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(false);
    setSelectedChurch(null);
    setCapError(false);

    try {
      // TODO → BE: wire to Supabase RPC get-nearby-churches or church search function
      // Stub response for now
      await new Promise(r => setTimeout(r, 600));
      const stub: ChurchResult[] = []; // real response replaces this
      setResults(stub);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleSelect = (church: ChurchResult) => {
    if (church.leader_count >= 2) {
      setSelectedChurch(null);
      setCapError(true);
      return;
    }
    setCapError(false);
    setSelectedChurch(church);
  };

  const handleRegisterNew = () => {
    navigation.navigate('RegisterChurchPage1');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      setChurchDetails({ churchId: selectedChurch!.id });
      // TODO → BE: call account creation edge function
      // On success: navigate to main app (Home)
      // Countdown begins server-side at this exact timestamp
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header with back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>ACCOUNT SETUP · 2 OF 2</Text>
        <Text style={styles.title}>Your Church</Text>
        <Text style={styles.subtitle}>
          Every leader in the network is tied to a church. Search for yours below, or register a new one.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by church name or city..."
            placeholderTextColor={Colors.textSubtle}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            activeOpacity={0.8}
          >
            {searching ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 2-leader cap error */}
        {capError && (
          <View style={styles.capError}>
            <Text style={styles.capErrorText}>
              This church already has its maximum of 2 registered leaders. Please contact Replant
              if you believe this is an error.
            </Text>
            <Text style={styles.capErrorContact}>connect@projectreplant.org</Text>
          </View>
        )}

        {/* Selected church */}
        {selectedChurch && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedLabel}>SELECTED</Text>
              <TouchableOpacity onPress={() => setSelectedChurch(null)}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.churchName}>{selectedChurch.name}</Text>
            <View style={styles.churchMeta}>
              <View style={[styles.ragDot, { backgroundColor: RAG_COLORS[selectedChurch.rag_status] }]} />
              <Text style={styles.churchMetaText}>
                {getChurchTypeLabel(selectedChurch.type)} · {selectedChurch.city}
              </Text>
            </View>
          </View>
        )}

        {/* Search results */}
        {searched && results.length === 0 && !selectedChurch && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No churches found.</Text>
            <Text style={styles.emptyStateSubtext}>
              Is your church not in the network yet? Register it below.
            </Text>
          </View>
        )}

        {results.length > 0 && !selectedChurch && (
          <View style={styles.results}>
            {results.map(church => (
              <TouchableOpacity
                key={church.id}
                style={[
                  styles.resultItem,
                  church.leader_count >= 2 && styles.resultItemCapped,
                ]}
                onPress={() => handleSelect(church)}
                activeOpacity={0.7}
              >
                <View style={styles.resultLeft}>
                  <View style={[styles.ragDot, { backgroundColor: RAG_COLORS[church.rag_status] }]} />
                  <View>
                    <Text style={styles.churchName}>
                      {church.name || getChurchTypeLabel(church.type)}
                    </Text>
                    <Text style={styles.churchMetaText}>
                      {getChurchTypeLabel(church.type)} · {church.city}, {church.country}
                    </Text>
                    {church.leader_count >= 2 && (
                      <Text style={styles.cappedLabel}>Leader slots full</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.resultChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Register new */}
        <View style={styles.registerSection}>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={handleRegisterNew}
            activeOpacity={0.8}
          >
            <Text style={styles.registerButtonText}>Register a New Church</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Complete Registration */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
              Complete Registration
            </Text>
          )}
        </TouchableOpacity>
        {!canSubmit && !capError && (
          <Text style={styles.footerHint}>Select or register a church to continue</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    paddingTop: 72,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginBottom: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: Typography.body,
    fontSize: 16,
    color: Colors.accent,
  },
  stepLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.display,
    fontSize: 28,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },

  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: Typography.body,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  searchButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.background,
  },

  capError: {
    backgroundColor: 'rgba(224, 85, 85, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 85, 85, 0.25)',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  capErrorText: {
    fontFamily: Typography.body,
    fontSize: 14,
    color: Colors.red,
    lineHeight: 22,
  },
  capErrorContact: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.red,
  },

  selectedCard: {
    backgroundColor: 'rgba(107, 181, 232, 0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.accent,
  },
  clearText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  results: {
    gap: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultItem: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  resultItemCapped: {
    opacity: 0.5,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  resultChevron: {
    fontFamily: Typography.body,
    fontSize: 18,
    color: Colors.textMuted,
  },
  cappedLabel: {
    fontFamily: Typography.body,
    fontSize: 11,
    color: Colors.amber,
    marginTop: 2,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyStateText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  emptyStateSubtext: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  registerSection: {
    gap: Spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    letterSpacing: 2,
  },
  registerButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  registerButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.accent,
  },

  churchName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.text,
  },
  churchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  churchMetaText: {
    fontFamily: Typography.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  ragDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  bottomSpacer: { height: Spacing.xxxl },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(107, 181, 232, 0.2)',
  },
  submitButtonText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 16,
    color: Colors.background,
  },
  submitButtonTextDisabled: {
    color: 'rgba(107, 181, 232, 0.4)',
  },
  footerHint: {
    fontFamily: Typography.body,
    fontSize: 12,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
});
