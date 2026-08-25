import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CIcon } from '@/components/CalibretaIcon';
import { C, Gradients } from '@/constants/theme';

// Height the tab dock reserves at the bottom (bar height + its top padding).
// Mirrors app-tabs.tsx so the FAB always clears the floating bar.
const DOCK_HEIGHT = 66 + 6;

/**
 * Global floating assistant button. Rendered ONCE at the app root (around
 * <AppTabs/>) so a single instance persists across every tab — never place it
 * per-screen. Echoes the centre Scan FAB (gradient disc + elevation) but uses
 * the marigold AI accent + "spark" icon to read as the assistant, and is
 * right-anchored so it never collides with the centred Scan button.
 */
export function AssistantFab() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const bottom = Math.max(insets.bottom, 12) + DOCK_HEIGHT + 16;

  // Don't overlay the button on the assistant screen itself (avoids re-pushing it).
  if (pathname === '/assistant') return null;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push('/assistant' as never)}
        accessibilityRole="button"
        accessibilityLabel="Ask Calibreta"
        hitSlop={8}
        style={styles.press}
      >
        <LinearGradient
          colors={Gradients.amber}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.fab}
        >
          <CIcon name="aiAssistant" color="#fff" size={24} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Absolute overlay pinned to the right edge, above the tab dock. box-none so
  // taps outside the button pass through to the screen underneath.
  wrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
  press: { borderRadius: 20 },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: C.marigold,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
});
