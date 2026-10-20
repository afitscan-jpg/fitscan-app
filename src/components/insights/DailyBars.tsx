// src/components/insights/DailyBars.tsx
// A 7-day bar chart of one daily metric against a soft target. Anti-guilt by
// construction: one calm sage hue, target as a dashed NEUTRAL reference (never a
// red ceiling), over-target shown as a lighter tint of the same hue, estimated
// days hatched (a texture, not a warning), unlogged days drawn as a faint dotted
// absence (never a broken streak), y-axis always from 0.
//
// v2 §18 — motion (release-safe): bars draw up (scaleY from a bottom origin),
// staggered, ONCE per screen focus; tap a day to lift it + reveal a fact line;
// the estimate hatch rides the scaleY and never flattens. The bars are SVG rects,
// so the draw/lift use LEGACY RN Animated on the <G> transform props (the ring's
// proven path) — NEVER useAnimatedProps on SVG, NEVER entering/exiting.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { C, Fonts } from '@/constants/theme';
import { CHART, niceMax } from './chart-theme';

export interface BarDatum {
  value: number;
  hasData: boolean;
  est: boolean;
  label: string;
  isToday: boolean;
}

const H = 188;
const PAD = { l: 34, r: 12, t: 26, b: 26 };
const EASE_OUT = Easing.bezier(0.2, 0.7, 0.2, 1);
const CB_SPRING = { damping: 14, stiffness: 180, mass: 1 } as const;

const AnimatedG = Animated.createAnimatedComponent(G);

