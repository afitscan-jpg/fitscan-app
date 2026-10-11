// src/components/pick-foods-sheet.tsx
// One sheet for the two "a set of foods → do something" moments in Sprint 3:
//   • Repeat yesterday: yesterday's rows, pick which to log again today
//   • Save as meal: today's rows (or any set), pick which to bundle under a name
// The same sheet serves both, with the primary action supplied by the caller,
// and a secondary "Save as meal" is offered on the repeat flow so a day that
// went well can become a saved meal in one more tap.
//
// Layout follows the photo "Ready to log" sheet: a definite snap height
// (sheet-snap.ts), the list scrolls, the footer is pinned and the list pads by
// its measured height so the last row clears the button.

import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { type MealType } from '@/lib/db';
import { sumKcal, type LoggedFood } from '@/lib/quick-log';
import { pickSheetHeight } from '@/lib/sheet-snap';

export interface PickableFood extends LoggedFood {
  key: string;
  meal_type?: MealType;
}

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  foods: PickableFood[];
  /** Primary button label, e.g. "Log 4 items". Receives the selection. Omit
   *  both to show only the save-as-meal flow. */
  primaryLabel?: (selected: PickableFood[]) => string;
  onPrimary?: (selected: PickableFood[]) => Promise<void>;
  /** When set, a name field + "Save as meal" secondary action is shown. */
  onSaveMeal?: (name: string, selected: PickableFood[]) => Promise<void>;
  onClose: () => void;
};

const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

export function PickFoodsSheet({ visible, title, subtitle, foods, primaryLabel, onPrimary, onSaveMeal, onClose }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [mealName, setMealName] = useState('');
  const [busy, setBusy] = useState<'primary' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { height: winH } = useWindowDimensions();
  const [topH, setTopH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [footerH, setFooterH] = useState(0);
  const needed = contentH > 0 ? 16 + topH + 12 + contentH : 0;
  const sheetH = pickSheetHeight(needed, winH, foods.length);

  const ordered = useMemo(
    () => [...foods].sort((a, b) => (MEAL_ORDER[a.meal_type ?? ''] ?? 9) - (MEAL_ORDER[b.meal_type ?? ''] ?? 9)),
    [foods],
  );
  const selected = ordered.filter((f) => !excluded.has(f.key));
  const total = sumKcal(selected);

  function toggle(key: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function run(kind: 'primary' | 'save') {
    if (busy || selected.length === 0) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'primary') await onPrimary?.(selected);
      else await onSaveMeal?.(mealName, selected);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'That did not work — please try again.');
    } finally {
      setBusy(null);
    }
  }

  let lastMeal: string | undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <Pressable style={s.overlay} onPress={() => { if (!busy) onClose(); }}>
        <Pressable style={[s.sheet, { height: sheetH }]} onPress={() => undefined}>
          <View onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <Text style={s.title}>{title}</Text>
              <Pressable onPress={() => { if (!busy) onClose(); }} hitSlop={12} style={s.closeBtn}>
                <Text style={s.closeTxt}>×</Text>
              </Pressable>
            </View>
            {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={s.scrollWrap}>
            <ScrollView
              style={s.scroll}
              contentContainerStyle={{ paddingBottom: footerH + 12 }}
              onContentSizeChange={(_w, h) => setContentH(h)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {ordered.map((f) => {
                const on = !excluded.has(f.key);
                const showMeal = f.meal_type && f.meal_type !== lastMeal;
                lastMeal = f.meal_type;
                return (
                  <View key={f.key}>
                    {showMeal ? (
                      <Text style={s.mealLabel}>{f.meal_type!.charAt(0).toUpperCase() + f.meal_type!.slice(1)}</Text>
                    ) : null}
                    <Pressable
                      style={[s.row, !on && s.rowOff]}
                      onPress={() => toggle(f.key)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={f.name}
                    >
                      <View style={[s.check, on && s.checkOn]}>
                        {on ? <Icon name="check" color="#fff" size={13} strokeWidth={2.8} /> : null}
                      </View>
                      <View style={s.rowBody}>
                        <Text style={s.rowName} numberOfLines={1}>{f.name}</Text>
                        <Text style={s.rowMeta} numberOfLines={1}>
                          {f.quantity != null && f.unit ? `${f.quantity} ${f.unit} · ` : ''}
                          {f.provenance === 'ai_estimate' || f.provenance === 'analog_estimate' ? '≈' : ''}{Math.round(f.kcal)} kcal
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
              {onSaveMeal ? (
                <View style={s.nameWrap}>
                  <Text style={s.nameLabel}>Save these as a meal</Text>
                  <TextInput
                    style={s.nameInput}
                    placeholder="e.g. Usual breakfast"
                    placeholderTextColor={C.inkFaint}
                    value={mealName}
                    onChangeText={setMealName}
                    maxLength={40}
                    returnKeyType="done"
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={s.footer} onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Text style={s.total}>
                {selected.length} item{selected.length === 1 ? '' : 's'} · {total} kcal
              </Text>
              {onPrimary && primaryLabel ? (
                <AnimatedPressable
                  style={[s.primary, (busy != null || selected.length === 0) && s.dim]}
                  onPress={() => run('primary')}
                  disabled={busy != null || selected.length === 0}
                >
                  {busy === 'primary' ? <ActivityIndicator color="#fff" /> : (
                    <Text style={s.primaryTxt}>{primaryLabel(selected)}</Text>
                  )}
                </AnimatedPressable>
              ) : null}
              {onSaveMeal ? (
                <AnimatedPressable
                  style={[onPrimary ? s.secondary : s.primary, (busy != null || selected.length === 0 || !mealName.trim()) && s.dim]}
                  onPress={() => run('save')}
                  disabled={busy != null || selected.length === 0 || !mealName.trim()}
                >
                  {busy === 'save' ? <ActivityIndicator color={onPrimary ? C.green : '#fff'} /> : (
                    <Text style={onPrimary ? s.secondaryTxt : s.primaryTxt}>
                      {mealName.trim() ? 'Save as meal' : 'Name the meal to save it'}
                    </Text>
                  )}
                </AnimatedPressable>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: 16, paddingTop: 16,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkSoft },
  subtitle: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkSoft, lineHeight: 19, marginTop: 4 },
  scrollWrap: { flex: 1, minHeight: 0, position: 'relative', marginTop: 12 },
  scroll: { flex: 1 },
  mealLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 0.7,
    textTransform: 'uppercase', color: C.inkSoft, marginTop: 10, marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowOff: { opacity: 0.45 },
  check: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg,
  },
  checkOn: { backgroundColor: C.green, borderColor: C.green },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 15, fontWeight: '500', color: C.ink },
  rowMeta: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft },
  nameWrap: { marginTop: 16, gap: 6 },
  nameLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.inkSoft },
  nameInput: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: Radius.sm,
    paddingVertical: 10, paddingHorizontal: 12, fontFamily: Fonts?.body ?? 'system', fontSize: 15, color: C.ink,
  },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingBottom: 28,
    backgroundColor: C.card, gap: 8,
  },
  error: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.red, textAlign: 'center' },
  total: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, textAlign: 'center' },
  primary: { backgroundColor: C.green, borderRadius: Radius.md, height: 50, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  primaryTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  secondary: { borderRadius: Radius.md, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.green },
  secondaryTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.green },
  dim: { opacity: 0.6 },
});
