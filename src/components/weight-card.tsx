import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AnimatedPressable } from '@/components/animated-pressable';
import { GlassCard } from '@/components/glass-card';
import { C, Fonts, Radius } from '@/constants/theme';
import { getWeightLogs, type WeightLog } from '@/lib/weight';

// A small scale/weight glyph (no matching icon in the shared Icon set).
function ScaleGlyph({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 6V4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M8.5 12.5 12 9l1.6 2.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/**
 * Home / Settings entry point into the Weight Tracker. Fetches the caller's
 * recent entries itself (re-fetching on focus so it reflects a just-logged
 * weigh-in), shows the current weight plus a tiny trend arrow over the range,
 * and routes to /weight on tap. Renders nothing extra on failure.
 */
export function WeightCard() {
  const [logs, setLogs] = useState<WeightLog[] | null>(null);

  const load = useCallback(() => {
    getWeightLogs('month')
      .then((r) => setLogs(r.logs))
      .catch(() => setLogs([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasData = logs != null && logs.length > 0;
  const current = hasData ? logs![logs!.length - 1].weight_kg : null;
  const first = hasData ? logs![0].weight_kg : null;
  const delta = current != null && first != null ? current - first : 0;

  // Neutral direction indicator — up/down isn't inherently good or bad (goals
  // differ), so the arrow stays sage and just reports the movement.
  const dir = Math.abs(delta) < 0.1 ? 'flat' : delta < 0 ? 'down' : 'up';
  const arrow = dir === 'down' ? '↓' : dir === 'up' ? '↑' : '·';

  return (
    <AnimatedPressable onPress={() => router.push('/weight' as never)} pressedScale={0.98}>
      <GlassCard contentStyle={s.card}>
        <View style={s.left}>
          <View style={s.tile}>
            <ScaleGlyph color={C.accent} size={22} />
          </View>
          <View>
            <Text style={s.eyebrow}>Weight</Text>
            {current != null ? (
              <Text style={s.value}>
                {fmt(current)}<Text style={s.unit}> kg</Text>
              </Text>
            ) : (
              <Text style={s.empty}>Track your weight</Text>
            )}
          </View>
        </View>

        <View style={s.right}>
          {hasData && dir !== 'flat' ? (
            <View style={s.trend}>
              <Text style={s.trendArrow}>{arrow}</Text>
              <Text style={s.trendText}>{fmt(Math.abs(delta))} kg</Text>
            </View>
          ) : (
            <Text style={s.chev}>›</Text>
          )}
        </View>
      </GlassCard>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(76,124,99,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', color: C.greenInk },
  value: { marginTop: 4, fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 23, fontWeight: '600', color: C.inkStrong, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, fontWeight: '400', color: C.inkSoft },
  empty: { marginTop: 4, fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint },
  right: { alignItems: 'flex-end' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  trendArrow: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, color: C.greenInk, fontWeight: '700' },
  trendText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, color: C.greenInk, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chev: { fontFamily: Fonts?.body ?? 'system', fontSize: 22, color: C.inkDim },
});
