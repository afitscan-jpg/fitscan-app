import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient as SvgLinearGradient, Defs, Stop, Svg } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  Easing as REasing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { GlassCard } from '@/components/glass-card';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { WeightCard } from '@/components/weight-card';
import { useCountUp } from '@/hooks/use-count-up';
import { Icon } from '@/components/Icon';
import { C, Fonts, Gradients, Radius, RingGradient, Shadow, Spacing } from '@/constants/theme';
import {
  addWater,
  deleteFoodLog,
  getDailyTotals,
  getDataFootprint,
  getProfile,
  getStreak,
  getTodayLog,
  getWaterToday,
  getWeekTotals,
  updateFoodLog,
  type DailyTotals,
  type DayTotal,
  type Goal,
  type Profile,
  type Streak,
} from '@/lib/db';
import { authFetch, PaywallError } from '@/lib/api';
import { getEntitlement, trialDaysLeft, type Entitlement } from '@/lib/entitlement';
import { getAuthState } from '@/lib/auth';
import { getExerciseLogs, type ExerciseLog } from '@/lib/exercises';
import { PaywallSheet } from '@/components/paywall-sheet';

// Session-scoped dismiss flag for the account nudge — once dismissed it won't
// reappear until the app is relaunched (kept in memory on purpose).
let accountNudgeDismissed = false;

// ─── Types ───────────────────────────────────────────────────────────────────

type TodayEntry = Awaited<ReturnType<typeof getTodayLog>>[number];
type WaterData = { ml: number; glasses: number };

interface WeekInsight {
  readout: string;
  one_change: string;
  tomorrow_plan: string;
  days_logged: number;
  week_start: string;
}

// ─── Calorie ring — gradient + mount animation ───────────────────────────────

const RING_SIZE   = 148;
const RING_R      = 62;
const RING_STROKE = 13;
const RING_CIRCUM = 2 * Math.PI * RING_R; // ≈ 389.6
const GRADIENT_ID = 'calRingGrad';

// react-native-svg circle doesn't directly accept Animated values via
// Animated.createAnimatedComponent in all RN versions, so we animate a wrapper
// View's scale as a glow and drive the dashoffset via a JS-animated value
// interpolated as a string prop. We pass it as `strokeDashoffset` directly.

const AnimatedCircleWrapper = Animated.createAnimatedComponent(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-svg').Circle,
);

function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const ratio  = target > 0 ? Math.min(eaten / target, 1) : 0;
  const targetOffset = RING_CIRCUM * (1 - ratio);
  const diff = target - eaten;
  const over = diff < 0;

  const animOffset = useRef(new Animated.Value(RING_CIRCUM)).current;
  const firstSweep = useRef(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Count the centre "kcal left/over" number when it changes (e.g. after a log).
  const displayDiff = useCountUp(diff, 350);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      animOffset.setValue(targetOffset);
      return;
    }
    if (firstSweep.current) {
      // First mount: full sweep from empty for the signature reveal.
      firstSweep.current = false;
      animOffset.setValue(RING_CIRCUM);
      Animated.timing(animOffset, {
        toValue: targetOffset,
        duration: 1100,
        easing: Easing.bezier(0.2, 0.7, 0.2, 1),
        useNativeDriver: false,
      }).start();
    } else {
      // Data refresh after a log: ease from the current arc to the new value.
      Animated.timing(animOffset, {
        toValue: targetOffset,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [targetOffset, reduceMotion, animOffset]);

  return (
    <View style={rs.wrap}>
      {/* Soft green glow behind the ring */}
      <View style={rs.glow} />
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <Defs>
          <SvgLinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={RingGradient.from} />
            <Stop offset="0.55" stopColor={RingGradient.mid} />
            <Stop offset="1" stopColor={RingGradient.to} />
          </SvgLinearGradient>
        </Defs>
        {/* Track */}
        <AnimatedCircleWrapper
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(74,58,34,0.06)"
          strokeWidth={RING_STROKE}
        />
        {/* Animated progress */}
        <AnimatedCircleWrapper
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={`url(#${GRADIENT_ID})`}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUM}
          strokeDashoffset={animOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={rs.center}>
        <Text style={rs.num}>{Math.abs(Math.round(displayDiff)).toLocaleString()}</Text>
        <Text style={rs.label}>{over ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: RING_SIZE / 2,
    backgroundColor: 'rgba(76,124,99,0.08)',
  },
  center: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 38,
    fontWeight: '700',
    color: C.ink,
    lineHeight: 40,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 5,
    fontWeight: '500',
  },
});

// ─── Verdict dot ─────────────────────────────────────────────────────────────

const VERDICT_COLORS: Record<string, string> = {
  good: C.green,
  ok:   C.amber,
  avoid:C.red,
};

function VerdictDot({ verdict }: { verdict: string | null }) {
  const color = verdict ? (VERDICT_COLORS[verdict] ?? C.inkFaint) : C.inkFaint;
  return <View style={[dot.circle, { backgroundColor: color }]} />;
}

const dot = StyleSheet.create({
  circle: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
});

// ─── Week balance strip (dark card) ──────────────────────────────────────────

