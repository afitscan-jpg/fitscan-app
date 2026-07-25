import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { FlagChip } from '@/components/scanner/flag-chip';
import { NutrientCard } from '@/components/scanner/nutrient-card';
import { VerdictCard } from '@/components/scanner/verdict-card';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { HIGH_SUGAR_G } from '@/constants/verdict';
import { logScannedFood, mealTypeForNow } from '@/lib/db';
import { scanResultStore } from '@/lib/scan-result-store';
import type { ScanNutrients, ScanResponse } from '@/types/scan';

// ─── Nutrient grid config ────────────────────────────────────────────────────

type NutrientKey = keyof ScanNutrients;

const NUTRIENT_ROWS: Array<{ key: NutrientKey; label: string; unit: string }> = [
  { key: 'energy_kcal', label: 'Energy', unit: 'kcal' },
  { key: 'sugars_g', label: 'Sugar', unit: 'g' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'saturated_fat_g', label: 'Fat', unit: 'g' },
];

// ─── Screen state ────────────────────────────────────────────────────────────

type ScreenState =
  | { phase: 'ok'; data: ScanResponse }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string };

function initState(outcome: string): ScreenState {
  if (outcome === 'not_found') return { phase: 'not_found' };
  const data = scanResultStore.take();
  if (!data?.result) {
    return { phase: 'error', message: 'No result available — go back and scan again.' };
  }
  return { phase: 'ok', data };
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

function Header() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
        <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle}>Scan result</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function NotFoundView() {
  return (
    <SafeAreaView style={styles.notFoundContainer}>
      <Header />
      <View style={styles.notFoundBody}>
        <Icon name="search" color={C.inkFaint} size={48} strokeWidth={1.5} />
        <Text style={styles.notFoundTitle}>Couldn't find this product</Text>
        <Text style={styles.notFoundSub}>
          Snap the nutrition label and we'll analyse it for you.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/scanner/ocr-capture')}
        >
          <Text style={styles.primaryBtnText}>Snap nutrition label</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.ghostBtnText}>Scan another product</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.notFoundContainer}>
      <Header />
      <View style={styles.notFoundBody}>
        <Text style={styles.notFoundTitle}>Something went wrong</Text>
        <Text style={styles.notFoundSub}>{message}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Portion stepper (grams) ─────────────────────────────────────────────────

const PORTION_MIN = 1;
const PORTION_MAX = 2000;
const PORTION_STEP = 10;

function clampGrams(n: number): number {
  return Math.max(PORTION_MIN, Math.min(PORTION_MAX, Math.round(n)));
}

