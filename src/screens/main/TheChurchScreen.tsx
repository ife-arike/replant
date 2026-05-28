// ─────────────────────────────────────────────
// TheChurchScreen — KAN-21 (CAL page)
//
// Replaces TheChurchPlaceholderScreen. Hosts the Global (CAL) globe and
// the church-profile bottom sheet that opens on dot tap. When CAML
// (Local) ships, this screen will gain a sub-tab toggle + cross-fade
// between CAML and CAL; per AC #15 the globe component itself does NOT
// own that transition. For now: CAL only.
//
// Data + behaviour live inside the children:
//   - GlobeView owns Mapbox, rotation, clustering, pills, "+N hidden".
//   - ChurchProfileBottomSheet (KAN-20) owns get_church_profile + render.
//
// This host only routes a dot-tap to the sheet, knows the viewer's
// verification status (so the sheet's gate fires correctly), and provides
// the SafeAreaView so the globe fills the tab area minus safe insets.
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthProvider';
import GlobeView from '../../components/church/GlobeView';
import ChurchProfileBottomSheet from '../../components/church/ChurchProfileBottomSheet';

export default function TheChurchScreen() {
  const { branch } = useAuth();
  const viewerVerified = branch === 'active';

  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <GlobeView onChurchSelect={setSelectedChurchId} />
      <ChurchProfileBottomSheet
        churchId={selectedChurchId}
        viewerVerified={viewerVerified}
        onDismiss={() => setSelectedChurchId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
