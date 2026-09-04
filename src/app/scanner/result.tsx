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
import { DiagLine } from '@/components/scanner/diag-line';
import { VerdictCard } from '@/components/scanner/verdict-card';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { FactColors, HIGH_SUGAR_G } from '@/constants/verdict';
import { logScannedFood, mealTypeForNow } from '@/lib/db';
import { logSuccess } from '@/lib/feedback';
import { scanResultStore } from '@/lib/scan-result-store';
import type { NutrientFact, ScanDiag, ScanNutrients, ScanResponse } from '@/types/scan';

const VALID_GRADES = new Set(['a', 'b', 'c', 'd', 'e']);

// ─── Nutrient grid config ────────────────────────────────────────────────────

type NutrientKey = keyof ScanNutrients;

const NUTRIENT_ROWS: Array<{ key: NutrientKey; label: string; unit: string }> = [
  { key: 'energy_kcal', label: 'Energy', unit: 'kcal' },
  { key: 'sugars_g', label: 'Sugar', unit: 'g' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g' },
];

// ─── Screen state ────────────────────────────────────────────────────────────

type ScreenState =
  | { phase: 'ok'; data: ScanResponse }
  | { phase: 'not_found' }
  // Couldn't reach the product database. Distinct from not_found on purpose: we
  // never learned whether this product exists, so we must not say it doesn't.
  | { phase: 'unavailable' }
  | { phase: 'error'; message: string };

function initState(outcome: string): ScreenState {
  if (outcome === 'not_found') return { phase: 'not_found' };
  if (outcome === 'unavailable') return { phase: 'unavailable' };
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
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.headerBtn} hitSlop={8}>
        <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle}>Scan result</Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function NotFoundView({ diag }: { diag: ScanDiag | null }) {
  return (
    <SafeAreaView style={styles.notFoundContainer}>
      <Header />
      <View style={styles.notFoundBody}>
        <Icon name="search" color={C.inkFaint} size={48} strokeWidth={1.5} />
        <Text style={styles.notFoundTitle}>This one isn&apos;t in the database</Text>
        <Text style={styles.notFoundSub}>
          Open Food Facts answered — it just doesn&apos;t have this barcode yet.
          Scanning again won&apos;t change that, so tell us what it is instead and
          we&apos;ll log it from the description.
        </Text>
        <Pressable
          style={styles.btnSolo}
          onPress={() => router.replace('/add')}
        >
          <Text style={styles.primaryBtnText}>Type what it is</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <Text style={styles.ghostBtnText}>Scan another product</Text>
        </Pressable>
        <DiagLine diag={diag} />
      </View>
    </SafeAreaView>
  );
}

function UnavailableView({ diag }: { diag: ScanDiag | null }) {
  return (
    <SafeAreaView style={styles.notFoundContainer}>
      <Header />
      <View style={styles.notFoundBody}>
        <Icon name="refresh" color={C.inkFaint} size={48} strokeWidth={1.5} />
        <Text style={styles.notFoundTitle}>Couldn&apos;t check right now</Text>
        <Text style={styles.notFoundSub}>
          We couldn&apos;t reach the product database, so we don&apos;t know whether
          it&apos;s there — this one is on us, not the product. A retry often works.
          If it keeps failing, type what it is and we&apos;ll log it from that.
        </Text>
        <Pressable style={styles.btnSolo} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Try the scan again</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/add')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Type what it is instead"
        >
          <Text style={styles.ghostBtnText}>Type what it is instead</Text>
        </Pressable>
        <DiagLine diag={diag} />
      </View>
    </SafeAreaView>
  );
}

