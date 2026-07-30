import * as Localization from 'expo-localization';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { updateProfile, type Goal, type Sex } from '@/lib/db';

// ─── Data ────────────────────────────────────────────────────────────────────

const COUNTRIES: Array<{ code: string; name: string; group: string }> = [
  // Popular
  { code: 'IN', name: 'India',          group: 'Popular' },
  { code: 'US', name: 'United States',  group: 'Popular' },
  { code: 'GB', name: 'United Kingdom', group: 'Popular' },
  { code: 'AU', name: 'Australia',      group: 'Popular' },
  { code: 'CA', name: 'Canada',         group: 'Popular' },
  { code: 'SG', name: 'Singapore',      group: 'Popular' },
  { code: 'AE', name: 'UAE',            group: 'Popular' },
  { code: 'PK', name: 'Pakistan',       group: 'Popular' },
  { code: 'BD', name: 'Bangladesh',     group: 'Popular' },
  { code: 'MY', name: 'Malaysia',       group: 'Popular' },
  // A–Z
  { code: 'AR', name: 'Argentina',      group: 'A–Z' },
  { code: 'AT', name: 'Austria',        group: 'A–Z' },
  { code: 'BE', name: 'Belgium',        group: 'A–Z' },
  { code: 'BR', name: 'Brazil',         group: 'A–Z' },
  { code: 'CH', name: 'Switzerland',    group: 'A–Z' },
  { code: 'CL', name: 'Chile',          group: 'A–Z' },
  { code: 'CN', name: 'China',          group: 'A–Z' },
  { code: 'CO', name: 'Colombia',       group: 'A–Z' },
  { code: 'DE', name: 'Germany',        group: 'A–Z' },
  { code: 'DK', name: 'Denmark',        group: 'A–Z' },
  { code: 'EG', name: 'Egypt',          group: 'A–Z' },
  { code: 'ES', name: 'Spain',          group: 'A–Z' },
  { code: 'ET', name: 'Ethiopia',       group: 'A–Z' },
  { code: 'FI', name: 'Finland',        group: 'A–Z' },
  { code: 'FR', name: 'France',         group: 'A–Z' },
  { code: 'GH', name: 'Ghana',          group: 'A–Z' },
  { code: 'HK', name: 'Hong Kong',      group: 'A–Z' },
  { code: 'ID', name: 'Indonesia',      group: 'A–Z' },
  { code: 'IE', name: 'Ireland',        group: 'A–Z' },
  { code: 'IL', name: 'Israel',         group: 'A–Z' },
  { code: 'IT', name: 'Italy',          group: 'A–Z' },
  { code: 'JP', name: 'Japan',          group: 'A–Z' },
  { code: 'KE', name: 'Kenya',          group: 'A–Z' },
  { code: 'KR', name: 'South Korea',    group: 'A–Z' },
  { code: 'LK', name: 'Sri Lanka',      group: 'A–Z' },
  { code: 'MX', name: 'Mexico',         group: 'A–Z' },
  { code: 'NG', name: 'Nigeria',        group: 'A–Z' },
  { code: 'NL', name: 'Netherlands',    group: 'A–Z' },
  { code: 'NO', name: 'Norway',         group: 'A–Z' },
  { code: 'NP', name: 'Nepal',          group: 'A–Z' },
  { code: 'NZ', name: 'New Zealand',    group: 'A–Z' },
  { code: 'PH', name: 'Philippines',    group: 'A–Z' },
  { code: 'PL', name: 'Poland',         group: 'A–Z' },
  { code: 'PT', name: 'Portugal',       group: 'A–Z' },
  { code: 'RU', name: 'Russia',         group: 'A–Z' },
  { code: 'SA', name: 'Saudi Arabia',   group: 'A–Z' },
  { code: 'SE', name: 'Sweden',         group: 'A–Z' },
  { code: 'TH', name: 'Thailand',       group: 'A–Z' },
  { code: 'TR', name: 'Turkey',         group: 'A–Z' },
  { code: 'TZ', name: 'Tanzania',       group: 'A–Z' },
  { code: 'UA', name: 'Ukraine',        group: 'A–Z' },
  { code: 'UG', name: 'Uganda',         group: 'A–Z' },
  { code: 'VN', name: 'Vietnam',        group: 'A–Z' },
  { code: 'ZA', name: 'South Africa',   group: 'A–Z' },
  { code: 'ZW', name: 'Zimbabwe',       group: 'A–Z' },
];

