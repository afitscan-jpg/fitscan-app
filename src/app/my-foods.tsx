// src/app/my-foods.tsx
// Your foods & recipes (Sprint 4, slices 2 + 3).
//
//   • list of the user's custom foods and recipes, with delete
//   • "Add a food": label values per serving → the server derives per-100 g and
//     stores it as "Your entry"
//   • "Build a recipe": registry ingredients + grams, cooked weight, servings →
//     the server computes per-100 g and stores it as "Your recipe"
//
// Everything saved here is private and matched first when the user types its
// name on the Add screen ("mom's dal: 3 katoris"). No number is computed on
// this screen: the server checks the label values add up and does the recipe
// arithmetic, and says in words when they do not.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { KeyboardSheet } from '@/components/keyboard-sheet';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { tap, logSuccess } from '@/lib/feedback';
import { pickSheetHeight } from '@/lib/sheet-snap';
import {
  createEntry, createRecipe, deleteMyFood, FoodInputError, listMyFoods, NumbersDisagreeError, searchRegistry,
  servingKcal, type RegistryFood, type UserFood,
} from '@/lib/user-foods';

const SERVING_LABELS = ['serving', 'piece', 'bar', 'scoop', 'katori', 'cup', 'bowl', 'plate', 'slice', 'tbsp', 'packet'] as const;

