import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { AnimatedPressable } from '@/components/animated-pressable';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { logFood, type MealType } from '@/lib/db';
import { authFetch, PaywallError } from '@/lib/api';
import {
  hasRetryableFailure,
  logAllSettled,
  logButtonLabel,
  partialLogSummary,
  type PartialLogResult,
  type SkipReason,
} from '@/lib/partial-log';
import { PaywallSheet } from '@/components/paywall-sheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemUnit = 'piece' | 'g' | 'ml';

interface PlanItem {
  name: string;
  amount: number;
  unit: ItemUnit;
  // Resolved items carry verified numbers; "idea" items (resolved === false) have
  // null nutrition and are shown as a suggestion, never with fabricated numbers.
  resolved?: boolean;
  // True when the lookup itself failed (transient system error), not when the
  // food is genuinely unknown — the copy stays temporary, never "not in database".
  unavailable?: boolean;
  badge?: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** An item carries real numbers we can write; anything else is an "idea". */
function isLoggable(it: PlanItem): it is PlanItem & { kcal: number } {
  return it.resolved !== false && it.kcal != null;
}

/** A meal's log outcome plus the rows that failed, so a retry re-sends only those. */
type MealLogResult = PartialLogResult & { failedItems: (PlanItem & { kcal: number })[] };

interface PlanMeal {
  meal_type: MealType;
  title: string;
  items: PlanItem[];
}

interface PlanTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface Plan {
  meals: PlanMeal[];
  totals: PlanTotals;
  note: string | null;
  adjusted: boolean;
  disclaimer?: string | null;
  target_basis?: 'adaptive' | 'static' | 'static_anchored' | 'unknown' | null;
}

// Small caption explaining where the calorie target came from.
const TARGET_BASIS_CAPTION: Record<string, string> = {
  adaptive:        'Target adjusts to your recent weight trend',
  static:          'Target from your body stats',
  static_anchored: 'Target from your body stats',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  snack:     'Snack',
  dinner:    'Dinner',
};

type DietValue = 'veg' | 'egg' | 'non_veg' | 'vegan' | 'keto';

const DIET_CHIPS: Array<{ label: string; value: DietValue }> = [
  { label: 'Veg',      value: 'veg' },
  { label: 'Veg + Egg', value: 'egg' },
  { label: 'Non-veg',  value: 'non_veg' },
  { label: 'Vegan',    value: 'vegan' },
  { label: 'Keto-ish', value: 'keto' },
];

function formatAmount(amount: number, unit: ItemUnit): string {
  if (unit === 'piece') return `${amount} piece${amount !== 1 ? 's' : ''}`;
  return `${amount} ${unit}`;
}

function tomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Cache key is scoped to tomorrow's local date so a stale plan from a previous
// day is never shown.
function planCacheKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `plan:${y}-${m}-${da}`;
}

// Runtime shape guard: the plan is consumed (plan.totals.kcal, plan.meals.map)
// without null-safety, and one source is stale AsyncStorage JSON. Confirm the
// pieces we render are actually present/numeric before trusting them.
function validatePlan(x: unknown): Plan | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as { meals?: unknown; totals?: unknown };
  if (!Array.isArray(p.meals)) return null;
  const t = p.totals as Record<string, unknown> | null | undefined;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!t || !num(t.kcal) || !num(t.protein_g) || !num(t.carbs_g) || !num(t.fat_g)) return null;
  return x as Plan;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonMealCard() {
  return (
    <SkeletonPulse style={sk.card}>
      <View style={sk.eyebrow} />
      <View style={sk.title} />
      <View style={sk.line} />
      <View style={sk.line} />
      <View style={[sk.line, { width: '60%' }]} />
      <View style={sk.btn} />
    </SkeletonPulse>
  );
}

const sk = StyleSheet.create({
  card:    { backgroundColor: C.card, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.sm },
  eyebrow: { height: 10, width: 70, borderRadius: 5, backgroundColor: C.line },
  title:   { height: 14, width: '75%', borderRadius: 6, backgroundColor: C.line, marginBottom: 2 },
  line:    { height: 12, width: '90%', borderRadius: 5, backgroundColor: C.line },
  btn:     { height: 40, borderRadius: Radius.md, backgroundColor: C.line, marginTop: 4 },
  totals:  { height: 60, borderRadius: Radius.md, backgroundColor: C.line },
});

// ─── Meal card ────────────────────────────────────────────────────────────────

