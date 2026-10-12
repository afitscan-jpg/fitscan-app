// src/components/log-again.tsx
// "Log again" on the Add screen (Sprint 3, logging speed): favourites, recents,
// saved meals and "Repeat yesterday". One tap on a chip logs that food exactly
// as it was logged before (same amount, same numbers, same provenance marker);
// long-press a chip to star or un-star it. Saved meals log every item at once.
//
// Data comes from quick-log.ts; this component owns no numbers. Failures are
// reported in words at the spot they happened ("Couldn't log Poha — try again"),
// never as a generic alert, and a food that fails to log stays where it was.

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { PickFoodsSheet, type PickableFood } from '@/components/pick-foods-sheet';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { mealTypeForNow, type MealType } from '@/lib/db';
import { tap } from '@/lib/feedback';
import {
  addFavorite, getFavorites, getRecents, getSavedMeals, getYesterdayFoods, isFavorite,
  logEntries, logSavedMeal, nameKey, removeFavorite, repeatFoods, saveMeal, sumKcal,
  type DayFood, type FavoriteFood, type LoggedFood, type RecentFood, type SavedMeal,
} from '@/lib/quick-log';

type Props = {
  /** The meal slot a one-tap re-log goes under (the screen's current choice). */
  meal?: MealType;
  /** Called after anything was logged successfully (count of rows). */
  onLogged: (count: number) => void;
};

export function LogAgain({ meal, onLogged }: Props) {
  const [recents, setRecents] = useState<RecentFood[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [yesterday, setYesterday] = useState<DayFood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [repeatOpen, setRepeatOpen] = useState(false);

  const load = useCallback(async () => {
    const [r, f, m, y] = await Promise.allSettled([getRecents(), getFavorites(), getSavedMeals(), getYesterdayFoods()]);
    if (r.status === 'fulfilled') setRecents(r.value);
    if (f.status === 'fulfilled') setFavorites(f.value);
    if (m.status === 'fulfilled') setMeals(m.value);
    if (y.status === 'fulfilled') setYesterday(y.value);
    setLoaded(true);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const slot = meal ?? mealTypeForNow();

  async function logOne(key: string, food: LoggedFood) {
    if (busyKey) return;
    tap();
    setBusyKey(key);
    setNote(null);
    const failed = await logEntries([food], slot);
    setBusyKey(null);
    if (failed.length) {
      setNote(`Couldn't log ${food.name} — check your connection and try again.`);
      return;
    }
    onLogged(1);
  }

  async function logMeal(m: SavedMeal) {
    if (busyKey) return;
    tap();
    setBusyKey(`meal:${m.id}`);
    setNote(null);
    const failed = await logSavedMeal(m, meal);
    setBusyKey(null);
    const landed = m.items.length - failed.length;
    if (failed.length) {
      setNote(landed > 0
        ? `Logged ${landed} of ${m.items.length} — couldn't log ${failed.join(', ')}.`
        : `Couldn't log ${m.name} — check your connection and try again.`);
      if (landed > 0) onLogged(landed);
      return;
    }
    onLogged(landed);
  }

  function toggleFavorite(food: LoggedFood) {
    const existing = isFavorite(favorites, food.name);
    Alert.alert(
      existing ? `Remove ${food.name} from favourites?` : `Add ${food.name} to favourites?`,
      existing ? undefined : `Saved as ${food.quantity != null && food.unit ? `${food.quantity} ${food.unit}, ` : ''}${Math.round(food.kcal)} kcal — one tap to log it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: existing ? 'Remove' : 'Add',
          style: existing ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (existing) await removeFavorite(existing.id); else await addFavorite(food);
              setFavorites(await getFavorites());
            } catch {
              setNote("Couldn't update favourites — try again.");
            }
          },
        },
      ],
    );
  }

  function removeMeal(m: SavedMeal) {
    Alert.alert(`Delete saved meal "${m.name}"?`, 'Logs already made from it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const { deleteSavedMeal } = await import('@/lib/quick-log');
            await deleteSavedMeal(m.id);
            setMeals(await getSavedMeals());
          } catch {
            setNote("Couldn't delete that meal — try again.");
          }
        },
      },
    ]);
  }

  // Recents that are not already shown as favourites.
  const favKeys = new Set(favorites.map((f) => nameKey(f.name)));
  const recentOnly = recents.filter((r) => !favKeys.has(nameKey(r.name)));

  const nothingYet = loaded && favorites.length === 0 && recentOnly.length === 0 && meals.length === 0 && yesterday.length === 0;
  if (nothingYet) return null;   // a brand-new diary has nothing to repeat; no empty section

  const yesterdayPick: PickableFood[] = yesterday.map((f) => ({ ...f, key: f.id }));

  return (
    <View>
      <Text style={s.sectionLabel}>Log again</Text>

      {yesterday.length > 0 ? (
        <AnimatedPressable style={s.repeatRow} onPress={() => { tap(); setRepeatOpen(true); }}>
          <View style={s.repeatIcon}><Icon name="refresh" color={C.greenInk} size={18} strokeWidth={2} /></View>
          <View style={s.repeatBody}>
            <Text style={s.repeatTitle}>Repeat yesterday</Text>
            <Text style={s.repeatSub}>
              {yesterday.length} item{yesterday.length === 1 ? '' : 's'} · {sumKcal(yesterday)} kcal — pick what to log again
            </Text>
          </View>
          <Icon name="arrow" color={C.green} size={18} strokeWidth={2} />
        </AnimatedPressable>
      ) : null}

      {meals.length > 0 ? (
        <View style={s.chips}>
          {meals.map((m) => (
            <AnimatedPressable
              key={m.id}
              style={[s.chip, s.mealChip, busyKey === `meal:${m.id}` && s.chipBusy]}
              onPress={() => logMeal(m)}
              onLongPress={() => removeMeal(m)}
              disabled={busyKey != null}
              accessibilityLabel={`Log saved meal ${m.name}`}
              accessibilityHint="Long press to delete"
            >
              <Icon name="bookmark" color={C.greenInk} size={14} strokeWidth={2.2} />
              <Text style={s.chipName} numberOfLines={1}>{m.name}</Text>
              <Text style={s.chipKcal}>{m.items.length} items · {sumKcal(m.items)} kcal</Text>
            </AnimatedPressable>
          ))}
        </View>
      ) : null}

      {favorites.length > 0 || recentOnly.length > 0 ? (
        <View style={s.chips}>
          {favorites.map((f) => (
            <FoodChip key={`fav:${f.id}`} food={f} starred busy={busyKey === `fav:${f.id}`} disabled={busyKey != null}
              onPress={() => logOne(`fav:${f.id}`, f)} onLongPress={() => toggleFavorite(f)} />
          ))}
          {recentOnly.map((r) => (
            <FoodChip key={`rec:${nameKey(r.name)}`} food={r} busy={busyKey === `rec:${nameKey(r.name)}`} disabled={busyKey != null}
              onPress={() => logOne(`rec:${nameKey(r.name)}`, r)} onLongPress={() => toggleFavorite(r)} />
          ))}
        </View>
      ) : null}

      {note ? <Text style={s.note}>{note}</Text> : null}
      <Text style={s.hint}>Tap to log it again as logged before · long-press to star</Text>

      <PickFoodsSheet
        visible={repeatOpen}
        title="Repeat yesterday"
        subtitle="Each item goes under the meal it had yesterday. Untick anything you didn't have today."
        foods={yesterdayPick}
        primaryLabel={(sel) => `Log ${sel.length} item${sel.length === 1 ? '' : 's'} again`}
        onPrimary={async (sel) => {
          const chosen = yesterday.filter((f) => sel.some((p) => p.key === f.id));
          const failed = await repeatFoods(chosen);
          const landed = chosen.length - failed.length;
          if (failed.length) {
            throw new Error(landed > 0
              ? `Logged ${landed} of ${chosen.length} — couldn't log ${failed.join(', ')}.`
              : "Couldn't log those — check your connection and try again.");
          }
          setRepeatOpen(false);
          onLogged(landed);
        }}
        onSaveMeal={async (name, sel) => {
          const items: LoggedFood[] = sel.map(({ key: _k, meal_type: _m, ...food }) => food);
          await saveMeal(name, items, null);
          setMeals(await getSavedMeals());
          setRepeatOpen(false);
        }}
        onClose={() => setRepeatOpen(false)}
      />
    </View>
  );
}