const COUNTRY_DEFAULT_CODES = ['IN', 'US', 'GB', 'AU', 'CA', 'SG'];

const ACTIVITY_OPTIONS: Array<{ label: string; factor: number; desc: string }> = [
  { label: 'Sedentary',         factor: 1.2,   desc: 'Little or no exercise, mostly sitting' },
  { label: 'Lightly active',    factor: 1.375, desc: 'Light exercise 1–3 days/week' },
  { label: 'Moderately active', factor: 1.55,  desc: 'Moderate exercise 3–5 days/week' },
  { label: 'Very active',       factor: 1.725, desc: 'Hard exercise 6–7 days/week' },
  { label: 'Extra active',      factor: 1.9,   desc: 'Physical job or twice-a-day training' },
];

const GOAL_OPTIONS: Array<{ label: string; value: Goal; note?: string }> = [
  { label: 'Lose weight',             value: 'lose' },
  { label: 'Maintain',                value: 'maintain' },
  { label: 'Gain weight',             value: 'gain' },
  { label: 'Build muscle',            value: 'build_muscle', note: 'Higher protein targets' },
  { label: 'Lose fat + build muscle', value: 'recomp',       note: 'Body recomposition · high protein' },
];

const FOOD_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Vegetarian',     value: 'vegetarian' },
  { label: 'Eggetarian',     value: 'eggetarian' },
  { label: 'Non-vegetarian', value: 'non_veg' },
  { label: 'Vegan',          value: 'vegan' },
];