const MON_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return MON_LABELS[(new Date(y, m - 1, d).getDay() + 6) % 7];
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function WeekStrip({ days, target }: { days: DayTotal[]; target: number }) {
  const today     = todayStr();
  const logged    = days.filter((d) => d.items > 0).length;
  const metaText  = days.length === 0 ? '' : `${logged} of 7 logged`;

  return (
    <View style={wk.card}>
      <View style={wk.header}>
        <Text style={wk.title}>This week</Text>
        {metaText ? <Text style={wk.meta}>{metaText}</Text> : null}
      </View>
      <View style={wk.dots}>
        {days.map((day) => {
          const isToday  = day.log_date === today;
          const hasData  = day.items > 0;
          const ratio    = target > 0 && hasData ? day.kcal / target : 0;
          const dotColor = !hasData
            ? 'rgba(74,58,34,0.1)'
            : ratio <= 1.1
              ? C.green
              : ratio <= 1.25
                ? C.amber
                : C.red;
          // Past days open a read-only detail view; today's dot behaves as before
          // (the live diary already lives on Home), so it stays inert.
          const Cell = isToday ? View : Pressable;
          return (
            <Cell
              key={day.log_date}
              style={wk.day}
              {...(isToday
                ? {}
                : {
                    onPress: () => router.push(`/day?date=${day.log_date}` as never),
                    accessibilityRole: 'button' as const,
                    accessibilityLabel: `View ${dayLabel(day.log_date)}`,
                    hitSlop: 8,
                  })}
            >
              <Text style={[wk.dayLabel, isToday && wk.dayLabelToday]}>
                {dayLabel(day.log_date)}
              </Text>
              <View style={[wk.dot, { backgroundColor: dotColor }, isToday && wk.dotToday]} />
            </Cell>
          );
        })}
      </View>
    </View>
  );
}

const wk = StyleSheet.create({
  card: {
    // White v3 card
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 19,
    paddingTop: 18,
    paddingBottom: 16,
    ...Shadow.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title:  { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 15, color: C.ink },
  meta:   { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint },
  dots:   { flexDirection: 'row', justifyContent: 'space-between' },
  day:    { alignItems: 'center', gap: 8 },
  dayLabel:      { fontFamily: Fonts?.body ?? 'system', fontSize: 10.5, color: C.inkFaint },
  dayLabelToday: { color: C.ink, fontWeight: '600' },
  dot: { width: 23, height: 23, borderRadius: 12 },
  dotToday: { borderWidth: 2, borderColor: C.accent },
});

// ─── Week AI insight card ─────────────────────────────────────────────────────

function WeekInsightCard({
  data,
  loading,
  onRefresh,
}: {
  data: WeekInsight | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (!loading && !data) return null;

  if (loading && !data) {
    return (
      <View style={wi.card}>
        <SkeletonPulse style={wi.skGroup}>
          <View style={wi.skRow}>
            <View style={wi.skChip} />
            <View style={wi.skBadge} />
          </View>
          <View style={[wi.skLine, { width: '95%' }]} />
          <View style={[wi.skLine, { width: '80%' }]} />
          <View style={[wi.skLine, { width: '65%' }]} />
          <View style={[wi.skLine, { width: '50%', marginTop: 8 }]} />
          <View style={[wi.skLine, { width: '85%' }]} />
        </SkeletonPulse>
      </View>
    );
  }

  if (!data) return null;

  return (
    <GlassCard
      contentStyle={wi.card}
      colors={Gradients.coach}
      borderColor="rgba(76,124,99,0.16)"
    >
      <View style={wi.header}>
        <View style={wi.headerLeft}>
          <View style={wi.aiIcon}>
            <Icon name="spark" color="#fff" size={16} strokeWidth={2} />
          </View>
          <Text style={wi.title}>Your week</Text>
          <View style={wi.badge}>
            <Text style={wi.badgeText}>{data.days_logged} of 7 logged</Text>
          </View>
        </View>
        <AnimatedPressable onPress={onRefresh} hitSlop={12} style={wi.refreshBtn} disabled={loading}>
          <Icon name="refresh" color={C.inkFaint} size={16} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      <Text style={wi.readout}>{data.readout}</Text>

      <View style={wi.section}>
        <Text style={wi.sectionLabel}>One change to try</Text>
        <Text style={wi.sectionBody}>{data.one_change}</Text>
      </View>

      <View style={wi.section}>
        <Text style={wi.sectionLabel}>Tomorrow</Text>
        <Text style={wi.sectionBody}>{data.tomorrow_plan}</Text>
        <AnimatedPressable onPress={() => router.push('/plan' as never)} hitSlop={8} style={wi.planLink}>
          <Text style={wi.planLinkText}>See full plan →</Text>
        </AnimatedPressable>
      </View>
    </GlassCard>
  );
}

const wi = StyleSheet.create({
  card: {
    padding: 18,
    gap: 10,
  },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  aiIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 15,
    color: C.inkStrong,
  },
  badge: {
    backgroundColor: C.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    color: C.greenInk,
  },
  refreshBtn:  { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  readout: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14.5,
    color: C.inkSoft,
    lineHeight: 22,
  },
  section:      { gap: 3, marginTop: 2 },
  sectionLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: C.inkFaint,
  },
  sectionBody: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14,
    color: C.ink,
    lineHeight: 21,
  },
  // plan link
  planLink:     { marginTop: 5, alignSelf: 'flex-start' },
  planLinkText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 13,
    fontWeight: '600',
    color: C.green,
  },
  // skeleton
  skGroup: { gap: 10 },
  skRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skChip: { height: 14, width: 90, borderRadius: 7, backgroundColor: C.line },
  skBadge:{ height: 14, width: 70, borderRadius: 7, backgroundColor: C.line },
  skLine: { height: 12, borderRadius: 6, backgroundColor: C.line },
});

// ─── Water card ──────────────────────────────────────────────────────────────

const BOTTLE_INNER_H = 70;

