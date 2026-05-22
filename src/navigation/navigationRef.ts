// navigationRef — KAN-76
//
// Singleton navigation ref for imperative navigation from components
// mounted outside NavigationContainer (e.g. HamburgerPanel in App.tsx).
// Bound to <NavigationContainer ref={navigationRef}> in AppGate.
//
// Usage pattern: `if (navigationRef.isReady()) navigationRef.navigate(...)`.
// The isReady() guard avoids the no-op-with-warning that happens when
// the container hasn't mounted yet (cold-start race).

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
