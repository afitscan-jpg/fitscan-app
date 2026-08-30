// src/components/insights/HorizontalBars.tsx
// Two single-row bars: meal-type distribution (4 fixed, colourblind-safe hues,
// always direct-labelled in the legend) and the verified-vs-estimated share
// (same hue, estimated hatched — a texture, not a warning colour).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { C, Fonts } from '@/constants/theme';
import { CHART } from './chart-theme';
import type { MealKind } from '@/lib/insights';

const BAR_H = 34;
const GAP = 3;

const MEAL_ORDER: MealKind[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const MEAL_LABEL: Record<MealKind, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };

export function MealTypeBar({ split }: { split: Record<MealKind, number> }) {
  const [w, setW] = useState(0);
  const total = MEAL_ORDER.reduce((s, m) => s + Math.max(0, split[m]), 0);
  const shown = MEAL_ORDER.filter((m) => split[m] > 0);

  // C2: describe the split in words — the SVG says nothing to a screen reader.
  const a11y = total === 0
    ? 'Chart. No meals logged this week yet.'
    : 'Where your calories came from this week: '
      + shown.map((m) => `${MEAL_LABEL[m]} ${Math.round((split[m] / total) * 100)}%`).join(', ')
      + '.';

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11y}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && total > 0 ? (
          <Svg width={w} height={BAR_H}>
            {(() => {
              const gaps = Math.max(0, shown.length - 1) * GAP;
              const avail = w - gaps;
              let x = 0;
              return shown.map((m) => {
                const width = (split[m] / total) * avail;
                const rect = <Rect key={m} x={x} y={0} width={Math.max(0, width)} height={BAR_H} rx={4} fill={CHART.meal[m]} />;
                x += width + GAP;
                return rect;
              });
            })()}
          </Svg>
        ) : null}
      </View>
      <View style={s.legend}>
        {MEAL_ORDER.map((m) => (
          <View key={m} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: CHART.meal[m] }]} />
            <Text style={s.legendText}>
              {MEAL_LABEL[m]} {total > 0 ? `${Math.round((split[m] / total) * 100)}%` : '—'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function VerifiedShare({ verifiedPct }: { verifiedPct: number }) {
  // C2: the hatching carries the honesty claim visually; this carries it aloud.
  const a11yShare =
    `Chart. ${Math.round(verifiedPct)}% of this week's calories come from verified `
    + `foods, ${Math.round(100 - verifiedPct)}% from estimates.`;
  const [w, setW] = useState(0);
  const vPct = Math.max(0, Math.min(100, verifiedPct));
  const ePct = 100 - vPct;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11yShare}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <Svg width={w} height={BAR_H}>
            <Defs>
              <Pattern id="vs-hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                <Rect width={6} height={6} fill={CHART.sageSoft} />
                <Line x1={0} y1={0} x2={0} y2={6} stroke={CHART.sage} strokeWidth={2} />
              </Pattern>
            </Defs>
            {(() => {
              const avail = w - (vPct > 0 && ePct > 0 ? GAP : 0);
              const vW = (vPct / 100) * avail;
              const eW = (ePct / 100) * avail;
              return (
                <>
                  {vPct > 0 ? <Rect x={0} y={0} width={vW} height={BAR_H} rx={4} fill={CHART.sage} /> : null}
                  {vW > 96 ? (
                    <SvgText x={12} y={BAR_H / 2 + 4} fontSize={12} fill={CHART.onFill} fontFamily="monospace">{vPct}% verified</SvgText>
                  ) : null}
                  {ePct > 0 ? <Rect x={vW + GAP} y={0} width={eW} height={BAR_H} rx={4} fill="url(#vs-hatch)" stroke={CHART.sage} strokeWidth={1} /> : null}
                </>
              );
            })()}
          </Svg>
        ) : null}
      </View>
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: CHART.sage }]} /><Text style={s.legendText}>Verified {vPct}%</Text></View>
        <View style={s.legendItem}><View style={[s.swatch, s.swatchHatch]} /><Text style={s.legendText}>Estimated (est.) {ePct}%</Text></View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  swatchHatch: { backgroundColor: CHART.sageSoft, borderWidth: 1, borderColor: CHART.sage },
  legendText: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkSoft },
});