// The centerpiece bottle: fills with a cyan gradient to `pct`, with a gentle
// looping wave shimmer on the surface.
function WaterBottle({ pct }: { pct: number }) {
  const fill = useSharedValue(Math.max(0, Math.min(1, pct)));
  const wave = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(1, pct)), { duration: 900, easing: REasing.out(REasing.cubic) });
  }, [pct, fill]);
  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 2200, easing: REasing.linear }), -1, false);
  }, [wave]);
  const fillStyle = useAnimatedStyle(() => ({ height: fill.value * BOTTLE_INNER_H }));
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -30 * wave.value }] }));
  return (
    <View style={wa.bottle}>
      <Reanimated.View style={[wa.bottleFill, fillStyle]}>
        <LinearGradient colors={Gradients.water} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <Reanimated.View style={[wa.wave, waveStyle]}>
          <LinearGradient
            colors={['rgba(191,234,243,0)', 'rgba(191,234,243,0.65)', 'rgba(191,234,243,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      </Reanimated.View>
    </View>
  );
}

function WaterCard({ glasses, goal, onAdd, adding }: {
  glasses: number; goal: number; onAdd: () => void; adding: boolean;
}) {
  const shownGlasses = Math.round(useCountUp(glasses, 350));
  const pct = goal > 0 ? glasses / goal : 0;
  const dropScale = useSharedValue(1);
  const dropStyle = useAnimatedStyle(() => ({ transform: [{ scale: dropScale.value }] }));

  function handlePress() {
    if (adding) return;
    dropScale.value = withSequence(
      withTiming(1.18, { duration: 110, easing: REasing.out(REasing.quad) }),
      withTiming(1, { duration: 130, easing: REasing.out(REasing.quad) }),
    );
    onAdd();
  }

  return (
    <GlassCard
      contentStyle={wa.card}
      colors={['#F2F7FA', '#FFFFFF']}
      borderColor="rgba(92,134,166,0.18)"
    >
      <View style={wa.left}>
        <WaterBottle pct={pct} />
        <View>
          <Text style={wa.eyebrow}>Hydration</Text>
          <Text style={wa.count}>
            <Text style={wa.countBold}>{shownGlasses}</Text>
            <Text style={wa.countSub}>{` / ${goal} glasses`}</Text>
          </Text>
        </View>
      </View>
      <AnimatedPressable onPress={handlePress} disabled={adding} pressedScale={0.92} style={wa.addBtnWrap}>
        <LinearGradient colors={Gradients.water} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={wa.addBtn}>
          <Reanimated.View style={dropStyle}>
            <Text style={wa.addPlus}>+</Text>
          </Reanimated.View>
          <Text style={wa.addSub}>{adding ? '…' : '250ml'}</Text>
        </LinearGradient>
      </AnimatedPressable>
    </GlassCard>
  );
}

const wa = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 18 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', color: C.waterBlueInk },
  count: { marginTop: 4 },
  countBold: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 23, fontWeight: '600', color: C.inkStrong, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  countSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft },
  bottle: {
    width: 46, height: 74,
    borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 13, borderBottomRightRadius: 13,
    borderWidth: 1.5, borderColor: 'rgba(92,134,166,0.22)',
    backgroundColor: '#EDF2F5', overflow: 'hidden', justifyContent: 'flex-end',
  },
  bottleFill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  wave: { position: 'absolute', top: -3, left: 0, width: '220%', height: 8 },
  addBtnWrap: { borderRadius: 20, ...Shadow.md },
  addBtn: {
    width: 60, height: 60, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  addPlus: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 22, color: '#fff', lineHeight: 24 },
  addSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 10, color: 'rgba(255,255,255,0.9)', marginTop: 1 },
});

// ─── Today list ──────────────────────────────────────────────────────────────

function formatQtyUnit(quantity: number | null | undefined, unit: string | null | undefined): string | null {
  if (quantity == null || unit == null) return null;
  if (unit === 'piece') return `${quantity} piece${quantity !== 1 ? 's' : ''}`;
  return `${quantity} ${unit}`;
}

const MEAL_TINT: Record<string, { bg: string; border: string; fg: string }> = {
  breakfast: { bg: '#F4EDE0', border: 'rgba(185,132,56,0.22)', fg: '#B98438' },
  lunch:     { bg: '#E9ECE6', border: 'rgba(76,124,99,0.22)',  fg: '#4C7C63' },
  snack:     { bg: '#E9EFF3', border: 'rgba(92,134,166,0.22)', fg: '#5C86A6' },
  dinner:    { bg: '#ECEAF2', border: 'rgba(107,94,140,0.22)', fg: '#6B5E8C' },
};

// Compact per-item macro line in grams: "P78 · C120 · F30". Rounds to whole
// numbers, omits any macro that's null, and hides the line entirely when there's
// no macro data at all (all null/zero) so scanned rows without macros stay clean.
function itemMacroLine(item: TodayEntry): string | null {
  const p = item.protein_g == null ? null : Math.round(Number(item.protein_g));
  const c = item.carbs_g   == null ? null : Math.round(Number(item.carbs_g));
  const f = item.fat_g     == null ? null : Math.round(Number(item.fat_g));
  if ((p ?? 0) === 0 && (c ?? 0) === 0 && (f ?? 0) === 0) return null;
  const parts: string[] = [];
  if (p != null) parts.push(`P${p}`);
  if (c != null) parts.push(`C${c}`);
  if (f != null) parts.push(`F${f}`);
  return parts.length ? parts.join(' · ') : null;
}

function TodayItem({ item, onEdit, onDelete }: { item: TodayEntry; onEdit: () => void; onDelete: () => void }) {
  const mealType    = (item.meal_type as string) ?? 'snack';
  const mealLabel   = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const sourceLabel = item.source === 'scan' ? 'Scanned' : item.source === 'quick_add' ? 'Quick add' : '';
  const qtyUnit     = formatQtyUnit(item.quantity, item.unit);
  const metaText    = qtyUnit ? `${mealLabel} · ${qtyUnit}` : mealLabel;
  const macroText   = itemMacroLine(item);
  const tint        = MEAL_TINT[mealType] ?? MEAL_TINT.snack;
  return (
    <Reanimated.View
      style={ti.card}
      entering={FadeInDown.duration(300)
        .easing(REasing.out(REasing.cubic))
        .withInitialValues({ transform: [{ translateY: 12 }] })}
    >
      <Pressable style={ti.rowMain} onPress={onEdit} accessibilityLabel={`Edit ${item.name}`}>
        <View style={[ti.tile, { backgroundColor: tint.bg, borderColor: tint.border }]}>
          <Text style={[ti.tileLetter, { color: tint.fg }]}>{mealLabel.charAt(0)}</Text>
        </View>
        <View style={ti.info}>
          <View style={ti.topRow}>
            <Text style={ti.name} numberOfLines={1}>
              {item.name}
              {sourceLabel ? <Text style={ti.tag}>{'  ·  '}{sourceLabel}</Text> : null}
            </Text>
            <Text style={ti.kcal}>
              {item.kcal}<Text style={ti.kcalUnit}> kcal</Text>
            </Text>
          </View>
          <View style={ti.metaRow}>
            <VerdictDot verdict={item.verdict ?? null} />
            <Text style={ti.meta} numberOfLines={1}>{metaText}</Text>
          </View>
          {macroText ? <Text style={ti.macro} numberOfLines={1}>{macroText}</Text> : null}
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={10} style={ti.delBtn}>
        <Text style={ti.delBtnText}>×</Text>
      </Pressable>
    </Reanimated.View>
  );
}