function FoodChip({ food, starred, busy, disabled, onPress, onLongPress }: {
  food: LoggedFood; starred?: boolean; busy: boolean; disabled: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const approx = food.provenance === 'ai_estimate' || food.provenance === 'analog_estimate' ? '≈' : '';
  return (
    <AnimatedPressable
      style={[s.chip, busy && s.chipBusy]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={`Log ${food.name} again`}
      accessibilityHint={starred ? 'Long press to remove from favourites' : 'Long press to add to favourites'}
    >
      {starred ? <Icon name="star" color={C.amber} size={14} strokeWidth={2.2} /> : <View style={s.chipDot} />}
      <Text style={s.chipName} numberOfLines={1}>{food.name}</Text>
      <Text style={s.chipKcal}>{approx}{Math.round(food.kcal)} kcal</Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 0.7,
    textTransform: 'uppercase', color: C.inkSoft, marginTop: Spacing.three, marginBottom: 8,
  },
  repeatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1,
    borderColor: C.cardBorder, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8, ...Shadow.sm,
  },
  repeatIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  repeatBody: { flex: 1, gap: 2 },
  repeatTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  repeatSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1,
    borderColor: C.cardBorder, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11,
    minWidth: 80, maxWidth: '100%', ...Shadow.sm,
  },
  mealChip: { backgroundColor: C.greenSoft, borderColor: 'rgba(76,124,99,0.22)' },
  chipBusy: { opacity: 0.6 },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  chipName: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 14, fontWeight: '500', color: C.ink, flexShrink: 1 },
  chipKcal: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkSoft },
  note: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.red, marginTop: 2 },
  hint: { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkFaint, marginTop: 2 },
});