export function DailyBars({
  data,
  target,
  avg,
  yStep,
  unit = '',
}: {
  data: BarDatum[];
  target: number | null;
  avg: number | null;
  yStep: number;
  unit?: string;
}) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const max = niceMax(data.map((d) => d.value), target, yStep);
  const x0 = PAD.l;
  const y0 = PAD.t;
  const y1 = H - PAD.b;
  const plotW = Math.max(0, w - x0 - PAD.r);
  const yFor = (v: number) => y1 - (Math.min(v, max) / max) * (y1 - y0);
  const slot = data.length > 0 ? plotW / data.length : 0;
  const barW = Math.min(slot * 0.56, 30);

  // One legacy Animated.Value per bar for the draw (0→1) and the lift (0→1).
  // Rebuilt only if the day count changes (it is a stable 7).
  const dayCount = data.length;
  const draw = useMemo(() => Array.from({ length: dayCount }, () => new Animated.Value(0)), [dayCount]);
  const lift = useMemo(() => Array.from({ length: dayCount }, () => new Animated.Value(0)), [dayCount]);
  const [factO] = useState(() => new Animated.Value(0));

  // Draw-up ONCE per screen focus (not on every re-render). Reduced motion: the
  // same value drives opacity instead of scaleY (a fade, no transform).
  const play = useCallback(() => {
    draw.forEach((v) => v.setValue(0));
    Animated.stagger(
      40,
      draw.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 340, easing: EASE_OUT, useNativeDriver: false }),
      ),
    ).start();
  }, [draw]);

  // Each focus clears the tapped day and bumps the tick that replays the draw.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setSel(null); setFocusTick((n) => n + 1); }, []));
  useEffect(() => {
    if (w <= 0) return;
    play();
  }, [focusTick, w, play]);

  // Tap-lift: spring the selected bar up, settle the rest; fade the fact line.
  useEffect(() => {
    lift.forEach((v, i) => {
      Animated.spring(v, { toValue: sel === i ? 1 : 0, useNativeDriver: false, ...CB_SPRING }).start();
    });
    Animated.timing(factO, {
      toValue: sel != null ? 1 : 0,
      duration: 200,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [sel, lift, factO]);

  // C2: an SVG tree conveys nothing to a screen reader — the numbers exist only
  // as geometry. One sentence describing the SHAPE of the week is far more use
  // than reading seven values aloud, and it names the estimated days because
  // that is the honesty claim the hatching makes visually.
  const logged = data.filter((d) => d.hasData && d.value > 0);
  const estCount = logged.filter((d) => d.est).length;
  const loggedAvg = logged.length
    ? Math.round(logged.reduce((sum, d) => sum + d.value, 0) / logged.length)
    : 0;
  const a11ySummary = logged.length === 0
    ? 'Chart. Nothing logged in the last 7 days yet.'
    : `Chart of the last 7 days. ${logged.length} of 7 days logged, averaging `
      + `${loggedAvg}${target != null && target > 0 ? ` against a target of ${target}` : ''}.`
      + (estCount ? ` ${estCount} of those ${estCount === 1 ? 'is an estimate' : 'are estimates'}.` : '');

  const selDatum = sel != null ? data[sel] : null;
  const factText = selDatum ? buildFact(selDatum, target, unit) : ' ';

  // Target label: inside the plot at the LEFT, above the line, on a card-coloured
  // backing so it stays legible over a bar. Today's bar, its value label and the
  // SVG's right bound all sit at the right edge, where the label used to clip
  // ("ta…") and collide with the value label (a stray mark after "target").
  // Integer, so a derived target never prints as "112.64".
  const targetLabel = target != null && target > 0 ? `target ${Math.round(target).toLocaleString()}` : null;
  const targetLabelW = targetLabel ? targetLabel.length * 5.6 + 8 : 0; // monospace 9px ≈ 5.6px/char

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11ySummary}
    >
      {w > 0 ? (
        <>
          <View>
            <Svg width={w} height={H}>
              <Defs>
                <Pattern id="db-hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
                  <Rect width={6} height={6} fill={CHART.sageSoft} />
                  <Line x1={0} y1={0} x2={0} y2={6} stroke={CHART.sage} strokeWidth={2} />
                </Pattern>
              </Defs>

              {/* baseline + a faint mid gridline */}
              <Line x1={x0} y1={y1} x2={w - PAD.r} y2={y1} stroke={CHART.grid} strokeWidth={1} />
              <Line x1={x0} y1={yFor(max / 2)} x2={w - PAD.r} y2={yFor(max / 2)} stroke={CHART.grid} strokeWidth={1} />
              {/* y labels: 0 and max */}
              <SvgText x={x0 - 6} y={y1 + 3} fontSize={9} fill={CHART.axisText} textAnchor="end" fontFamily="monospace">0</SvgText>
              <SvgText x={x0 - 6} y={y0 + 3} fontSize={9} fill={CHART.axisText} textAnchor="end" fontFamily="monospace">
                {max >= 1000 ? `${(max / 1000).toFixed(max % 1000 === 0 ? 0 : 1)}k` : String(max)}
              </SvgText>

              {/* weekly average — faint dotted */}
              {avg != null && avg > 0 ? (
                <Line x1={x0} y1={yFor(avg)} x2={w - PAD.r} y2={yFor(avg)} stroke={CHART.avg} strokeWidth={1} strokeDasharray="1 4" />
              ) : null}

              {/* target — soft dashed NEUTRAL reference */}
              {target != null && target > 0 && targetLabel ? (
                <G>
                  <Line x1={x0} y1={yFor(target)} x2={w - PAD.r} y2={yFor(target)} stroke={CHART.target} strokeWidth={1.5} strokeDasharray="5 4" />
                  <Rect x={x0 + 4} y={yFor(target) - 15} width={targetLabelW} height={13} rx={4} fill={C.card} />
                  <SvgText x={x0 + 8} y={yFor(target) - 5} fontSize={9} fill={CHART.target} textAnchor="start" fontFamily="monospace">
                    {targetLabel}
                  </SvgText>
                </G>
              ) : null}

              {/* bars */}
              {data.map((d, i) => {
                const cx = x0 + slot * i + (slot - barW) / 2;
                const mid = x0 + slot * i + slot / 2;
                if (!d.hasData || d.value <= 0) {
                  // unlogged day: a faint dotted absence at the baseline
                  return (
                    <G key={d.label + i}>
                      <Line x1={cx} y1={y1} x2={cx + barW} y2={y1} stroke={CHART.inkFaint} strokeWidth={1.5} strokeDasharray="1 3" opacity={0.6} />
                      <SvgText x={mid} y={y1 + 15} fontSize={10} fill={d.isToday ? CHART.todayRing : CHART.axisText} textAnchor="middle" fontWeight={d.isToday ? '600' : '400'}>{d.label}</SvgText>
                    </G>
                  );
                }
                const by = yFor(d.value);
                const bh = y1 - by;
                const over = target != null && d.value > target ? yFor(target) - by : 0; // height of the above-target sliver
                const selected = sel === i;

                // Transform composition on the <G> (origin = bottom-centre):
                //   draw   → scaleY 0→1 (grows from baseline)
                //   lift   → scale 1→1.04 + translateY 0→-6 on select
                // Reduced motion: no transform; the draw value drives opacity, and
                // a static outline marks selection ("brightens", no lift).
                const liftScale = reduceMotion ? 1 : lift[i].interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
                const liftTY = reduceMotion ? 0 : lift[i].interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
                const gProps = reduceMotion
                  ? { opacity: draw[i] }
                  : {
                      originX: mid,
                      originY: y1,
                      scaleX: liftScale as Animated.AnimatedInterpolation<number>,
                      scaleY: Animated.multiply(draw[i], liftScale) as unknown as number,
                      translateY: liftTY as unknown as number,
                    };
                return (
                  <G key={d.label + i}>
                    <AnimatedG {...gProps}>
                      <Rect x={cx} y={by} width={barW} height={bh} rx={4} fill={d.est ? 'url(#db-hatch)' : CHART.sage} stroke={d.est ? CHART.sage : 'none'} strokeWidth={d.est ? 1 : 0} />
                      {over > 0 ? <Rect x={cx} y={by} width={barW} height={Math.max(2, over)} rx={4} fill={CHART.sageSoft} /> : null}
                      {d.isToday ? (
                        <Rect x={cx} y={by} width={barW} height={bh} rx={4} fill="none" stroke={CHART.todayRing} strokeWidth={2} />
                      ) : null}
                    </AnimatedG>
                    {/* selection outline for reduced motion (static "brighten") */}
                    {reduceMotion && selected ? (
                      <Rect x={cx - 2} y={by - 2} width={barW + 4} height={bh + 2} rx={5} fill="none" stroke={CHART.todayRing} strokeWidth={2} />
                    ) : null}
                    {/* static labels — never scale (would distort) */}
                    {d.isToday ? (
                      <SvgText x={mid} y={by - 6} fontSize={10.5} fill={CHART.ink} textAnchor="middle" fontFamily="monospace" fontWeight="500">{d.value.toLocaleString()}</SvgText>
                    ) : null}
                    {d.est ? <SvgText x={mid} y={y1 - 5} fontSize={8.5} fill={CHART.sage} textAnchor="middle" fontFamily="monospace">est</SvgText> : null}
                    <SvgText x={mid} y={y1 + 15} fontSize={10} fill={d.isToday ? CHART.todayRing : CHART.axisText} textAnchor="middle" fontWeight={d.isToday ? '600' : '400'}>{d.label}</SvgText>
                  </G>
                );
              })}
            </Svg>

            {/* Touch targets — RN Pressables per column (reliable hit-testing).
                Only logged days lift; tapping elsewhere clears the selection. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {data.map((d, i) => {
                const tappable = d.hasData && d.value > 0;
                return (
                  <Pressable
                    key={d.label + i}
                    onPress={() => setSel((cur) => (tappable ? (cur === i ? null : i) : null))}
                    style={{ position: 'absolute', left: x0 + slot * i, top: y0, width: slot, height: y1 - y0 }}
                    accessibilityRole="button"
                    accessibilityLabel={tappable ? `${d.label}, ${d.value.toLocaleString()} ${unit}${d.est ? ', estimated' : ''}` : `${d.label}, nothing logged`}
                  />
                );
              })}
            </View>
          </View>

          {/* Fact line — fades/rises in for the tapped day (RN view → Reanimated-
              free; opacity/translate via native-driven legacy Animated). */}
          <Animated.View
            style={[
              db.fact,
              { opacity: factO, transform: [{ translateY: factO.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] },
            ]}
            pointerEvents="none"
          >
            <Text style={db.factText} numberOfLines={1}>{factText}</Text>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

// A short, neutral fact for the tapped day — anti-guilt wording, no red.
function buildFact(d: BarDatum, target: number | null, unit: string): string {
  const u = unit ? ` ${unit}` : '';
  let s = `${d.label} · ${d.value.toLocaleString()}${u}`;
  if (d.est) s += ' · estimated';
  if (target != null && target > 0) {
    const diff = Math.round(d.value - target);
    if (diff === 0) s += ' · right on target';
    else s += ` · ${Math.abs(diff).toLocaleString()}${u} ${diff > 0 ? 'over' : 'under'} target`;
  }
  return s;
}

const db = StyleSheet.create({
  fact: {
    minHeight: 20,
    justifyContent: 'center',
    paddingTop: 8,
  },
  factText: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkSoft,
    textAlign: 'center',
  },
});