const ti = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingRight: 6,
    marginBottom: 11,
    ...Shadow.sm,
  },
  rowMain:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 11 },
  tile:      { width: 52, height: 52, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileLetter:{ fontFamily: Fonts?.display ?? 'system', fontSize: 22, fontWeight: '600' },
  info:      { flex: 1, gap: 5 },
  topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name:      { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, color: C.inkStrong, fontWeight: '600', flex: 1 },
  tag:       { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, fontWeight: '400' },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta:      { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, flex: 1 },
  macro:     { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkFaint, fontVariant: ['tabular-nums'], letterSpacing: 0.1 },
  kcal:      { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkStrong, fontVariant: ['tabular-nums'], flexShrink: 0 },
  kcalUnit:  { fontFamily: Fonts?.body ?? 'system', fontSize: 10.5, fontWeight: '400', color: C.inkFaint },
  delBtn:    { paddingHorizontal: 6, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  delBtnText:{ fontSize: 20, lineHeight: 24, color: C.inkDim },
});

// ─── Edit-a-logged-entry sheet ───────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

function EditLogBody({ entry, onClose, onSaved }: {
  entry: TodayEntry; onClose: () => void; onSaved: () => void;
}) {
  const hasQty  = entry.quantity != null && entry.unit != null;
  const isPiece = entry.unit === 'piece';
  const oldQty  = Number(entry.quantity) || 0;
  const oldKcal = Number(entry.kcal) || 0;
  const step    = isPiece ? 1  : 10;
  const minA    = isPiece ? 1  : 10;
  const maxA    = isPiece ? 20 : 2000;
  const unitLabel = isPiece ? (oldQty === 1 ? 'piece' : 'pieces') : String(entry.unit ?? '');

  const clampQty = (n: number) =>
    isPiece ? Math.max(1, Math.min(20, Math.round(n * 2) / 2)) : Math.max(1, Math.min(2000, Math.round(n)));

  const [qty, setQty]           = useState(hasQty ? oldQty : 0);
  const [qtyDraft, setQtyDraft] = useState(hasQty ? String(oldQty) : '');
  const [kcalDraft, setKcalDraft] = useState(String(oldKcal));
  const [saving, setSaving]     = useState(false);

  function applyQty(next: number) {
    const c = clampQty(next);
    setQty(c);
    setQtyDraft(String(c));
    if (hasQty && oldQty > 0) setKcalDraft(String(Math.round(oldKcal * (c / oldQty))));
  }
  function commitQty() {
    const parsed = isPiece ? parseFloat(qtyDraft) : parseInt(qtyDraft, 10);
    if (Number.isNaN(parsed)) { setQtyDraft(String(qty)); return; }
    applyQty(parsed);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const newKcal = Math.max(0, parseInt(kcalDraft, 10) || 0);
    const fields: {
      quantity?: number; kcal: number; protein_g?: number; carbs_g?: number; fat_g?: number;
    } = { kcal: newKcal };

    if (hasQty && oldQty > 0) {
      const ratio = qty / oldQty;
      fields.quantity  = qty;
      fields.protein_g = round1((Number(entry.protein_g) || 0) * ratio);
      fields.carbs_g   = round1((Number(entry.carbs_g)   || 0) * ratio);
      fields.fat_g     = round1((Number(entry.fat_g)     || 0) * ratio);
    } else {
      const ratio = oldKcal > 0 ? newKcal / oldKcal : 1;
      fields.protein_g = round1((Number(entry.protein_g) || 0) * ratio);
      fields.carbs_g   = round1((Number(entry.carbs_g)   || 0) * ratio);
      fields.fat_g     = round1((Number(entry.fat_g)     || 0) * ratio);
    }

    try {
      await updateFoodLog(entry.id, fields);
      onSaved();
    } catch {
      setSaving(false);
      Alert.alert('Could not save changes. Please try again.');
    }
  }

  return (
    <Pressable style={es.overlay} onPress={onClose}>
      <Pressable style={es.sheet} onPress={() => undefined}>
        <View style={es.handle} />
        <View style={es.headerRow}>
          <Text style={es.title} numberOfLines={1}>{entry.name}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={es.closeBtn}>
            <Text style={es.closeTxt}>×</Text>
          </Pressable>
        </View>

        {hasQty ? (
          <View style={es.fieldRow}>
            <Text style={es.fieldLabel}>Amount</Text>
            <View style={es.amtGroup}>
              <Pressable
                style={[es.stepBtn, qty <= minA && es.stepDim]}
                onPress={() => applyQty(qty - step)}
                disabled={qty <= minA}
                hitSlop={8}
              >
                <Text style={[es.stepTxt, qty <= minA && es.stepTxtDim]}>−</Text>
              </Pressable>
              <TextInput
                style={es.numInput}
                value={qtyDraft}
                onChangeText={(t) => setQtyDraft(isPiece ? t.replace(/[^0-9.]/g, '') : t.replace(/[^0-9]/g, ''))}
                onBlur={commitQty}
                onSubmitEditing={commitQty}
                keyboardType={isPiece ? 'decimal-pad' : 'number-pad'}
                returnKeyType="done"
                maxLength={6}
                selectTextOnFocus
              />
              <Pressable
                style={[es.stepBtn, qty >= maxA && es.stepDim]}
                onPress={() => applyQty(qty + step)}
                disabled={qty >= maxA}
                hitSlop={8}
              >
                <Text style={[es.stepTxt, qty >= maxA && es.stepTxtDim]}>+</Text>
              </Pressable>
              <Text style={es.unit}>{unitLabel}</Text>
            </View>
          </View>
        ) : null}

        <View style={es.fieldRow}>
          <Text style={es.fieldLabel}>Calories</Text>
          <View style={es.kcalGroup}>
            <TextInput
              style={es.numInput}
              value={kcalDraft}
              onChangeText={(t) => setKcalDraft(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={5}
              selectTextOnFocus
            />
            <Text style={es.unit}>kcal</Text>
          </View>
        </View>

        <Text style={es.hint}>
          {hasQty ? 'Calories & macros scale with the amount.' : 'Macros scale with the calories.'}
        </Text>

        <Pressable style={[es.saveBtn, saving && es.saveDim]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={es.saveTxt}>Save changes</Text>}
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const es = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  title: { flex: 1, fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkFaint },

  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  fieldLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.inkSoft },
  amtGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kcalGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
  stepDim: { borderColor: C.line },
  stepTxt: { fontSize: 18, lineHeight: 22, color: C.green, fontWeight: '500' },
  stepTxtDim: { color: C.inkFaint },
  numInput: {
    minWidth: 56,
    textAlign: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft },

  hint: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, marginTop: -4, marginBottom: 18 },
  saveBtn: { backgroundColor: C.green, borderRadius: Radius.md, height: 52, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  saveDim: { opacity: 0.7 },
  saveTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function proteinTarget(weight_kg: number | null, goal: Goal | undefined): number | null {
  if (weight_kg == null) return null;
  const factor =
    goal === 'build_muscle' || goal === 'recomp' ? 2.0 :
    goal === 'lose'         ? 1.8 :
    goal === 'gain'         ? 1.6 :
                              1.4;
  return Math.round((weight_kg * factor) / 5) * 5;
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

function macroTargets(
  weight_kg: number | null,
  goal: Goal | undefined,
  dailyTargetKcal: number | null,
): { protein_g: number; carbs_g: number; fat_g: number } | null {
  if (weight_kg == null || dailyTargetKcal == null) return null;
  const protein_g = proteinTarget(weight_kg, goal);
  if (protein_g == null) return null;
  const fat_g = Math.max(
    round5((0.27 * dailyTargetKcal) / 9),
    round5(0.5 * weight_kg),
  );
  const carbs_g = Math.max(0, round5((dailyTargetKcal - protein_g * 4 - fat_g * 9) / 4));
  return { protein_g, carbs_g, fat_g };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function goalLabel(g?: Profile['goal']): string {
  if (g === 'lose')          return 'Lose slowly';
  if (g === 'gain')          return 'Gain weight';
  if (g === 'build_muscle')  return 'Build muscle';
  if (g === 'recomp')        return 'Recomp';
  return 'Maintain';
}

// ─── Entitlement strip (trial banner / free usage chip / premium badge) ──────

function EntitlementStrip({ ent, onUpgrade }: { ent: Entitlement; onUpgrade: () => void }) {
  if (ent.is_premium && ent.status === 'premium') {
    return (
      <View style={ent$.premiumBadge}>
        <Icon name="spark" color={C.greenInk} size={13} strokeWidth={2} />
        <Text style={ent$.premiumText}>Premium</Text>
      </View>
    );
  }

  if (ent.status === 'trial') {
    const days = trialDaysLeft(ent.trial_ends);
    return (
      <AnimatedPressable style={ent$.trialBanner} onPress={onUpgrade}>
        <Text style={ent$.trialText}>
          ✨ {days} {days === 1 ? 'day' : 'days'} left in your free trial
        </Text>
        <Icon name="arrow" color={C.greenInk} size={15} strokeWidth={2} />
      </AnimatedPressable>
    );
  }

  // free
  const used = Math.min(ent.ai_used_today, ent.ai_limit);
  return (
    <AnimatedPressable style={ent$.freeChip} onPress={onUpgrade}>
      <Text style={ent$.freeText}>
        {used} of {ent.ai_limit} free AI logs used today
      </Text>
      <Text style={ent$.freeCta}>Upgrade</Text>
    </AnimatedPressable>
  );
}

function AccountNudge({ onPress, onDismiss }: { onPress: () => void; onDismiss: () => void }) {
  return (
    <View style={ent$.nudge}>
      <AnimatedPressable style={ent$.nudgeMain} onPress={onPress}>
        <Icon name="spark" color={C.greenInk} size={15} strokeWidth={2} />
        <Text style={ent$.nudgeText} numberOfLines={2}>
          Create an account to keep your progress safe
        </Text>
        <Icon name="arrow" color={C.greenInk} size={15} strokeWidth={2} />
      </AnimatedPressable>
      <Pressable onPress={onDismiss} hitSlop={10} style={ent$.nudgeClose} accessibilityLabel="Dismiss">
        <Text style={ent$.nudgeCloseTxt}>×</Text>
      </Pressable>
    </View>
  );
}

function InsightUpsellCard({ onPress }: { onPress: () => void }) {
  return (
    <AnimatedPressable onPress={onPress}>
      <GlassCard contentStyle={ent$.upsell} colors={Gradients.coach} borderColor="rgba(76,124,99,0.16)">
        <View style={ent$.upsellIcon}>
          <Icon name="spark" color="#fff" size={16} strokeWidth={2} />
        </View>
        <View style={ent$.upsellText}>
          <Text style={ent$.upsellTitle}>Unlock weekly insights</Text>
          <Text style={ent$.upsellSub}>An honest readout of your week — part of Premium.</Text>
        </View>
        <Icon name="arrow" color={C.green} size={17} strokeWidth={2} />
      </GlassCard>
    </AnimatedPressable>
  );
}

const ent$ = StyleSheet.create({
  trialBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(76,124,99,0.22)',
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  trialText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.greenInk, flexShrink: 1 },
  freeChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, ...Shadow.sm,
  },
  freeText: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft, flexShrink: 1 },
  freeCta: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.green },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: C.greenSoft, borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 5,
  },
  premiumText: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11.5, fontWeight: '600',
    letterSpacing: 0.3, color: C.greenInk,
  },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  upsellIcon: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  upsellText: { flex: 1, gap: 2 },
  upsellTitle: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 15, color: C.inkStrong },
  upsellSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, lineHeight: 17 },
  nudge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(76,124,99,0.22)',
    borderRadius: Radius.md, paddingLeft: 14, paddingRight: 6,
  },
  nudgeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 11 },
  nudgeText: { flex: 1, fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.greenInk },
  nudgeClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  nudgeCloseTxt: { fontSize: 18, lineHeight: 20, color: C.greenInk, opacity: 0.7 },
});