const SEX_OPTIONS: Array<{ label: string; value: Sex }> = [
  { label: 'Male',   value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other',  value: 'other' },
];

// ─── Shared row component ────────────────────────────────────────────────────

function SelectRow({
  name,
  sub,
  code,
  selected,
  onSelect,
}: {
  name: string;
  sub: string;
  code: string;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <Pressable
      style={[s.langRow, selected && s.langRowSel]}
      onPress={() => onSelect(code)}
    >
      <View style={s.langText}>
        <Text style={[s.langName, selected && s.langNameSel]}>{name}</Text>
        <Text style={s.langSub}>{sub}</Text>
      </View>
      <View style={[s.check, selected && s.checkSel]} />
    </Pressable>
  );
}

// ─── Step 1: Country ─────────────────────────────────────────────────────────

function CountryStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: string;
  onSelect: (code: string) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const searching = query.trim().length > 0;

  const visibleItems = searching
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : (() => {
        const defaults = COUNTRY_DEFAULT_CODES
          .map((c) => COUNTRIES.find((cc) => cc.code === c))
          .filter((c): c is (typeof COUNTRIES)[0] => Boolean(c));
        if (!COUNTRY_DEFAULT_CODES.includes(selected)) {
          const sel = COUNTRIES.find((c) => c.code === selected);
          if (sel) return [sel, ...defaults];
        }
        return defaults;
      })();

  async function handleContinue() {
    setSaving(true);
    try {
      await updateProfile({ country: selected });
    } catch { /* non-blocking */ }
    finally {
      setSaving(false);
      onContinue();
    }
  }

  return (
    <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.langScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.obMark}>
          <Icon name="leaf" color="#fff" size={26} strokeWidth={1.8} />
        </View>
        <Text style={s.eyebrow}>Step 1 of 2 · Country</Text>
        <Text style={s.obHero}>Where are you based?</Text>
        <Text style={s.obSub}>
          We use this to show you locally relevant foods and portion references.
        </Text>

        <View style={s.searchBox}>
          <Icon name="search" color={C.inkFaint} size={16} strokeWidth={1.8} />
          <TextInput
            style={s.searchInput}
            placeholder="Search countries"
            placeholderTextColor={C.inkFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        {!searching && <Text style={s.searchHint}>Popular · search for all countries</Text>}

        <View style={s.list}>
          {visibleItems.map((c) => (
            <SelectRow
              key={c.code}
              code={c.code}
              name={c.name}
              sub={c.code}
              selected={selected === c.code}
              onSelect={onSelect}
            />
          ))}
        </View>

        {searching && visibleItems.length === 0 && (
          <Text style={s.noMatch}>No match found.</Text>
        )}

        <Pressable style={s.primaryBtn} onPress={handleContinue} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── BMI helper ──────────────────────────────────────────────────────────────

function bmiBand(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Healthy range';
  if (bmi < 30)   return 'Above healthy range';
  return 'Well above healthy range';
}

// ─── Diet multi-select ───────────────────────────────────────────────────────

function DietMultiSelect({ selected, onToggle }: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={s.dietGrid}>
      {FOOD_OPTIONS.map((opt) => {
        const on = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[s.dietChip, on && s.dietChipOn]}
            onPress={() => onToggle(opt.value)}
          >
            <Text style={[s.dietChipText, on && s.dietChipTextOn]}>{opt.label}</Text>
            <View style={[s.check, on && s.checkSel]} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Goal cards ──────────────────────────────────────────────────────────────

function GoalCards({ goal, onSelect }: { goal: Goal; onSelect: (g: Goal) => void }) {
  return (
    <View style={s.goalCards}>
      {GOAL_OPTIONS.map((opt) => {
        const on = goal === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[s.goalCard, on && s.goalCardOn]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[s.goalCardLabel, on && s.goalCardLabelOn]}>{opt.label}</Text>
            {opt.note && (
              <Text style={[s.goalCardNote, on && s.goalCardNoteOn]}>{opt.note}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Activity-level select ────────────────────────────────────────────────────
// Vertical cards (not a cramped 5-way segmented) so each tier can show its
// plain-language description. Drives profiles.activity_factor — the TDEE/BMR
// multiplier — so getting this right keeps a user's target off the BMR floor.
function ActivitySelect({ factor, onSelect }: { factor: number; onSelect: (f: number) => void }) {
  return (
    <View style={s.goalCards}>
      {ACTIVITY_OPTIONS.map((opt) => {
        const on = factor === opt.factor;
        return (
          <Pressable
            key={opt.factor}
            style={[s.goalCard, on && s.goalCardOn]}
            onPress={() => onSelect(opt.factor)}
          >
            <Text style={[s.goalCardLabel, on && s.goalCardLabelOn]}>{opt.label}</Text>
            <Text style={[s.goalCardNote, on && s.goalCardNoteOn]}>{opt.desc}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step 3: Stats + Goal ────────────────────────────────────────────────────

function GoalStep({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activityFactor, setActivityFactor] = useState(1.375);
  const [goal, setGoal] = useState<Goal>('maintain');
  const [dietPrefs, setDietPrefs] = useState<string[]>(['vegetarian']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    maintenanceKcal: number;
    dailyTargetKcal: number;
    bmi: number;
  } | null>(null);

  function toggleDiet(value: string) {
    setDietPrefs((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      }
      if (value === 'vegan') return ['vegan'];
      return [...prev.filter((v) => v !== 'vegan'), value];
    });
  }

  async function handleCalculate() {
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (!ageNum || ageNum < 10 || ageNum > 120) {
      Alert.alert('Please enter a valid age (10–120).');
      return;
    }
    if (!heightNum || heightNum < 100 || heightNum > 250) {
      Alert.alert('Please enter height in cm (100–250).');
      return;
    }
    if (!weightNum || weightNum < 20 || weightNum > 300) {
      Alert.alert('Please enter weight in kg (20–300).');
      return;
    }

    setLoading(true);
    try {
      const birthYear = new Date().getFullYear() - ageNum;
      const bmi = weightNum / Math.pow(heightNum / 100, 2);
      // Goal weight is optional and only relevant for directional goals; include
      // it only when the user typed a sane value.
      const goalWeightNum = parseFloat(goalWeight);
      const wantsTarget = goal === 'lose' || goal === 'gain' || goal === 'build_muscle';
      const targetPatch =
        wantsTarget && !Number.isNaN(goalWeightNum) && goalWeightNum >= 20 && goalWeightNum <= 300
          ? { target_weight_kg: Math.round(goalWeightNum * 10) / 10 }
          : {};
      const updated = await updateProfile({
        sex,
        birth_year: birthYear,
        height_cm: heightNum,
        weight_kg: weightNum,
        activity_factor: activityFactor,
        goal,
        diet_preference: dietPrefs.length > 0 ? dietPrefs.join(',') : 'vegetarian',
        ...targetPatch,
      });
      setResult({
        maintenanceKcal: updated.maintenance_kcal ?? 0,
        dailyTargetKcal: updated.daily_target_kcal ?? 0,
        bmi,
      });
    } catch {
      Alert.alert('Could not compute — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await updateProfile({ onboarded: true });
      onComplete();
    } catch {
      onComplete();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.flex} edges={['top', 'bottom']}>
      <View style={s.backHeader}>
        <Pressable onPress={() => { if (result) { setResult(null); } else { onBack(); } }} hitSlop={8} style={s.backBtn}>
          <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
        </Pressable>
      </View>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.goalScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.eyebrow}>Step 2 of 2 · Your stats</Text>
          <Text style={s.goalTitle}>Your daily target</Text>

          {result ? (
            <>
              <View style={s.maintCard}>
                <Text style={s.maintEyebrow}>Maintenance calories</Text>
                <Text style={s.maintN}>
                  {result.maintenanceKcal.toLocaleString()}{' '}
                  <Text style={s.maintUnit}>kcal/day</Text>
                </Text>
                <Text style={s.maintSub}>
                  What your body needs just to stay the same. This is your honest baseline —
                  everything from here is your choice, not a punishment.
                </Text>
              </View>

              <View style={s.bmiCard}>
                <Text style={s.bmiLine}>BMI {result.bmi.toFixed(1)} · {bmiBand(result.bmi)}</Text>
                <Text style={s.bmiNote}>BMI is a rough screening number, not a measure of health or worth — muscle, frame, and many other things affect it.</Text>
              </View>

              <Text style={s.fieldLabel}>How active are you?</Text>
              <ActivitySelect factor={activityFactor} onSelect={setActivityFactor} />

              <Text style={s.fieldLabel}>Your goal</Text>
              <GoalCards goal={goal} onSelect={setGoal} />

              <View style={s.targetRow}>
                <Text style={s.targetLabel}>Daily target</Text>
                <Text style={s.targetValue}>
                  {result.dailyTargetKcal.toLocaleString()} kcal
                </Text>
              </View>

              <Pressable style={s.primaryBtn} onPress={handleConfirm} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Looks good</Text>
                )}
              </Pressable>
              <Text style={s.footnote}>{'Calculated with Mifflin–St Jeor. Editable anytime.\n\nEstimates for general guidance, not medical advice. If you have kidney disease, are pregnant, or have a medical condition, consult a doctor.'}</Text>
            </>
          ) : (
            <>
              <Text style={s.fieldLabel}>Sex</Text>
              <Segmented
                options={SEX_OPTIONS.map((o) => o.label)}
                selected={SEX_OPTIONS.findIndex((o) => o.value === sex)}
                onSelect={(i) => setSex(SEX_OPTIONS[i].value)}
              />

              <Text style={s.fieldLabel}>Age</Text>
              <TextInput
                style={s.input}
                keyboardType="number-pad"
                placeholder="e.g. 28"
                placeholderTextColor={C.inkFaint}
                value={age}
                onChangeText={setAge}
                maxLength={3}
              />

              <Text style={s.fieldLabel}>Height (cm)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 170"
                placeholderTextColor={C.inkFaint}
                value={height}
                onChangeText={setHeight}
                maxLength={5}
              />

              <Text style={s.fieldLabel}>Weight (kg)</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 70"
                placeholderTextColor={C.inkFaint}
                value={weight}
                onChangeText={setWeight}
                maxLength={5}
              />

              <Text style={s.fieldLabel}>How active are you?</Text>
              <ActivitySelect factor={activityFactor} onSelect={setActivityFactor} />

              <Text style={s.fieldLabel}>Your goal</Text>
              <GoalCards goal={goal} onSelect={setGoal} />

              {goal === 'lose' || goal === 'gain' || goal === 'build_muscle' ? (
                <>
                  <Text style={s.fieldLabel}>Goal weight (kg) — optional</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 65"
                    placeholderTextColor={C.inkFaint}
                    value={goalWeight}
                    onChangeText={setGoalWeight}
                    maxLength={5}
                  />
                </>
              ) : null}

              <Text style={s.fieldLabel}>What do you eat?</Text>
              <DietMultiSelect selected={dietPrefs} onToggle={toggleDiet} />

              <Pressable style={s.primaryBtn} onPress={handleCalculate} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Calculate my target</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Segmented({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((opt, i) => (
        <Pressable
          key={opt}
          style={[s.segBtn, i === selected && s.segBtnOn]}
          onPress={() => onSelect(i)}
        >
          <Text style={[s.segBtnText, i === selected && s.segBtnTextOn]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Main Flow ───────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'country' | 'goal'>('country');
  const [country, setCountry] = useState<string>(() => {
    const locales = Localization.getLocales();
    return locales[0]?.regionCode ?? 'IN';
  });

  if (step === 'country') {
    return (
      <CountryStep
        selected={country}
        onSelect={setCountry}
        onContinue={() => setStep('goal')}
      />
    );
  }

  return <GoalStep onBack={() => setStep('country')} onComplete={onComplete} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },

  langScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  goalScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },

  obMark: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
    ...Shadow.md,
  },
  obHero: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 30,
    lineHeight: 34,
    color: C.ink,
    marginBottom: 10,
  },
  obSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.inkSoft,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },

  eyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkFaint,
    marginTop: Spacing.two,
    marginBottom: 2,
  },
  goalTitle: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 24,
    color: C.ink,
    marginBottom: Spacing.two,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: Spacing.two,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.ink,
  },

  groupLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.inkFaint,
    marginTop: Spacing.three,
    marginBottom: 6,
  },
  noMatch: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },

  list: { gap: 7 },
  searchHint: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    marginBottom: 2,
  },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadow.sm,
  },
  langRowSel: {
    backgroundColor: C.greenSoft,
  },
  langText: { gap: 2 },
  langName: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
  },
  langNameSel: { color: C.greenInk },
  langSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.line,
  },
  checkSel: {
    borderColor: C.green,
    backgroundColor: C.green,
  },

  maintCard: {
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    borderRadius: Radius.lg,
    padding: 18,
    marginVertical: Spacing.two,
    ...Shadow.md,
  },
  maintEyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: C.greenInk,
  },
  maintN: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 38,
    fontWeight: '700',
    color: C.ink,
    marginTop: 6,
  },
  maintUnit: {
    fontSize: 15,
    fontWeight: '400',
    color: C.inkFaint,
  },
  maintSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkSoft,
    marginTop: 8,
    lineHeight: 19,
  },

  fieldLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    marginTop: Spacing.three,
    marginBottom: 8,
  },

  input: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 16,
    color: C.ink,
    ...Shadow.sm,
  },

  seg: {
    flexDirection: 'row',
    gap: 7,
    flexWrap: 'wrap',
  },
  segBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: Radius.sm,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    minWidth: 60,
    ...Shadow.sm,
  },
  segBtnOn: {
    backgroundColor: C.green,
  },
  segBtnText: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 13,
    fontWeight: '500',
    color: C.inkSoft,
    textAlign: 'center',
  },
  segBtnTextOn: { color: '#fff' },

  goalCards: {
    gap: 8,
  },
  goalCard: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  goalCardOn: {
    backgroundColor: C.green,
  },
  goalCardLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  goalCardLabelOn: { color: '#fff' },
  goalCardNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkSoft,
    marginTop: 2,
  },
  goalCardNoteOn: { color: 'rgba(255,255,255,0.8)' },

  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: C.greenSoft,
    borderRadius: Radius.md,
  },
  targetLabel: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 15,
    fontWeight: '500',
    color: C.ink,
  },
  targetValue: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 19,
    fontWeight: '700',
    color: C.greenInk,
  },

  primaryBtn: {
    backgroundColor: C.green,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
    ...Shadow.md,
  },
  primaryBtnText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  footnote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    textAlign: 'center',
    marginTop: 8,
  },

  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bmiCard: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  bmiLine: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  bmiNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkSoft,
    marginTop: 6,
    lineHeight: 18,
  },

  dietGrid: { gap: 8 },
  dietChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  dietChipOn: { backgroundColor: C.greenSoft },
  dietChipText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  dietChipTextOn: { color: C.greenInk },
});
