import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CIcon, type CIconName } from '@/components/CalibretaIcon';
import { C, Fonts, Gradients } from '@/constants/theme';

// Minimal type that matches what React Navigation passes to the tabBar prop.
// navigation is typed as any to avoid fighting React Navigation's deeply
// constrained generics on emit() — runtime behaviour is still sound.
type TabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string; name: string; params?: Readonly<object> }>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
};

const LABEL = {
  index:   'Home',
  add:     'Log',
  scanner: 'Scan',
  explore: 'News',
} as const;

type RouteName = keyof typeof LABEL;

// Branded feature icons per tab (rest = outline, active = filled).
const TAB_CICON: Record<RouteName, CIconName> = {
  index:   'home',
  add:     'mealLog',
  scanner: 'barcodeScan',
  explore: 'news',
};

// Only these routes get a button in the bar, in this order. Any other route
// (plan, settings, …) is navigable but never rendered as a tab — this keeps
// the five slots evenly spaced with Scan centered.
const VISIBLE: RouteName[] = ['index', 'add', 'scanner', 'explore'];

// A standard tab: the icon does a small bounce-settle when it becomes active.
function TabButton({ name, label, isFocused, onPress }: {
  name: RouteName; label: string; isFocused: boolean; onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const ty = useSharedValue(0);
  useEffect(() => {
    if (isFocused && !reduced) {
      ty.value = withSequence(
        withSpring(-4, { damping: 14, stiffness: 180 }),
        withSpring(0, { damping: 14, stiffness: 180 }),
      );
    }
  }, [isFocused, reduced, ty]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const iconColor = isFocused ? C.mint : C.inkDim;
  return (
    <Pressable
      style={styles.tabItem}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
        <Reanimated.View style={iconStyle}>
          <CIcon name={TAB_CICON[name]} active={isFocused} color={iconColor} size={23} />
        </Reanimated.View>
        <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// The centre Scan FAB: an ambient breathing halo loops behind it.
function ScanButton({ isFocused, onPress }: { isFocused: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    glow.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [glow, reduced]);
  // opacity 0.35 → 0.75, scale 1 → 1.18 (a soft disc approximates the blurred
  // glow from the spec without pulling in a blur dependency).
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.4,
    transform: [{ scale: 1 + glow.value * 0.18 }],
  }));
  return (
    <Pressable
      style={styles.fabWrap}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel="Scan"
    >
      <Reanimated.View pointerEvents="none" style={[styles.fabGlow, glowStyle]} />
      <LinearGradient
        colors={Gradients.greenTeal}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.fab}
      >
        <CIcon name="barcodeScan" color="#fff" size={24} />
      </LinearGradient>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => (VISIBLE as string[]).includes(route.name));

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View style={styles.barShadow}>
        <LinearGradient
          colors={['#FFFFFF', '#FCFAF6']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.bar}
        >
          {tabs.map(({ route, index }) => {
            const name = route.name as RouteName;
            const isFocused = state.index === index;
            const isScan = name === 'scanner';

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            if (isScan) {
              return <ScanButton key={route.key} isFocused={isFocused} onPress={onPress} />;
            }

            return (
              <TabButton
                key={route.key}
                name={name}
                label={LABEL[name]}
                isFocused={isFocused}
                onPress={onPress}
              />
            );
          })}
        </LinearGradient>
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="explore" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Dock that holds the glass bar clear of the screen edge. Kept in layout flow
  // (not absolute) so the tab navigator reserves its height and screen content
  // never slides under the floating bar.
  dock: {
    paddingHorizontal: 20,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  barShadow: {
    borderRadius: 26,
    ...Platform.select({
      ios: { shadowColor: '#4A3A22', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.22, shadowRadius: 30 },
      android: { elevation: 14 },
    }),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(74,58,34,0.06)',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Accent-tint "pill" behind the active tab.
  tabInnerActive: {
    backgroundColor: C.greenSoft,
    borderColor: 'rgba(76,124,99,0.22)',
  },
  label: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.2,
    fontWeight: '600',
    color: C.inkDim,
    textAlign: 'center',
  },
  labelActive: {
    color: C.greenInk,
  },
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ambient halo behind the FAB (centred on the -26 offset fab).
  fabGlow: {
    position: 'absolute',
    top: -34,
    alignSelf: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.green,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    ...Platform.select({
      ios: {
        shadowColor: C.green,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
    }),
  },
});