// ─── Workouts-today row ──────────────────────────────────────────────────────

// "sets/reps or duration" (+ weight/distance when present), from the log fields.
function workoutDetail(w: ExerciseLog): string {
  const parts: string[] = [];
  if (w.sets != null && w.reps != null) parts.push(`${w.sets} × ${w.reps}`);
  else if (w.sets != null) parts.push(`${w.sets} sets`);
  else if (w.reps != null) parts.push(`${w.reps} reps`);
  if (w.weight_kg != null) parts.push(`${w.weight_kg} kg`);
  if (w.duration_min != null) parts.push(`${w.duration_min} min`);
  if (w.distance_km != null) parts.push(`${w.distance_km} km`);
  return parts.join(' · ');
}

function WorkoutItem({ workout }: { workout: ExerciseLog }) {
  const detail = workoutDetail(workout);
  return (
    <View style={wo.card}>
      <View style={wo.tile}>
        <Icon name="dumbbell" color={C.greenInk} size={20} strokeWidth={1.9} />
      </View>
      <View style={wo.info}>
        <Text style={wo.name} numberOfLines={1}>{workout.exercise_name}</Text>
        {detail ? <Text style={wo.detail} numberOfLines={1}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const wo = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 11,
    marginBottom: 11,
    ...Shadow.sm,
  },
  tile: {
    width: 52, height: 52, borderRadius: 15,
    backgroundColor: C.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  name: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkStrong },
  detail: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, fontVariant: ['tabular-nums'] },
});