function num(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function errorText(e: unknown, fallback: string): string {
  if (e instanceof FoodInputError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export default function MyFoodsScreen() {
  const [foods, setFoods] = useState<UserFood[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setFoods(await listMyFoods());
      setLoadError(false);
    } catch {
      setLoadError(true);
      setFoods((f) => f ?? []);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function confirmDelete(f: UserFood) {
    Alert.alert(`Delete "${f.name}"?`, 'Anything already logged from it stays in your diary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteMyFood(f.id); await load(); }
          catch (e) { Alert.alert("Couldn't delete", errorText(e, 'Please try again.')); }
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Your foods</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.actions}>
            <AnimatedPressable style={s.actionCard} onPress={() => { tap(); setEntryOpen(true); }}>
              <View style={s.actionIcon}><Icon name="plus" color={C.greenInk} size={20} strokeWidth={2.2} /></View>
              <Text style={s.actionTitle}>Add a food</Text>
              <Text style={s.actionSub}>From a label: enter the numbers on the pack</Text>
            </AnimatedPressable>
            <AnimatedPressable style={s.actionCard} onPress={() => { tap(); setRecipeOpen(true); }}>
              <View style={s.actionIcon}><Icon name="bookmark" color={C.greenInk} size={20} strokeWidth={2.2} /></View>
              <Text style={s.actionTitle}>Build a recipe</Text>
              <Text style={s.actionSub}>Home-cooked: we calculate it from your ingredients</Text>
            </AnimatedPressable>
          </View>

          <Text style={s.hint}>
            {"Once saved, just type the name when you log — \u201cmom's dal, 3 katoris\u201d — and it's matched before anything else. Only you can see these."}
          </Text>

          {foods === null ? (
            <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />
          ) : loadError && foods.length === 0 ? (
            <Text style={s.empty}>{"Couldn't load your foods — check your connection and come back."}</Text>
          ) : foods.length === 0 ? (
            <Text style={s.empty}>Nothing saved yet. Add a food from a label, or build a home-cooked recipe from your ingredients.</Text>
          ) : (
            foods.map((f) => {
              const sv = servingKcal(f);
              return (
                <View key={f.id} style={s.row}>
                  <View style={s.rowBody}>
                    <View style={s.rowTop}>
                      <Text style={s.rowName} numberOfLines={1}>{f.name}</Text>
                      <View style={[s.pill, f.kind === 'recipe' ? s.pillRecipe : s.pillEntry]}>
                        <Text style={s.pillTxt}>{f.kind === 'recipe' ? 'Your recipe' : 'Your entry'}</Text>
                      </View>
                    </View>
                    <Text style={s.rowMeta} numberOfLines={2}>
                      {sv ? `1 ${sv.label} (${sv.grams} g) · ${sv.kcal} kcal · ` : ''}
                      {Math.round(f.kcal_100g)} kcal / 100 g
                      {f.source_note ? ` · ${f.source_note}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => confirmDelete(f)} hitSlop={10} accessibilityLabel={`Delete ${f.name}`} style={s.rowDel}>
                    <Text style={s.rowDelTxt}>×</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Mounted only while open, so every open starts with a blank form. */}
      {entryOpen ? (
        <EntrySheet visible onClose={() => setEntryOpen(false)} onSaved={() => { setEntryOpen(false); logSuccess(); void load(); }} />
      ) : null}
      {recipeOpen ? (
        <RecipeSheet visible onClose={() => setRecipeOpen(false)} onSaved={() => { setRecipeOpen(false); logSuccess(); void load(); }} />
      ) : null}
    </View>
  );
}

// ─── Add a food (label values) ───────────────────────────────────────────────

function EntrySheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [label, setLabel] = useState<(typeof SERVING_LABELS)[number]>('serving');
  const [servingG, setServingG] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [note, setNote] = useState<'label' | 'own estimate'>('label');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const g = num(servingG), k = num(kcal);
  const ready = name.trim().length > 0 && g != null && g > 0 && k != null && k >= 0;

  async function save(force = false) {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try {
      const { warning } = await createEntry({
        name: name.trim(),
        aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
        serving_label: label, serving_g: g!, kcal: k!,
        protein_g: num(protein) ?? 0, carb_g: num(carb) ?? 0, fat_g: num(fat) ?? 0,
        fiber_g: fiber.trim() ? num(fiber) : null, source_note: note, force,
      });
      onSaved();
      if (warning) Alert.alert('Saved, with a note', warning);
    } catch (e) {
      if (e instanceof NumbersDisagreeError) {
        // 10-25% off the 4/4/9 sum: the user's call. Beyond that the server
        // refuses outright and this branch is never reached.
        Alert.alert('The numbers don\u2019t quite add up', e.message, [
          { text: 'Check them', style: 'cancel' },
          { text: 'Save anyway', onPress: () => void save(true) },
        ]);
        return;
      }
      setError(errorText(e, "Couldn't save that — please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Add a food" subtitle="Copy the numbers from the label for one serving. We store them as yours — never as verified." onClose={() => { if (!busy) onClose(); }}
      footer={
        <>
          {error ? <Text style={f.error}>{error}</Text> : null}
          <AnimatedPressable style={[f.primary, (!ready || busy) && f.dim]} onPress={() => void save()} disabled={!ready || busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryTxt}>{'Save as \u201cYour entry\u201d'}</Text>}
          </AnimatedPressable>
        </>
      }>
      <Field label="Name"><TextInput style={f.input} value={name} onChangeText={setName} placeholder="e.g. My protein bar" placeholderTextColor={C.inkFaint} maxLength={60} /></Field>
      <Field label="Other names (optional, comma-separated)"><TextInput style={f.input} value={aliases} onChangeText={setAliases} placeholder="protein bar, PB bar" placeholderTextColor={C.inkFaint} maxLength={200} /></Field>
      <Text style={f.label}>One serving is a…</Text>
      <View style={f.chips}>
        {SERVING_LABELS.map((l) => (
          <Pressable key={l} style={[f.chip, label === l && f.chipOn]} onPress={() => setLabel(l)} accessibilityRole="button" accessibilityState={{ selected: label === l }}>
            <Text style={[f.chipTxt, label === l && f.chipTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={`Weight of one ${label} (g)`}><NumInput value={servingG} onChange={setServingG} placeholder="e.g. 45" /></Field>
      <View style={f.grid}>
        <Field label="Calories (kcal)" half><NumInput value={kcal} onChange={setKcal} placeholder="e.g. 210" /></Field>
        <Field label="Protein (g)" half><NumInput value={protein} onChange={setProtein} placeholder="e.g. 15" /></Field>
        <Field label="Carbs (g)" half><NumInput value={carb} onChange={setCarb} placeholder="e.g. 20" /></Field>
        <Field label="Fat (g)" half><NumInput value={fat} onChange={setFat} placeholder="e.g. 7.5" /></Field>
        <Field label="Fibre (g)" half><NumInput value={fiber} onChange={setFiber} placeholder="optional" /></Field>
      </View>
      <Text style={f.label}>Where these numbers are from</Text>
      <View style={f.chips}>
        {(['label', 'own estimate'] as const).map((n) => (
          <Pressable key={n} style={[f.chip, note === n && f.chipOn]} onPress={() => setNote(n)} accessibilityRole="button" accessibilityState={{ selected: note === n }}>
            <Text style={[f.chipTxt, note === n && f.chipTxtOn]}>{n === 'label' ? 'The pack label' : 'My own estimate'}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// ─── Build a recipe ──────────────────────────────────────────────────────────

type Line = { food: RegistryFood; grams: string };

function RecipeSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [totalG, setTotalG] = useState('');
  const [servings, setServings] = useState('');
  const [label, setLabel] = useState<(typeof SERVING_LABELS)[number]>('katori');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  // Debounced registry search; a stale response never overwrites a newer one.
  // State is only set from inside the timer, never synchronously in the effect.
  useEffect(() => {
    const term = query.trim();
    const seq = ++searchSeq.current;
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      if (seq !== searchSeq.current) return;
      setSearching(true);
      const found = await searchRegistry(term, 'recipe').catch(() => []);
      if (seq === searchSeq.current) { setResults(found); setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  // Results belong to the current query; a shorter query shows none.
  const visibleResults = query.trim().length >= 2 ? results : [];

  function addLine(food: RegistryFood) {
    tap();
    setLines((prev) => prev.some((l) => l.food.id === food.id) ? prev : [...prev, { food, grams: '' }]);
    setQuery(''); setResults([]);
  }

  const rawTotal = lines.reduce((n, l) => n + (num(l.grams) ?? 0), 0);
  const tot = num(totalG), sv = num(servings);
  const ready = name.trim().length > 0 && lines.length > 0 && lines.every((l) => (num(l.grams) ?? 0) > 0) && tot != null && tot > 0 && sv != null && sv > 0;

  async function save() {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await createRecipe({
        name: name.trim(),
        aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
        ingredients: lines.map((l) => ({ canonical_food_id: l.food.id, grams: num(l.grams)! })),
        total_weight_g: tot!, servings: sv!, serving_label: label,
      });
      onSaved();
      // Show the working: the user can see exactly how the number was made.
      const notes = [
        ...saved.arithmetic,
        ...(saved.warnings.length ? ['', ...saved.warnings] : []),
        ...(saved.has_estimate ? ['', 'One or more ingredients are estimates, so this recipe shows as an estimate too.'] : []),
      ];
      Alert.alert('Saved', notes.join('\n'));
    } catch (e) {
      setError(errorText(e, "Couldn't save that — please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Build a recipe" subtitle="Pick ingredients from the food registry and give the grams you used. Then say how much the finished dish weighed and how many servings it made." onClose={() => { if (!busy) onClose(); }}
      footer={
        <>
          {error ? <Text style={f.error}>{error}</Text> : null}
          <AnimatedPressable style={[f.primary, (!ready || busy) && f.dim]} onPress={save} disabled={!ready || busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryTxt}>{'Save as \u201cYour recipe\u201d'}</Text>}
          </AnimatedPressable>
        </>
      }>
      <Field label="Name"><TextInput style={f.input} value={name} onChangeText={setName} placeholder="e.g. Mom's dal" placeholderTextColor={C.inkFaint} maxLength={60} /></Field>
      <Field label="Other names (optional, comma-separated)"><TextInput style={f.input} value={aliases} onChangeText={setAliases} placeholder="dal, ghar ki dal" placeholderTextColor={C.inkFaint} maxLength={200} /></Field>

      <Text style={f.label}>Ingredients · raw weight (g)</Text>
      {lines.map((l, i) => (
        <View key={l.food.id} style={f.line}>
          <View style={f.lineBody}>
            <Text style={f.lineName} numberOfLines={1}>{l.food.name}</Text>
            <Text style={f.lineMeta}>
              {Math.round(l.food.kcal_100g)} kcal / 100 g · {l.food.provenance === 'ai_estimate' || l.food.provenance === 'analog_estimate' ? 'estimate' : l.food.provenance.replace('_', ' ')}
              {l.food.cooked ? ' · cooked row — enter the cooked weight you used' : ''}
            </Text>
          </View>
          <NumInput value={l.grams} onChange={(v) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, grams: v } : x)))} placeholder="g" compact />
          <Text style={f.unit}>g</Text>
          <Pressable onPress={() => setLines((prev) => prev.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={`Remove ${l.food.name}`}>
            <Text style={f.lineDel}>×</Text>
          </Pressable>
        </View>
      ))}
      <View style={f.searchRow}>
        <TextInput style={[f.input, f.flex]} value={query} onChangeText={setQuery} placeholder={lines.length ? 'Add another ingredient…' : 'Search the registry, e.g. toor dal'} placeholderTextColor={C.inkFaint} autoCorrect={false} />
        {searching ? <ActivityIndicator color={C.green} /> : null}
      </View>
      {visibleResults.length > 0 ? (
        <View style={f.results}>
          {visibleResults.slice(0, 8).map((r) => (
            <Pressable key={r.id} style={f.result} onPress={() => addLine(r)} accessibilityRole="button" accessibilityLabel={`Add ${r.name}`}>
              <Text style={f.resultName} numberOfLines={1}>{r.name}</Text>
              <Text style={f.resultMeta}>{Math.round(r.kcal_100g)} kcal/100 g{r.cooked ? ' · cooked' : ''}</Text>
            </Pressable>
          ))}
        </View>
      ) : query.trim().length >= 2 && !searching ? (
        <Text style={f.noResult}>{`No ingredient in the registry for \u201c${query.trim()}\u201d (dishes are left out — a recipe is built from what a dish is made of). Add it as a food first, or try another name.`}</Text>
      ) : null}

      {lines.length > 0 ? <Text style={f.sum}>Ingredients: {Math.round(rawTotal)} g as entered</Text> : null}
      <View style={f.grid}>
        <Field label="Cooked weight (g)" half><NumInput value={totalG} onChange={setTotalG} placeholder="e.g. 900" /></Field>
        <Field label="Servings" half><NumInput value={servings} onChange={setServings} placeholder="e.g. 6" /></Field>
      </View>
      <Text style={f.rowHint}>Weigh the whole pot after cooking</Text>
      {tot && sv ? <Text style={f.sum}>One serving ≈ {Math.round(tot / sv)} g</Text> : null}
      <Text style={f.label}>Call one serving a…</Text>
      <View style={f.chips}>
        {SERVING_LABELS.map((l) => (
          <Pressable key={l} style={[f.chip, label === l && f.chipOn]} onPress={() => setLabel(l)} accessibilityRole="button" accessibilityState={{ selected: label === l }}>
            <Text style={[f.chipTxt, label === l && f.chipTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// ─── Shared sheet + fields ───────────────────────────────────────────────────

function Sheet({ visible, title, subtitle, children, footer, onClose }: {
  visible: boolean; title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void;
}) {
  const { height: winH } = useWindowDimensions();
  const [topH, setTopH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [footerH, setFooterH] = useState(0);
  const needed = contentH > 0 ? 16 + topH + 12 + contentH : 0;
  const sheetH = pickSheetHeight(needed, winH, 6);
  return (
    <KeyboardSheet visible={visible} onClose={onClose}>
      {({ maxHeight }) => (
      <View style={f.overlay}>
        <Pressable style={f.overlayTap} onPress={onClose} />
        <View style={[f.sheet, { height: Math.min(sheetH, maxHeight) }]}>
          <View onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
            <View style={f.handle} />
            <View style={f.headerRow}>
              <Text style={f.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={f.closeBtn}><Text style={f.closeTxt}>×</Text></Pressable>
            </View>
            <Text style={f.subtitle}>{subtitle}</Text>
          </View>
          <View style={f.scrollWrap}>
            <ScrollView style={f.flex} contentContainerStyle={{ paddingBottom: footerH + 12 }} onContentSizeChange={(_w, h) => setContentH(h)} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            <View style={f.footer} onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}>{footer}</View>
          </View>
        </View>
      </View>
      )}
    </KeyboardSheet>
  );
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <View style={[f.field, half && f.half]}>
      <Text style={f.label}>{label}</Text>
      {children}
    </View>
  );
}

function NumInput({ value, onChange, placeholder, compact }: { value: string; onChange: (v: string) => void; placeholder?: string; compact?: boolean }) {
  return (
    <TextInput
      style={[f.input, compact && f.inputCompact]}
      value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
      placeholder={placeholder}
      placeholderTextColor={C.inkFaint}
      keyboardType="decimal-pad"
      maxLength={7}
      selectTextOnFocus
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 22, paddingBottom: 120, gap: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, backgroundColor: C.card, borderRadius: Radius.lg, padding: 14, gap: 6, borderWidth: 1, borderColor: C.cardBorder, ...Shadow.sm },
  actionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  actionSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft },
  hint: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, lineHeight: 18 },
  empty: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkSoft, textAlign: 'center', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.cardBorder, ...Shadow.sm },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  rowMeta: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, lineHeight: 17 },
  rowDel: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rowDelTxt: { fontSize: 22, lineHeight: 26, color: C.inkSoft },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillEntry: { backgroundColor: C.waterBlueSoft },
  pillRecipe: { backgroundColor: C.waterBlueSoft },
  pillTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', color: C.waterBlueInk },
});

const f = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  overlayTap: { flex: 1 },
  flex: { flex: 1 },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingHorizontal: 16, paddingTop: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkSoft },
  subtitle: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft, lineHeight: 18, marginTop: 4 },
  scrollWrap: { flex: 1, minHeight: 0, position: 'relative', marginTop: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingBottom: 28, backgroundColor: C.card, gap: 8 },
  field: { marginBottom: 12 },
  half: { width: '48%', justifyContent: 'flex-end' },
  // alignItems flex-end: each cell is label-over-input, so aligning cells to
  // the bottom keeps the INPUTS level even when one label wraps.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' },
  rowHint: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, marginTop: -6, marginBottom: 10 },
  label: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600', color: C.inkSoft, marginBottom: 6 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: Radius.sm, paddingVertical: 10, paddingHorizontal: 12, fontFamily: Fonts?.body ?? 'system', fontSize: 15, color: C.ink },
  inputCompact: { width: 76, paddingVertical: 8, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipTxt: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 13, fontWeight: '500', color: C.ink },
  chipTxtOn: { color: '#fff' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  lineBody: { flex: 1, gap: 2 },
  lineName: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 14.5, fontWeight: '500', color: C.ink },
  lineMeta: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkSoft },
  lineDel: { fontSize: 20, lineHeight: 24, color: C.inkSoft, paddingHorizontal: 4 },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 6 },
  results: { backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.line, marginBottom: 10 },
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  resultName: { flex: 1, fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 14, fontWeight: '500', color: C.ink },
  resultMeta: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkSoft },
  noResult: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, marginBottom: 10 },
  sum: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, marginBottom: 8 },
  error: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.red, textAlign: 'center' },
  primary: { backgroundColor: C.green, borderRadius: Radius.md, height: 50, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  primaryTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  dim: { opacity: 0.6 },
});
