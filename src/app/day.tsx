import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import {
  getDailyTotals,
  getLogForDate,
  type DailyTotals,
} from '@/lib/db';

// ─── Types & helpers ────────────────────────────────────────────────────────

type DayEntry = Awaited<ReturnType<typeof getLogForDate>>[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parse a local YYYY-MM-DD without timezone drift, then format for the header.
function prettyDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const MEAL_TINT: Record<string, { bg: string; border: string; fg: string }> = {
  breakfast: { bg: '#FBEEDD', border: 'rgba(185,132,56,0.25)',  fg: C.amberInk },
  lunch:     { bg: '#E7F0E9', border: 'rgba(76,124,99,0.22)',   fg: C.greenInk },
  snack:     { bg: '#F1ECF7', border: 'rgba(120,90,160,0.22)',  fg: '#6C4E8F' },
  dinner:    { bg: '#EAEFF6', border: 'rgba(74,100,140,0.22)',  fg: '#3F5C86' },
};

function formatQtyUnit(quantity: number | null | undefined, unit: string | null | undefined): string | null {
  if (quantity == null || unit == null) return null;
  if (unit === 'piece') return `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}`;
  return `${quantity} ${unit}`;
}

// ─── Read-only diary row (a past day; no edit/delete) ───────────────────────

function DayItem({ item }: { item: DayEntry }) {
  const mealType  = (item.meal_type as string) ?? 'snack';
  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const qtyUnit   = formatQtyUnit(item.quantity, item.unit);
  const metaText  = qtyUnit ? `${mealLabel} · ${qtyUnit}` : mealLabel;
  const tint      = MEAL_TINT[mealType] ?? MEAL_TINT.snack;
  return (
    <View style={ti.card}>
      <View style={[ti.tile, { backgroundColor: tint.bg, borderColor: tint.border }]}>
        <Text style={[ti.tileLetter, { color: tint.fg }]}>{mealLabel.charAt(0)}</Text>
      </View>
      <View style={ti.info}>
        <View style={ti.topRow}>
          <Text style={ti.name} numberOfLines={1}>{item.name}</Text>
          <Text style={ti.kcal}>
            {item.kcal}<Text style={ti.kcalUnit}> kcal</Text>
          </Text>
        </View>
        <Text style={ti.meta} numberOfLines={1}>{metaText}</Text>
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DayScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = typeof params.date === 'string' && DATE_RE.test(params.date) ? params.date : null;

  const [items, setItems]     = useState<DayEntry[]>([]);
  const [totals, setTotals]   = useState<DailyTotals | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!date) { setLoading(false); return; }
      (async () => {
        setLoading(true);
        try {
          const [log, tot] = await Promise.all([getLogForDate(date), getDailyTotals(date)]);
          if (!alive) return;
          setItems(log);
          setTotals(tot);
        } catch {
          if (alive) { setItems([]); setTotals(null); }
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }, [date]),
  );

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.title}>{date ? prettyDate(date) : 'Day'}</Text>
            <Text style={s.subtitle}>A look back — read only</Text>
          </View>
          <View style={s.backBtn} />
        </View>

        <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.center}><ActivityIndicator color={C.green} /></View>
          ) : !date ? (
            <View style={s.center}>
              <Text style={s.emptyTitle}>Day not found</Text>
            </View>
          ) : (
            <>
              {/* Totals strip — mirrors the plan/add liveRow */}
              <View style={s.liveRow}>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{Math.round(totals?.kcal ?? 0)}</Text>
                  <Text style={s.liveKey}>kcal</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{Math.round(totals?.protein_g ?? 0)}g</Text>
                  <Text style={s.liveKey}>protein</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{Math.round(totals?.carbs_g ?? 0)}g</Text>
                  <Text style={s.liveKey}>carbs</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{Math.round(totals?.fat_g ?? 0)}g</Text>
                  <Text style={s.liveKey}>fat</Text>
                </View>
              </View>

              {items.length === 0 ? (
                <View style={s.center}>
                  <Text style={s.emptyTitle}>Nothing logged</Text>
                  <Text style={s.emptySub}>No food was logged on this day.</Text>
                </View>
              ) : (
                items.map((item) => <DayItem key={item.id} item={item} />)
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  flex:  { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 120, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  title:      { fontFamily: Fonts?.display ?? 'system', fontSize: 19, color: C.ink, letterSpacing: -0.3 },
  subtitle:   { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, marginTop: 1 },

  center:     { alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 16, fontWeight: '600', color: C.ink },
  emptySub:   { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint, textAlign: 'center' },

  // Totals strip
  liveRow: {
    flexDirection: 'row',
    backgroundColor: C.greenSoft,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginBottom: 4,
  },
  liveStat: { flex: 1, alignItems: 'center' },
  liveVal: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 17,
    fontWeight: '600',
    color: C.greenInk,
    fontVariant: ['tabular-nums'],
  },
  liveKey: { fontFamily: Fonts?.body ?? 'system', fontSize: 11, color: C.greenInk, opacity: 0.7, marginTop: 2 },
});

const ti = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 11,
    ...Shadow.sm,
  },
  tile:       { width: 52, height: 52, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { fontFamily: Fonts?.display ?? 'system', fontSize: 22, fontWeight: '600' },
  info:       { flex: 1, gap: 5 },
  topRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name:       { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, color: C.inkStrong, fontWeight: '600', flex: 1 },
  meta:       { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint },
  kcal:       { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkStrong, fontVariant: ['tabular-nums'], flexShrink: 0 },
  kcalUnit:   { fontFamily: Fonts?.body ?? 'system', fontSize: 10.5, fontWeight: '400', color: C.inkFaint },
});
