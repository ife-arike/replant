// Lightweight hook wrapping AccessibilityInfo.isReduceMotionEnabled +
// the reduceMotionChanged subscription, so animation-heavy components
// can collapse to instant swaps when the OS-level setting is on.
//
// React Native ships AccessibilityInfo but no built-in hook for it, and
// the project doesn't have react-native-reanimated (which would have
// brought one). Keeping this small and shared so the same behaviour
// applies across the Prayer Wall surface — filter-bar promote/stack
// transitions, landing testimony rotator auto-advance, testimony
// celebrate burst — without each component subscribing independently.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (mounted) setReduced(on);
      })
      .catch(() => {
        // Older Android / unusual surfaces — assume motion is on.
        if (mounted) setReduced(false);
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      setReduced(on);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