function GramsStepper({ grams, onChange }: { grams: number; onChange: (g: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function begin() {
    setDraft(String(grams));
    setEditing(true);
  }
  function commit() {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) onChange(clampGrams(parsed));
    setEditing(false);
  }

  return (
    <View style={styles.portionStepper}>
      <Pressable
        style={[styles.stepBtn, grams <= PORTION_MIN && styles.stepBtnDim]}
        onPress={() => onChange(clampGrams(grams - PORTION_STEP))}
        disabled={grams <= PORTION_MIN}
        hitSlop={8}
      >
        <Text style={[styles.stepBtnText, grams <= PORTION_MIN && styles.stepBtnTextDim]}>−</Text>
      </Pressable>

      <Pressable style={styles.gramsChip} onPress={begin} hitSlop={6}>
        {editing ? (
          <TextInput
            style={styles.gramsInput}
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={4}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <Text style={styles.gramsText}>{grams} g</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.stepBtn, grams >= PORTION_MAX && styles.stepBtnDim]}
        onPress={() => onChange(clampGrams(grams + PORTION_STEP))}
        disabled={grams >= PORTION_MAX}
        hitSlop={8}
      >
        <Text style={[styles.stepBtnText, grams >= PORTION_MAX && styles.stepBtnTextDim]}>+</Text>
      </Pressable>
    </View>
  );
}

// ─── Main result view ────────────────────────────────────────────────────────

function OkResultView({ data }: { data: ScanResponse }) {
  const result = data.result!;
  const [logging, setLogging] = useState(false);
  const [grams, setGrams] = useState(100);

  // Couldn't be graded (insufficient label data) → clean state, no numbers.
  const isUnknown = result.verdict === 'Unknown' || result.grade == null;

  const factor = grams / 100; // scan nutrients are per 100 g/ml
  const scaledKcal = Math.round((result.nutrients.energy_kcal ?? 0) * factor);

  const visibleNutrients = NUTRIENT_ROWS.filter(
    ({ key }) => result.nutrients[key] !== null,
  );

  async function handleLog() {
    if (logging) return;
    setLogging(true);
    try {
      // Map scan verdict to db verdict
      const verdictMap: Record<string, 'good' | 'ok' | 'avoid'> = {
        Good: 'good',
        OK: 'ok',
        Avoid: 'avoid',
      };
      const scale = (v: number | null) => parseFloat(((v ?? 0) * factor).toFixed(1));
      await logScannedFood({
        name: data.name,
        kcal: scaledKcal,
        protein_g: scale(result.nutrients.protein_g),
        carbs_g: scale(result.nutrients.carbs_g),
        fat_g: scale(result.nutrients.fat_g),
        sugar_g: scale(result.nutrients.sugars_g),
        verdict: verdictMap[result.verdict] ?? null,
        meal_type: mealTypeForNow(),
        quantity: grams,
        unit: 'g',
      });
      router.replace('/');
    } catch {
      Alert.alert('Could not log food. Please try again.');
    } finally {
      setLogging(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Product row */}
        <View style={styles.productRow}>
          <View style={styles.productImageWrap}>
            {data.image_url ? (
              <Image
                source={{ uri: data.image_url }}
                style={styles.productImage}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <View style={styles.productImageFallback}>
                <Icon name="box" color={C.inkFaint} size={26} strokeWidth={1.8} />
              </View>
            )}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {data.name}
            </Text>
            <Text style={styles.productBrand} numberOfLines={1}>
              {data.brand}
            </Text>
          </View>
        </View>

        {/* Verdict card */}
        <VerdictCard result={result} />

        {/* Flags */}
        {result.flags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Flags</Text>
            <View style={styles.flagsWrap}>
              {result.flags.map((flag) => (
                <FlagChip key={flag} label={flag} />
              ))}
            </View>
          </View>
        )}

        {/* Nutrients */}
        {!isUnknown && visibleNutrients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nutrients</Text>
            <View style={styles.nutrientGrid}>
              {visibleNutrients.map(({ key, label, unit }) => (
                <NutrientCard
                  key={key}
                  label={label}
                  value={result.nutrients[key] as number}
                  unit={unit}
                  highlight={
                    key === 'sugars_g' &&
                    (result.nutrients.sugars_g ?? 0) >= HIGH_SUGAR_G
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Portion to log */}
        {!isUnknown && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Portion to log</Text>
            <View style={styles.portionCard}>
              <GramsStepper grams={grams} onChange={setGrams} />
              <View style={styles.portionKcalWrap}>
                <Text style={styles.portionKcal}>{scaledKcal}</Text>
                <Text style={styles.portionKcalUnit}>kcal</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.buttonSpacer} />
      </ScrollView>

      {/* Fixed bottom buttons */}
      <SafeAreaView edges={['bottom']} style={styles.buttonRow}>
        {isUnknown ? (
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/add')}>
            <Text style={styles.primaryBtnText}>Describe in text</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={handleLog} disabled={logging}>
            {logging ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Log this</Text>
            )}
          </Pressable>
        )}
        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostBtnText}>Scan next</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ResultScreen() {
  const { outcome } = useLocalSearchParams<{ outcome: string }>();
  const [state] = useState<ScreenState>(() => initState(outcome ?? ''));

  if (state.phase === 'not_found') return <NotFoundView />;
  if (state.phase === 'error') return <ErrorView message={state.message} />;
  return <OkResultView data={state.data} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.card,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '600',
    color: C.ink,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },

  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  productImageWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: C.bg,
    flexShrink: 0,
    ...Shadow.sm,
  },
  productImage: { width: 64, height: 64 },
  productImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1, gap: 2 },
  productName: {
    fontSize: 16,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '700',
    color: C.ink,
    lineHeight: 22,
  },
  productBrand: {
    fontSize: 14,
    fontFamily: Fonts?.body ?? 'system',
    color: C.inkSoft,
  },

  section: { gap: Spacing.two },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '700',
    color: C.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  // Portion stepper
  portionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bg,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  portionStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDim: { borderColor: C.line },
  stepBtnText: {
    fontSize: 20,
    lineHeight: 24,
    color: C.green,
    fontWeight: '500',
  },
  stepBtnTextDim: { color: C.inkFaint },
  gramsChip: {
    minWidth: 64,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.greenInk,
    fontVariant: ['tabular-nums'],
  },
  gramsInput: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.greenInk,
    minWidth: 48,
    textAlign: 'center',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  portionKcalWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  portionKcal: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 20,
    fontWeight: '600',
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  portionKcalUnit: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
  },

  buttonSpacer: { height: Spacing.six + Spacing.four },
  buttonRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    backgroundColor: C.card,
    ...Shadow.md,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: C.green,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '600',
  },
  ghostBtn: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: C.ink,
    fontSize: 15,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '600',
  },

  notFoundContainer: {
    flex: 1,
    backgroundColor: C.card,
  },
  notFoundBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  notFoundTitle: {
    fontSize: 22,
    fontFamily: Fonts?.display ?? 'system',
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
  notFoundSub: {
    fontSize: 15,
    fontFamily: Fonts?.body ?? 'system',
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
});