// ─── Streak pill ─────────────────────────────────────────────────────────────
// Anti-guilt by design: there is NO broken/red/lost state. A run of ≥2 days shows
// the count; a fresh or empty streak shows a warm invitation to log — never a
// "you broke it" message. A missed day just quietly makes current 0 again.
function StreakPill({ streak }: { streak: Streak | null }) {
  if (!streak) return null;
  const { current, loggedToday } = streak;

  let label: string;
  let active = true;
  if (current >= 2) {
    label = `${current} day streak`;
  } else if (current === 1) {
    label = loggedToday ? 'Day 1 — nice start' : 'Log today to keep your streak';
  } else {
    label = 'Log today to start a streak';
    active = false;
  }

  return (
    <View style={[stk.pill, active ? stk.pillActive : stk.pillIdle]} accessibilityLabel={label}>
      <Text style={stk.emoji}>🔥</Text>
      <Text style={[stk.text, active ? stk.textActive : stk.textIdle]}>{label}</Text>
    </View>
  );
}

const stk = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  pillActive: { backgroundColor: C.amberSoft, borderColor: 'rgba(185,132,56,0.25)' },
  pillIdle:   { backgroundColor: C.card, borderColor: C.cardBorder },
  emoji:      { fontSize: 13.5 },
  text:       { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600' },
  textActive: { color: C.amberInk },
  textIdle:   { color: C.inkSoft },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [totals,         setTotals]         = useState<DailyTotals | null>(null);
  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [log,            setLog]            = useState<TodayEntry[]>([]);
  const [weekData,       setWeekData]       = useState<DayTotal[]>([]);
  const [water,          setWater]          = useState<WaterData>({ ml: 0, glasses: 0 });
  const [loading,        setLoading]        = useState(true);
  const [addingWater,    setAddingWater]    = useState(false);
  const [insightData,    setInsightData]    = useState<WeekInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightLocked,  setInsightLocked]  = useState(false);
  const [editing,        setEditing]        = useState<TodayEntry | null>(null);
  const [ent,            setEnt]            = useState<Entitlement | null>(null);
  const [paywall,        setPaywall]        = useState<PaywallError | null>(null);
  const [nudgeVisible,   setNudgeVisible]   = useState(false);
  const [workouts,       setWorkouts]       = useState<ExerciseLog[]>([]);
  const [streak,         setStreak]         = useState<Streak | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, p, l, w, wk, st] = await Promise.all([
        getDailyTotals(), getProfile(), getTodayLog(), getWaterToday(), getWeekTotals(), getStreak(),
      ]);
      setTotals(t); setProfile(p); setLog(l); setWater(w); setWeekData(wk); setStreak(st);
    } catch (e) {
      console.warn('[Home] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsight = useCallback(async (force = false) => {
    setInsightLoading(true);
    try {
      const res = await authFetch('/insights/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(force ? { force: true } : {}),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json: { insight: WeekInsight } = await res.json();
      setInsightData(json.insight);
      setInsightLocked(false);
    } catch (e) {
      if (e instanceof PaywallError) {
        // Insights are premium-only (limit_reached shouldn't occur, but treat it
        // the same). Show the upsell card instead of silently vanishing.
        setInsightLocked(true);
        setInsightData(null);
      }
      // other failures: keep existing data if any; hide card if none
    } finally {
      setInsightLoading(false);
    }
  }, []);

  const loadEnt = useCallback(async () => {
    const e = await getEntitlement();
    if (e) setEnt(e);
  }, []);

  // Today's logged workouts. Kept separate/resilient like loadEnt/loadNudge so a
  // backend hiccup never blanks the core (Supabase) Home data in load().
  const loadWorkouts = useCallback(async () => {
    try {
      setWorkouts(await getExerciseLogs(todayStr()));
    } catch {
      // backend optional — leave any existing list in place
    }
  }, []);

  // Gentle account nudge: only for an anonymous user who has meaningful data
  // (>= 5 food logs OR any weight logs), and only until dismissed this session.
  const loadNudge = useCallback(async () => {
    if (accountNudgeDismissed) return;
    try {
      const st = await getAuthState();
      if (!st.isAnonymous) { setNudgeVisible(false); return; }
      const fp = await getDataFootprint();
      if (!accountNudgeDismissed && (fp.foodLogs >= 5 || fp.weightLogs > 0)) {
        setNudgeVisible(true);
      }
    } catch {
      // A failed footprint/auth check simply means no nudge — never block Home.
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    loadInsight();
    loadEnt();
    loadNudge();
    loadWorkouts();
  }, [load, loadInsight, loadEnt, loadNudge, loadWorkouts]));

  function handleDelete(id: string, name: string) {
    Alert.alert('Remove this entry?', name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFoodLog(id);
            await load();
          } catch { /* silently ignore */ }
        },
      },
    ]);
  }

  async function handleAddWater() {
    setAddingWater(true);
    try {
      await addWater(250);
      const w = await getWaterToday();
      setWater(w);
    } catch { /* ignore */ }
    finally { setAddingWater(false); }
  }

  const target      = profile?.daily_target_kcal ?? 2000;
  const maintenance = profile?.maintenance_kcal  ?? target;
  const eaten       = totals?.kcal ?? 0;
  const waterGoal   = profile?.water_goal_glasses ?? 8;
  const dayName     = DAYS[new Date().getDay()];
  const targets     = macroTargets(profile?.weight_kg ?? null, profile?.goal, profile?.daily_target_kcal ?? null);

  // Stagger the main sections in on first appearance only (not on every focus).
  const didStagger = useRef(false);
  useEffect(() => { if (!loading) didStagger.current = true; }, [loading]);
  const enter = (i: number) =>
    didStagger.current
      ? undefined
      : FadeInDown.duration(300)
          .delay(i * 60)
          .easing(REasing.out(REasing.cubic))
          .withInitialValues({ transform: [{ translateY: 12 }] });

  return (
    <View style={hs.root}>
      <AmbientBackground />
      <SafeAreaView style={hs.flex} edges={['top']}>
        <ScrollView style={hs.flex} contentContainerStyle={hs.scroll} showsVerticalScrollIndicator={false}>

          {/* Greeting */}
          <View style={hs.greet}>
            <View style={hs.greetText}>
              <Text style={hs.eyebrow}>{dayName}</Text>
              <Text style={hs.greetTitle}>{greeting()}</Text>
            </View>
            <AnimatedPressable
              onPress={() => router.push('/settings' as never)}
              hitSlop={10}
              style={hs.gearBtn}
              accessibilityLabel="Settings"
            >
              <Icon name="gear" color={C.inkSoft} size={22} strokeWidth={1.8} />
            </AnimatedPressable>
          </View>

          {/* Logging streak (anti-guilt: never a broken/red state) */}
          <StreakPill streak={streak} />

          {/* Plan status: trial banner / free usage chip / premium badge */}
          {ent ? (
            <EntitlementStrip ent={ent} onUpgrade={() => router.push('/premium' as never)} />
          ) : null}

          {/* Gentle, dismissible account nudge (never blocks anything) */}
          {nudgeVisible ? (
            <AccountNudge
              onPress={() => router.push('/account' as never)}
              onDismiss={() => { accountNudgeDismissed = true; setNudgeVisible(false); }}
            />
          ) : null}

          {loading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <View style={[hs.loadingCard, { alignItems: 'center', paddingVertical: 40 }]}>
                <Text style={hs.loadingText}>Loading…</Text>
              </View>
            </View>
          ) : (
            <>
              {/* ── Calorie card ── */}
              <Reanimated.View entering={enter(0)}>
               <GlassCard contentStyle={hs.calCard}>
                {/* Ring — centered hero */}
                <CalorieRing eaten={eaten} target={target} />

                {/* Stats row below the ring */}
                <View style={hs.statsRow}>
                  <View style={hs.stat}>
                    <Text style={hs.statKey}>Maintenance</Text>
                    <Text style={hs.statVal}>{maintenance.toLocaleString()}</Text>
                  </View>
                  <View style={[hs.stat, hs.statDiv]}>
                    <Text style={hs.statKey}>Eaten</Text>
                    <Text style={hs.statVal}>{eaten.toLocaleString()}</Text>
                  </View>
                  <View style={[hs.stat, hs.statDiv]}>
                    <Text style={hs.statKey}>Goal</Text>
                    <Text style={[hs.statVal, hs.statGoal]}>{goalLabel(profile?.goal)}</Text>
                  </View>
                </View>

                {/* Macros */}
                <View style={hs.macros}>
                  <MacroChip label="Protein" value={totals?.protein_g ?? 0} unit="g" target={targets?.protein_g ?? null} emphasis />
                  <MacroChip label="Carbs"   value={totals?.carbs_g   ?? 0} unit="g" target={targets?.carbs_g   ?? null} />
                  <MacroChip label="Fat"     value={totals?.fat_g      ?? 0} unit="g" target={targets?.fat_g      ?? null} />
                </View>
                <Text style={hs.disclaimer}>Estimates for general guidance, not medical advice. Consult a doctor if you have a health condition.</Text>
               </GlassCard>
              </Reanimated.View>

              {/* Week balance */}
              <Reanimated.View entering={enter(1)}>
                <WeekStrip days={weekData} target={target} />
              </Reanimated.View>

              {/* AI weekly insight (or a Premium upsell when it's locked) */}
              <Reanimated.View entering={enter(2)}>
                {insightLocked ? (
                  <InsightUpsellCard
                    onPress={() => setPaywall(new PaywallError('premium', { feature: 'insights' }))}
                  />
                ) : (
                  <WeekInsightCard
                    data={insightData}
                    loading={insightLoading}
                    onRefresh={() => loadInsight(true)}
                  />
                )}
              </Reanimated.View>

              {/* Water */}
              <Reanimated.View entering={enter(3)}>
                <WaterCard glasses={water.glasses} goal={waterGoal} onAdd={handleAddWater} adding={addingWater} />
              </Reanimated.View>

              {/* Weight */}
              <Reanimated.View entering={enter(4)}>
                <WeightCard />
              </Reanimated.View>

              {/* Today list */}
              <View>
                <View style={hs.secHeader}>
                  <Text style={hs.secTitle}>Today</Text>
                  <AnimatedPressable style={hs.secLinkWrap} onPress={() => router.push('/add')}>
                    <Icon name="plus" color={C.green} size={15} strokeWidth={2.2} />
                    <Text style={hs.secLink}>Add food</Text>
                  </AnimatedPressable>
                </View>
                {log.length === 0 ? (
                  <Text style={hs.empty}>Nothing logged yet — scan or add your first food.</Text>
                ) : (
                  log.map((item) => (
                    <TodayItem
                      key={item.id}
                      item={item}
                      onEdit={() => setEditing(item)}
                      onDelete={() => handleDelete(item.id, item.name)}
                    />
                  ))
                )}
              </View>

              {/* Workouts logged today (nothing rendered when empty) */}
              {workouts.length > 0 ? (
                <View>
                  <View style={hs.secHeader}>
                    <Text style={hs.secTitle}>Workouts today</Text>
                  </View>
                  {workouts.map((w) => (
                    <WorkoutItem key={w.id} workout={w} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Edit a logged entry */}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {editing ? (
          <EditLogBody
            key={editing.id}
            entry={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        ) : null}
      </Modal>

      <PaywallSheet error={paywall} onClose={() => setPaywall(null)} />
    </View>
  );
}

function MacroChip({ label, value, unit, warn = false, target, emphasis = false }: {
  label: string; value: number; unit: string; warn?: boolean; target?: number | null; emphasis?: boolean;
}) {
  return (
    <View style={[mc.chip, emphasis && mc.chipEmph, warn && mc.chipWarn]}>
      <Text style={[mc.key, emphasis && mc.keyEmph, warn && mc.keyWarn]}>{label}</Text>
      <Text style={[mc.val, emphasis && mc.valEmph, warn && mc.valWarn]}>
        {Math.round(value)}
        {target != null
          ? <Text style={[mc.unit, emphasis && mc.keyEmph, warn && mc.keyWarn]}> / {target} {unit}</Text>
          : <Text style={[mc.unit, emphasis && mc.keyEmph, warn && mc.keyWarn]}> {unit}</Text>
        }
      </Text>
    </View>
  );
}

const mc = StyleSheet.create({
  chip:     { flex: 1, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: C.cardBorder, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12 },
  chipWarn: { backgroundColor: C.redSoft, borderColor: 'rgba(196,85,61,0.25)' },
  // Protein is emphasised — accent-tinted chip + green value, since it's the
  // macro users track most.
  chipEmph: { backgroundColor: C.greenSoft, borderColor: 'rgba(76,124,99,0.28)' },
  keyEmph:  { color: C.greenInk },
  valEmph:  { color: C.greenInk, fontSize: 21 },
  key:      { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkSoft },
  keyWarn:  { color: C.red },
  val:      { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 19, fontWeight: '600', color: C.inkStrong, marginTop: 3, fontVariant: ['tabular-nums'] },
  valWarn:  { color: C.red },
  unit:     { fontSize: 13, fontWeight: '400', color: C.inkFaint },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const hs = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  flex:  { flex: 1 },
  scroll:{ paddingHorizontal: 22, paddingBottom: 120, gap: 16 },

  greet:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 8, marginBottom: 4 },
  greetText:  { flex: 1 },
  gearBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  eyebrow:    { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase', color: C.inkFaint },
  greetTitle: { fontFamily: Fonts?.display ?? 'system', fontSize: 25, color: C.ink, marginTop: 3, letterSpacing: -0.3 },

  calCard: {
    padding: 22,
    paddingBottom: 18,
  },
  loadingCard: {
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 20,
    ...Shadow.sm,
  },
  loadingText: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint },

  // Stats row (below ring)
  statsRow: { flexDirection: 'row', marginTop: 18 },
  stat:     { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statDiv:  { borderLeftWidth: 1, borderLeftColor: C.line },
  statKey:  { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkSoft },
  statVal:  { fontFamily: Fonts?.displaySemi ?? 'system', fontWeight: '600', fontSize: 18, color: C.ink, marginTop: 5, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statGoal: { color: C.greenInk },

  macros: { flexDirection: 'row', gap: 10, marginTop: 18 },

  secHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 },
  secTitle:    { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, color: C.ink, letterSpacing: -0.2 },
  secLinkWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secLink:     { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, color: C.green, fontWeight: '600' },
  empty:       { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint, textAlign: 'center', paddingVertical: Spacing.four },
  disclaimer:  { fontFamily: Fonts?.body ?? 'system', fontSize: 10.5, color: C.inkFaint, textAlign: 'center', lineHeight: 15, marginTop: 8 },
});