function MealCard({
  meal,
  result,
  onLog,
}: {
  meal: PlanMeal;
  /** Null until this meal has been logged once; then what actually happened. */
  result: MealLogResult | null;
  onLog: () => Promise<void>;
}) {
  const [logging, setLogging] = useState(false);

  const total = meal.items.length;
  const loggable = meal.items.filter(isLoggable).length;
  const summary = result ? partialLogSummary(result) : null;
  // A save failure is the one skip the user can act on — keep the button live so
  // they can retry, and retry ONLY the rows that failed (never the ones that landed).
  const canRetry = result != null && hasRetryableFailure(result);
  const done = result != null && !canRetry;

  async function handleLog() {
    if (done || logging || loggable === 0) return;
    setLogging(true);
    try {
      await onLog();
    } catch {
      // meal stays unlogged; button resets
    } finally {
      setLogging(false);
    }
  }

  return (
    <View style={mc.card}>
      <Text style={mc.eyebrow}>{MEAL_LABELS[meal.meal_type] ?? meal.meal_type}</Text>
      <Text style={mc.title}>{meal.title}</Text>

      <View style={mc.itemList}>
        {meal.items.map((item, i) => {
          // "Idea" items came back unresolved (no verified numbers). Show the food
          // and portion, but never a fabricated calorie/macro figure.
          const isIdea = item.resolved === false || item.kcal == null;
          if (isIdea) {
            return (
              <View key={i} style={mc.itemRow}>
                <View style={mc.itemNameCol}>
                  <Text style={mc.itemName} numberOfLines={2}>{item.name}</Text>
                  <View style={mc.ideaBadge}>
                    <Text style={mc.ideaBadgeText} numberOfLines={1}>
                      {item.badge ?? 'Idea — not in our food database'}
                    </Text>
                  </View>
                </View>
                <Text style={mc.itemMeta}>
                  {formatAmount(item.amount, item.unit)}
                  {'\n'}
                  <Text style={mc.ideaLabel}>
                    {item.unavailable ? 'Couldn’t check — not counted' : 'Idea to try — not counted'}
                  </Text>
                </Text>
              </View>
            );
          }
          return (
            <View key={i} style={mc.itemRow}>
              <Text style={mc.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={mc.itemMeta}>
                {formatAmount(item.amount, item.unit)}
                <Text style={mc.itemKcal}> · {item.kcal} kcal</Text>
              </Text>
            </View>
          );
        })}
      </View>

      <AnimatedPressable
        style={[mc.logBtn, done && mc.logBtnDone, loggable === 0 && mc.logBtnIdle]}
        onPress={handleLog}
        disabled={done || logging || loggable === 0}
        accessibilityRole="button"
        accessibilityLabel={
          done
            ? (summary ?? 'Logged')
            : logButtonLabel(loggable, total)
        }
      >
        {logging ? (
          <ActivityIndicator color={done ? C.greenInk : '#fff'} size="small" />
        ) : done ? (
          <View style={mc.logBtnDoneRow}>
            <Icon name="check" color={C.greenInk} size={15} strokeWidth={2.4} />
            <Text style={[mc.logBtnText, mc.logBtnTextDone]}>
              {result && result.skipped.length > 0
                ? `Logged ${result.logged.length} of ${total}`
                : 'Logged'}
            </Text>
          </View>
        ) : (
          <Text style={[mc.logBtnText, loggable === 0 && mc.logBtnTextIdle]}>
            {canRetry
              ? `Retry ${result.skipped.filter((s) => s.reason === 'failed').length} item${
                  result.skipped.filter((s) => s.reason === 'failed').length === 1 ? '' : 's'
                }`
              : logButtonLabel(loggable, total)}
          </Text>
        )}
      </AnimatedPressable>

      {/* What actually happened. A skipped item is our gap or our failure — never
          framed as something the user got wrong. */}
      {summary ? <Text style={mc.logSummary}>{summary}</Text> : null}
    </View>
  );
}

const mc = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: Radius.xl, padding: 16, gap: 10, ...Shadow.md },
  eyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.inkFaint,
  },
  title: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 15,
    color: C.ink,
    marginTop: -2,
  },
  itemList: { gap: 7, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemName: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    flex: 1,
    lineHeight: 19,
  },
  // Idea (unresolved) item: name column + small amber badge under it.
  itemNameCol: { flex: 1, gap: 4 },
  logBtnIdle: { backgroundColor: C.greenSoft },
  logBtnTextIdle: { color: C.inkSoft },
  logSummary: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    lineHeight: 17,
    color: C.inkSoft,
    marginTop: 2,
  },
  ideaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.amberSoft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ideaBadgeText: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 10.5,
    fontWeight: '500',
    color: C.amberInk,
  },
  ideaLabel: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11.5,
    color: C.amber,
    fontStyle: 'italic',
  },
  itemMeta: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkSoft,
    textAlign: 'right',
    flexShrink: 0,
  },
  itemKcal: { color: C.inkFaint, fontSize: 12.5 },
  logBtn: {
    backgroundColor: C.green,
    borderRadius: Radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pressed:        { opacity: 0.85 },
  logBtnDone:     { backgroundColor: C.greenSoft },
  logBtnDoneRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logBtnText:     { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: '#fff' },
  logBtnTextDone: { color: C.greenInk },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const [plan, setPlan]               = useState<Plan | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<Map<number, MealLogResult>>(new Map());
  const [dietOverride, setDietOverride] = useState<DietValue | null>(null);
  const [paywall, setPaywall] = useState<PaywallError | null>(null);

  const fetchPlan = useCallback(async (
    force = false,
    override: DietValue | null = null,
    opts: { silent?: boolean } = {},
  ) => {
    // Silent = a background refresh while cached content is on screen: don't
    // flip into the loading/error states, just swap the result in on success.
    const silent = opts.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(false);
    }
    try {
      const res = await authFetch('/insights/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(force ? { force: true } : {}),
          ...(override ? { diet_override: override } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as { plan?: unknown; plan_date?: string };
      const valid = validatePlan(json?.plan);
      if (!valid) throw new Error('Malformed plan response');
      setPlan(valid);
      AsyncStorage.setItem(planCacheKey(), JSON.stringify(valid)).catch(() => {});
    } catch (e) {
      if (e instanceof PaywallError) {
        // Premium-only feature — show the upgrade sheet, not a network error.
        setPaywall(e);
      } else if (!silent) {
        // A failed background refresh keeps the cached plan visible.
        setError(true);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // On mount: paint the cached plan immediately (if any), then refresh from the
  // network in the background. Only show the full loading state with no cache.
  useEffect(() => {
    let alive = true;
    (async () => {
      let hadCache = false;
      try {
        const cached = await AsyncStorage.getItem(planCacheKey());
        if (cached && alive) {
          const valid = validatePlan(JSON.parse(cached));
          if (valid) {
            setPlan(valid);
            setLoading(false);
            hadCache = true;
          } else {
            AsyncStorage.removeItem(planCacheKey()).catch(() => {});
          }
        }
      } catch {
        // ignore malformed cache — fall through to a normal load
      }
      if (alive) fetchPlan(false, null, { silent: hadCache });
    })();
    return () => { alive = false; };
  }, [fetchPlan]);

  function selectDiet(value: DietValue) {
    if (loading) return;
    const next = dietOverride === value ? null : value;
    setDietOverride(next);
    setLoggedMeals(new Map());
    fetchPlan(true, next);
  }

  async function handleLogMeal(mealIndex: number): Promise<void> {
    const meal = plan?.meals[mealIndex];
    if (!meal) return;
    // Only log resolved items — "idea" items have no verified numbers, so we
    // never write them to the diary. They are reported as skipped rather than
    // silently dropped, so the user is never told a partial log was a full one.
    const ideas = meal.items.filter((it) => !isLoggable(it));
    // On a retry, re-send ONLY the rows that failed last time. Re-sending the whole
    // meal would duplicate every row that already landed.
    const prior = loggedMeals.get(mealIndex);
    const resolved = prior ? prior.failedItems : meal.items.filter(isLoggable);
    if (resolved.length === 0) return;   // nothing writable — button is disabled anyway

    // allSettled, not all: a single failed insert must not discard the rows that
    // did land, or the retry duplicates them.
    const written = await logAllSettled(
      resolved,
      (item) =>
        logFood({
          name:      item.name,
          kcal:      item.kcal,
          protein_g: item.protein_g ?? 0,
          carbs_g:   item.carbs_g ?? 0,
          fat_g:     item.fat_g ?? 0,
          source:    'ai_estimate',
          meal_type: meal.meal_type,
          quantity:  item.amount,
          unit:      item.unit,
        }),
      (item) => item.name,
    );

    const result: MealLogResult = {
      // A retry adds to what already landed rather than replacing the record.
      logged: [...(prior?.logged ?? []), ...written.logged],
      skipped: [
        ...written.skipped,
        ...ideas.map((it) => ({
          name: it.name,
          reason: (it.unavailable ? 'unavailable' : 'gap') as SkipReason,
        })),
      ],
      failedItems: written.failedItems,
    };
    setLoggedMeals((prev) => new Map(prev).set(mealIndex, result));
  }

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.title}>Tomorrow's plan</Text>
            <Text style={s.subtitle}>{tomorrowLabel()}</Text>
          </View>
          <Pressable
            onPress={() => { setLoggedMeals(new Map()); fetchPlan(true, dietOverride); }}
            hitSlop={12}
            style={[s.refreshBtn, loading && { opacity: 0.3 }]}
            disabled={loading}
          >
            <Icon name="refresh" color={C.inkFaint} size={19} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Diet chips */}
          <View style={s.dietWrap}>
            <Text style={s.dietLabel}>Tomorrow I want</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dietRow}
            >
              {DIET_CHIPS.map((chip) => {
                const on = dietOverride === chip.value;
                return (
                  <AnimatedPressable
                    key={chip.value}
                    style={[s.chip, on && s.chipOn]}
                    onPress={() => selectDiet(chip.value)}
                    disabled={loading}
                  >
                    <Text style={[s.chipText, on && s.chipTextOn]}>{chip.label}</Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <>
              <Text style={s.loadingMsg}>
                Building tomorrow&apos;s plan — this takes ~20 seconds the first time.
              </Text>
              <SkeletonPulse style={sk.totals} />
              <SkeletonMealCard />
              <SkeletonMealCard />
              <SkeletonMealCard />
            </>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.centerTitle}>Couldn&apos;t load plan</Text>
              <Text style={s.centerSub}>Check your connection and try again.</Text>
              <AnimatedPressable
                style={s.retryBtn}
                onPress={() => fetchPlan(false, dietOverride)}
              >
                <Text style={s.retryText}>Try again</Text>
              </AnimatedPressable>
            </View>
          ) : plan ? (
            <>
              {/* Totals strip — liveRow from add.tsx */}
              <View style={s.liveRow}>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{plan.totals.kcal}</Text>
                  <Text style={s.liveKey}>kcal</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{plan.totals.protein_g}g</Text>
                  <Text style={s.liveKey}>protein</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{plan.totals.carbs_g}g</Text>
                  <Text style={s.liveKey}>carbs</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{plan.totals.fat_g}g</Text>
                  <Text style={s.liveKey}>fat</Text>
                </View>
              </View>

              {plan.target_basis && TARGET_BASIS_CAPTION[plan.target_basis] ? (
                <Text style={s.targetCaption}>{TARGET_BASIS_CAPTION[plan.target_basis]}</Text>
              ) : null}

              {plan.meals.map((meal, i) => (
                <MealCard
                  key={i}
                  meal={meal}
                  result={loggedMeals.get(i) ?? null}
                  onLog={() => handleLogMeal(i)}
                />
              ))}

              {plan.note ? (
                <Text style={s.note}>{plan.note}</Text>
              ) : null}
              {plan.adjusted ? (
                <Text style={s.adjustedNote}>
                  Portions were scaled to match your calorie target.
                </Text>
              ) : null}
              {plan.disclaimer ? (
                <Text style={s.disclaimer}>{plan.disclaimer}</Text>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <PaywallSheet error={paywall} onClose={() => setPaywall(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  flex:  { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 100, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText:  { flex: 1 },
  title: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 20,
    color: C.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    marginTop: 1,
  },
  refreshBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Diet chips
  dietWrap: { gap: 8 },
  dietLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkFaint,
  },
  dietRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chip: {
    backgroundColor: C.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    ...Shadow.sm,
  },
  chipOn: { backgroundColor: C.green },
  chipText: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 13,
    fontWeight: '500',
    color: C.inkSoft,
  },
  chipTextOn: { color: '#fff' },

  loadingMsg: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 2,
  },
  pressed: { opacity: 0.85 },

  // Totals strip
  liveRow: {
    flexDirection: 'row',
    backgroundColor: C.greenSoft,
    borderRadius: Radius.md,
    paddingVertical: 14,
  },
  liveStat: { flex: 1, alignItems: 'center' },
  liveVal: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 17,
    fontWeight: '600',
    color: C.greenInk,
    fontVariant: ['tabular-nums'],
  },
  liveKey: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11,
    color: C.greenInk,
    opacity: 0.7,
    marginTop: 2,
  },

  // Error state
  center:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  centerTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 16, fontWeight: '600', color: C.ink },
  centerSub:   { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint, textAlign: 'center' },
  retryBtn:    { marginTop: 8, backgroundColor: C.card, borderRadius: Radius.md, paddingHorizontal: 22, minHeight: 48, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  retryText:   { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.green },

  note: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  adjustedNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Caption under the totals strip explaining where the target came from.
  targetCaption: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11.5,
    color: C.inkFaint,
    textAlign: 'center',
    marginTop: -4,
  },
  // Non-medical disclaimer near the bottom of the plan.
  disclaimer: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11.5,
    color: C.inkFaint,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 10,
    marginTop: 4,
  },
});
