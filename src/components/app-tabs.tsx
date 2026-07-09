import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { C, Fonts } from '@/constants/theme';

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

// SVG paths straight from the prototype nav
const ICON_PATH = {
  index:   'M3 11l9-8 9 8M5 10v10h14V10',
  add:     'M12 5v14M5 12h14',
  scanner: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  explore: 'M4 19V6a2 2 0 0 1 2-2h13v15M6 17h13',
} as const;

const LABEL = {
  index:   'Home',
  add:     'Log',
  scanner: 'Scan',
  explore: 'News',
} as const;

type RouteName = keyof typeof ICON_PATH;

// Only these routes get a button in the bar, in this order. Any other route
// (plan, settings, …) is navigable but never rendered as a tab — this keeps
// the five slots evenly spaced with Scan centered.
const VISIBLE: RouteName[] = ['index', 'add', 'scanner', 'explore'];

function TabIcon({ d, color, size }: { d: string; color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const tabs = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => (VISIBLE as string[]).includes(route.name));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
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
          return (
            <Pressable
              key={route.key}
              style={styles.fabWrap}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel="Scan"
            >
              <View style={styles.fab}>
                <TabIcon d={ICON_PATH.scanner} color="#fff" size={24} />
              </View>
            </Pressable>
          );
        }

        const iconColor = isFocused ? C.green : C.inkFaint;

        return (
          <Pressable
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={LABEL[name]}
          >
            <View style={styles.tabIcon}>
              <TabIcon d={ICON_PATH[name]} color={iconColor} size={22} />
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {LABEL[name]}
            </Text>
          </Pressable>
        );
      })}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: 2,
    minHeight: 44,
  },
  tabIcon: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11,
    lineHeight: 14,
    color: C.inkFaint,
    textAlign: 'center',
  },
  labelActive: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    color: C.green,
  },
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    ...Platform.select({
      ios: {
        shadowColor: C.green,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
});
