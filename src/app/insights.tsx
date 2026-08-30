import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { DailyBars, type BarDatum } from '@/components/insights/DailyBars';
import { MealTypeBar, VerifiedShare } from '@/components/insights/HorizontalBars';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { getInsights7d, type InsightsData } from '@/lib/insights';

// ── "Handy to know" education snippets — static, non-medical, anti-guilt ────────
const EDU = {
  target:
    'Your target is a guide, not a line to fear. Some days land over, some under — it’s the weekly average that tells the real story.',
  protein:
    'Protein helps you feel full and holds on to muscle while you’re eating a little less — handy to know on the days you’re aiming lower.',
  estimate:
    'Estimated numbers are our best guess when a food isn’t in the verified database yet — honest approximations, not errors. The more you log familiar foods, the more of your week is exact.',
} as const;

function dayLabel(dateStr: string, isToday: boolean): string {
  if (isToday) return 'Today';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

// Mount entrance — a gentle staggered rise. useAnimatedStyle (release-safe on this
// stack), and reduced-motion starts fully settled so nothing moves.
function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) v.value = withDelay(index * 70, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
  }, [index, reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: 10 * (1 - v.value) }] }));
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

function ChartCard({ title, sub, children, index }: { title: string; sub?: string; children: React.ReactNode; index: number }) {
  return (
    <Rise index={index}>
      <View style={s.card}>
        <Text style={s.cardTitle}>{title}</Text>
        {sub ? <Text style={s.cardSub}>{sub}</Text> : null}
        <View style={s.chartWrap}>{children}</View>
      </View>
    </Rise>
  );
}

function EduSnippet({ tag, body, index }: { tag: string; body: string; index: number }) {
  return (
    <Rise index={index}>
      <View style={s.edu}>
        <Text style={s.eduTag}>{tag}</Text>
        <Text style={s.eduBody}>{body}</Text>
      </View>
    </Rise>
  );
}

export default function InsightsScreen() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getInsights7d()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const kcalBars: BarDatum[] = (data?.days ?? []).map((d, i, arr) => ({
    value: d.kcal, hasData: d.hasData, est: d.est, isToday: i === arr.length - 1, label: dayLabel(d.date, i === arr.length - 1),
  }));
  const proteinBars: BarDatum[] = (data?.days ?? []).map((d, i, arr) => ({
    value: d.protein_g, hasData: d.hasData, est: d.est, isToday: i === arr.length - 1, label: dayLabel(d.date, i === arr.length - 1),
  }));

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8} accessibilityLabel="Back">
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle}>Your nutrition</Text>
          <View style={s.backBtn} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.green} /></View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.stateTitle}>Couldn’t load your insights</Text>
            <Text style={s.stateSub}>Please try again in a moment.</Text>
          </View>
        ) : !data || data.loggedDays === 0 ? (
          <View style={s.center}>
            <Text style={s.stateTitle}>Not much logged yet</Text>
            <Text style={s.stateSub}>Log a few meals and your week will start to take shape here — no pressure, just a picture.</Text>
          </View>
        ) : (
          <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.lede}>
              A calm look at your last 7 days — {data.loggedDays} day{data.loggedDays === 1 ? '' : 's'} logged. Numbers, not judgments.
            </Text>

            <ChartCard index={0} title="Calories vs target" sub={data.weeklyAvgKcal != null ? `Averaging ${data.weeklyAvgKcal.toLocaleString()} kcal this week` : 'Last 7 days'}>
              <DailyBars data={kcalBars} target={data.kcalTarget} avg={data.weeklyAvgKcal} yStep={500} />
            </ChartCard>
            <EduSnippet index={1} tag="Handy to know" body={EDU.target} />

            <ChartCard index={2} title="Protein" sub={data.proteinTarget != null ? `Target around ${data.proteinTarget} g/day` : 'Last 7 days'}>
              <DailyBars data={proteinBars} target={data.proteinTarget} avg={null} yStep={25} />
            </ChartCard>
            <EduSnippet index={3} tag="On protein" body={EDU.protein} />

            <ChartCard index={4} title="Where your energy comes from" sub="By meal, last 7 days">
              <MealTypeBar split={data.mealSplit} />
            </ChartCard>

            <ChartCard index={5} title="How much is verified" sub={`${data.totalItems} item${data.totalItems === 1 ? '' : 's'} logged`}>
              <VerifiedShare verifiedPct={data.verifiedPct} />
            </ChartCard>
            <EduSnippet index={6} tag="On estimates" body={EDU.estimate} />

            <Text style={s.footer}>Built from your own logs. Estimated items are shown honestly, never hidden. General nutrition info — not medical advice.</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  stateTitle: { fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, textAlign: 'center' },
  stateSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, color: C.inkSoft, textAlign: 'center', lineHeight: 21 },

  scroll: { paddingHorizontal: 18, paddingBottom: 60, gap: 14 },
  lede: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkSoft, lineHeight: 20, marginTop: 4, marginBottom: 2 },

  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: Radius.lg, padding: 16, ...Shadow.sm },
  cardTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15.5, fontWeight: '600', color: C.inkStrong },
  cardSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, marginTop: 2 },
  chartWrap: { marginTop: 12 },

  edu: { backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderLeftWidth: 3, borderLeftColor: C.green, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  eduTag: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.greenInk },
  eduBody: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.ink, lineHeight: 20, marginTop: 4 },

  footer: { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkFaint, lineHeight: 17, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
});
