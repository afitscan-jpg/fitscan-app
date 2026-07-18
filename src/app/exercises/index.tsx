import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { exerciseFilters, listExercises, type Exercise } from '@/lib/exercises';

const PAGE = 30;
const CARD_H = 92;
const CARD_GAP = 11;
const ROW_H = CARD_H + CARD_GAP;

// Title-case labels ("lower back" → "Lower Back", "olympic weightlifting" → …).
function cap(s: string): string {
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

// ─── Card ────────────────────────────────────────────────────────────────────

function ExerciseCard({ item }: { item: Exercise }) {
  return (
    <Reanimated.View entering={FadeIn.duration(220)} style={ec.itemWrap}>
      <AnimatedPressable
        style={ec.card}
        onPress={() =>
          router.push({
            // Pass the full record so the detail screen renders instantly — the
            // backend has no single-exercise GET endpoint. (Route cast: expo-router's
            // typed routes regenerate on the dev server after this file is added.)
            pathname: '/exercises/[id]',
            params: { id: item.id, data: JSON.stringify(item) },
          } as never)
        }
      >
        <View style={ec.thumbWrap}>
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={ec.thumb}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[ec.thumb, ec.thumbFallback]}>
              <Icon name="dumbbell" color={C.inkFaint} size={22} strokeWidth={1.8} />
            </View>
          )}
        </View>
        <View style={ec.body}>
          <Text style={ec.name} numberOfLines={2}>{item.name}</Text>
          <View style={ec.metaRow}>
            <Text style={ec.muscle} numberOfLines={1}>{cap(item.primary_muscle)}</Text>
            {item.equipment ? (
              <View style={ec.equipChip}>
                <Text style={ec.equipText} numberOfLines={1}>{cap(item.equipment)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={ec.chev}>
          <Icon name="chevL" color={C.inkDim} size={18} strokeWidth={2} />
        </View>
      </AnimatedPressable>
    </Reanimated.View>
  );
}

const ec = StyleSheet.create({
  itemWrap: { marginBottom: CARD_GAP },
  card: {
    height: CARD_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingLeft: 10,
    paddingRight: 12,
    ...Shadow.sm,
  },
  thumbWrap: {
    width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: '#EDEAE2',
  },
  thumb: { width: '100%', height: '100%' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  chev: { transform: [{ scaleX: -1 }] },
  body: { flex: 1, gap: 5 },
  name: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscle: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, flexShrink: 1 },
  equipChip: {
    backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0,
  },
  equipText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 10.5, fontWeight: '600', color: C.greenInk },
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <SkeletonPulse style={sk.card}>
      <View style={sk.thumb} />
      <View style={sk.body}>
        <View style={[sk.line, { width: '75%' }]} />
        <View style={[sk.line, { width: '45%', height: 11 }]} />
      </View>
    </SkeletonPulse>
  );
}

const sk = StyleSheet.create({
  card: {
    height: CARD_H, flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.cardBorder,
    paddingHorizontal: 10, marginBottom: CARD_GAP,
  },
  thumb: { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: C.line },
  body: { flex: 1, gap: 9 },
  line: { height: 13, borderRadius: 6, backgroundColor: C.line },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExerciseBrowserScreen() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);

  const offsetRef = useRef(0);
  const reqRef = useRef(0); // guards against out-of-order responses

  const load = useCallback(async (search: string, muscle: string | null, reset: boolean) => {
    const token = ++reqRef.current;
    if (reset) {
      setLoading(true);
      setError(false);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    try {
      const rows = await listExercises({
        search: search || undefined,
        muscle: muscle || undefined,
        limit: PAGE,
        offset: offsetRef.current,
      });
      if (token !== reqRef.current) return; // a newer request superseded this one
      offsetRef.current += rows.length;
      setHasMore(rows.length === PAGE);
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
    } catch {
      if (token === reqRef.current && reset) setError(true);
    } finally {
      if (token === reqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Filters (muscle chips) — load once.
  useEffect(() => {
    exerciseFilters().then((f) => setMuscles(f.muscles)).catch(() => {});
  }, []);

  // Debounced search + muscle changes → reset list.
  useEffect(() => {
    const t = setTimeout(() => load(query, activeMuscle, true), 300);
    return () => clearTimeout(t);
  }, [query, activeMuscle, load]);

  function onEndReached() {
    if (loading || loadingMore || !hasMore) return;
    load(query, activeMuscle, false);
  }

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ROW_H, offset: ROW_H * index, index }),
    [],
  );

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Exercises</Text>
          <View style={s.backBtn} />
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Icon name="search" color={C.inkFaint} size={17} strokeWidth={1.9} />
          <TextInput
            style={s.searchInput}
            placeholder="Search exercises"
            placeholderTextColor={C.inkFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Muscle filter chips */}
        {muscles.length > 0 ? (
          <FlatList
            horizontal
            data={['All', ...muscles]}
            keyExtractor={(m) => m}
            showsHorizontalScrollIndicator={false}
            style={s.chipScroll}
            contentContainerStyle={s.chipRow}
            renderItem={({ item: m }) => {
              const value = m === 'All' ? null : m;
              const on = activeMuscle === value;
              return (
                <AnimatedPressable
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => setActiveMuscle(value)}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{cap(m)}</Text>
                </AnimatedPressable>
              );
            }}
          />
        ) : null}

        {/* List */}
        {loading ? (
          <View style={s.listPad}>
            {Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>Couldn&apos;t load exercises</Text>
            <Text style={s.emptySub}>Check your connection and try again.</Text>
            <AnimatedPressable style={s.retryBtn} onPress={() => load(query, activeMuscle, true)}>
              <Text style={s.retryText}>Try again</Text>
            </AnimatedPressable>
          </View>
        ) : items.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>No exercises found</Text>
            <Text style={s.emptySub}>Try a different search or muscle.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => <ExerciseCard item={item} />}
            contentContainerStyle={s.listPad}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={C.green} style={{ marginVertical: 18 }} /> : null
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3,
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 22, marginTop: 2, ...Shadow.sm,
  },
  searchInput: { flex: 1, fontFamily: Fonts?.body ?? 'system', fontSize: 15, color: C.ink },

  chipScroll: { flexGrow: 0, marginTop: 12 },
  // Vertical padding gives the chip shadows + active border room so the row
  // never clips them; alignItems centres chips of any label length.
  chipRow: { paddingHorizontal: 22, paddingVertical: 6, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    paddingHorizontal: 14, minHeight: 34, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 13, fontWeight: '500', color: C.inkSoft },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },

  listPad: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 120 },

  center: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24, gap: 6 },
  emptyTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 16, fontWeight: '600', color: C.ink, textAlign: 'center' },
  emptySub: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint, textAlign: 'center' },
  retryBtn: {
    marginTop: 10, backgroundColor: C.card, borderRadius: Radius.md, borderWidth: 1, borderColor: C.cardBorder,
    paddingHorizontal: 22, minHeight: 46, alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },
  retryText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.green },
});