function ErrorView({ message, diag }: { message: string; diag: ScanDiag | null }) {
  return (
    <SafeAreaView style={styles.notFoundContainer}>
      <Header />
      <View style={styles.notFoundBody}>
        <Text style={styles.notFoundTitle}>Something went wrong</Text>
        <Text style={styles.notFoundSub}>{message}</Text>
        <Pressable style={styles.btnSolo} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
        <DiagLine diag={diag} />
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

function GramsStepper({ grams, unit, onChange }: { grams: number; unit: string; onChange: (g: number) => void }) {
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
          <Text style={styles.gramsText}>{grams} {unit}</Text>
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

// ─── "What's in this" — per-100g fact lines, anti-guilt register ─────────────

function WhatsInThis({ facts }: { facts: NutrientFact[] }) {
  if (!facts || facts.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>What&apos;s in this</Text>
      <View style={styles.factList}>
        {facts.map((f, i) => {
          const c = FactColors[f.tag] ?? FactColors.neutral;
          const tagged = f.tag === 'high' || f.tag === 'good';
          return (
            <View key={`${f.label}-${i}`} style={styles.factRow}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <View style={styles.factRight}>
                <Text style={[styles.factDetail, f.tag === 'missing' && styles.factMissing]}>
                  {f.detail}
                </Text>
                {tagged ? (
                  <View style={[styles.factTag, { backgroundColor: c.tint }]}>
                    <Text style={[styles.factTagText, { color: c.text }]}>
                      {f.tag === 'high' ? 'High' : 'Good'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// OFF's own Nutri-Score, shown alongside our verdict when OFF has a valid letter.
function NutriScoreLine({ grade, attribution }: { grade: string; attribution?: string | null }) {
  return (
    <View style={styles.nutriRow}>
      <Text style={styles.nutriLabel}>Nutri-Score</Text>
      <View style={styles.nutriBadge}>
        <Text style={styles.nutriBadgeText}>{grade.toUpperCase()}</Text>
      </View>
      <Text style={styles.nutriAttr}>{attribution ?? 'Open Food Facts'}</Text>
    </View>
  );
}

// ─── Main result view ────────────────────────────────────────────────────────

function OkResultView({ data }: { data: ScanResponse }) {
  const result = data.result!;
  const [logging, setLogging] = useState(false);
  // Open the portion stepper on the product's real serving so the shown
  // kcal/protein match the label; fall back to 100 g when OFF has no serving.
  const [grams, setGrams] = useState(
    result.serving_g && result.serving_g > 0 ? clampGrams(result.serving_g) : 100,
  );

  // Couldn't be graded (insufficient label data) → clean state, no numbers.
  const isUnknown = result.verdict === 'Unknown' || result.grade == null;

  // OFF's own Nutri-Score letter, shown alongside our verdict when valid.
  const offGrade =
    typeof data.nutrition_grade === 'string' && VALID_GRADES.has(data.nutrition_grade.toLowerCase())
      ? data.nutrition_grade
      : null;
  const facts = result.nutrient_facts ?? [];

  // Beverages are measured by volume — label the stepper and log the row in ml.
  const isVolumetric = result.is_beverage;
  const portionUnit = isVolumetric ? 'ml' : 'g';

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
        unit: portionUnit,
      });
      logSuccess();
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
        {/* Disclose which basis the grade was computed on. */}
        {!isUnknown && result.scored_basis ? (
          <Text style={styles.basisNote}>
            {result.scored_basis === 'serving' ? 'Graded per serving' : 'Graded per 100g'}
          </Text>
        ) : null}

        {/* OFF Nutri-Score, alongside our verdict when present. */}
        {offGrade ? (
          <NutriScoreLine grade={offGrade} attribution={data.grade_attribution} />
        ) : null}

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

        {/* What's in this — per-100g context lines (facts, never verdicts). */}
        <WhatsInThis facts={facts} />

        {/* Nutrients */}
        {!isUnknown && visibleNutrients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Nutrients</Text>
            <View style={styles.nutrientGrid}>
              {visibleNutrients.map(({ key, label, unit }) => (
                <NutrientCard
                  key={key}
                  label={label}
                  value={Number(((result.nutrients[key] as number) * factor).toFixed(unit === 'kcal' ? 0 : 1))}
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
              <GramsStepper grams={grams} unit={portionUnit} onChange={setGrams} />
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
  // One-shot, same as the result payload — taken once on mount so a re-render
  // doesn't clear it out from under the view.
  const [diag] = useState<ScanDiag | null>(() => scanResultStore.takeDiag());

  if (state.phase === 'not_found') return <NotFoundView diag={diag} />;
  if (state.phase === 'unavailable') return <UnavailableView diag={diag} />;
  if (state.phase === 'error') return <ErrorView message={state.message} diag={diag} />;
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

  basisNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkSoft,
    marginTop: -Spacing.two + 2,
  },

  section: { gap: Spacing.two },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontWeight: '700',
    color: C.inkSoft,
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

  // "What's in this" fact lines
  factList: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...Shadow.sm,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  factLabel: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14,
    color: C.ink,
  },
  factRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  factDetail: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },
  factMissing: {
    fontFamily: Fonts?.body ?? 'system',
    fontWeight: '400',
    fontSize: 13,
    color: C.inkFaint,
    fontStyle: 'italic',
  },
  factTag: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  factTagText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // OFF Nutri-Score line
  nutriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: -Spacing.two + 2,
  },
  nutriLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 12,
    fontWeight: '700',
    color: C.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nutriBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 6,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutriBadgeText: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 13,
    fontWeight: '700',
    color: C.greenInk,
  },
  nutriAttr: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
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
    color: C.inkSoft,
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
    flex: 1,                    // for the side-by-side FOOTER ROW in the OK view
    backgroundColor: C.green,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  // Same look, but sized to its content — for a LONE button inside a centered
  // column (NotFound / Error views). primaryBtn's flex:1 would stretch it to
  // fill the whole column vertically, which is the "tall Go back button" bug.
  btnSolo: {
    alignSelf: 'stretch',
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
