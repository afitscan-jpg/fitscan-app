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

const LANGUAGES = [
  { code: 'en', name: 'English', sub: 'Default · used everywhere', group: 'Suggested' },
  { code: 'hinglish', name: 'Hinglish', sub: 'Roman Hindi', group: 'Suggested' },
  { code: 'hi', name: 'हिन्दी', sub: 'Hindi', group: 'Indian languages' },
  { code: 'bn', name: 'বাংলা', sub: 'Bengali', group: 'Indian languages' },
  { code: 'ta', name: 'தமிழ்', sub: 'Tamil', group: 'Indian languages' },
  { code: 'te', name: 'తెలుగు', sub: 'Telugu', group: 'Indian languages' },
  { code: 'kn', name: 'ಕನ್ನಡ', sub: 'Kannada', group: 'Indian languages' },
  { code: 'mr', name: 'मराठी', sub: 'Marathi', group: 'Indian languages' },
  { code: 'gu', name: 'ગુજરાતી', sub: 'Gujarati', group: 'Indian languages' },
  { code: 'ml', name: 'മലയാളം', sub: 'Malayalam', group: 'Indian languages' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', sub: 'Punjabi', group: 'Indian languages' },
  { code: 'es', name: 'Español', sub: 'Spanish', group: 'Worldwide' },
  { code: 'pt', name: 'Português', sub: 'Portuguese', group: 'Worldwide' },
  { code: 'fr', name: 'Français', sub: 'French', group: 'Worldwide' },
  { code: 'de', name: 'Deutsch', sub: 'German', group: 'Worldwide' },
  { code: 'ar', name: 'العربية', sub: 'Arabic', group: 'Worldwide' },
  { code: 'id', name: 'Bahasa Indonesia', sub: 'Indonesian', group: 'Worldwide' },
  { code: 'zh', name: '中文', sub: 'Chinese', group: 'Worldwide' },
  { code: 'ja', name: '日本語', sub: 'Japanese', group: 'Worldwide' },
  { code: 'ko', name: '한국어', sub: 'Korean', group: 'Worldwide' },
];

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

const LANG_DEFAULT_CODES = ['en', 'hinglish', 'hi', 'bn', 'ta'];
const COUNTRY_DEFAULT_CODES = ['IN', 'US', 'GB', 'AU', 'CA', 'SG'];

const ACTIVITY_OPTIONS: Array<{ label: string; factor: number }> = [
  { label: 'Not very active', factor: 1.2 },
  { label: 'Lightly active',  factor: 1.375 },
  { label: 'Active',          factor: 1.55 },
  { label: 'Very active',     factor: 1.725 },
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

// ─── Step 1: Language ────────────────────────────────────────────────────────

function LanguageStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: string;
  onSelect: (code: string) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const visibleItems = searching
    ? LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.sub.toLowerCase().includes(query.toLowerCase()),
      )
    : (() => {
        const defaults = LANG_DEFAULT_CODES
          .map((c) => LANGUAGES.find((l) => l.code === c))
          .filter((l): l is (typeof LANGUAGES)[0] => Boolean(l));
        if (!LANG_DEFAULT_CODES.includes(selected)) {
          const sel = LANGUAGES.find((l) => l.code === selected);
          if (sel) return [sel, ...defaults];
        }
        return defaults;
      })();

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
        <Text style={s.obHero}>{'Understand\nyour food.'}</Text>
        <Text style={s.obSub}>
          Scan a packet or log your meals. We keep it honest — and keep you motivated, not guilty.
        </Text>

        <Text style={s.eyebrow}>Step 1 of 3 · Language</Text>

        <View style={s.searchBox}>
          <Icon name="search" color={C.inkFaint} size={16} strokeWidth={1.8} />
          <TextInput
            style={s.searchInput}
            placeholder="Search 20+ languages"
            placeholderTextColor={C.inkFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        {!searching && <Text style={s.searchHint}>Suggested · search for more</Text>}

        <View style={s.list}>
          {visibleItems.map((l) => (
            <SelectRow
              key={l.code}
              code={l.code}
              name={l.name}
              sub={l.sub}
              selected={selected === l.code}
              onSelect={onSelect}
            />
          ))}
        </View>

        {searching && visibleItems.length === 0 && (
          <Text style={s.noMatch}>No match — your language is on the way.</Text>
        )}

        <Pressable style={s.primaryBtn} onPress={onContinue}>
          <Text style={s.primaryBtnText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step 2: Country ─────────────────────────────────────────────────────────

function CountryStep({
  selected,
  onSelect,
  onBack,
  onContinue,
}: {
  selected: string;
  onSelect: (code: string) => void;
  onBack: () => void;
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
      <View style={s.backHeader}>
        <Pressable onPress={onBack} hitSlop={8} style={s.backBtn}>
          <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.langScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.eyebrow}>Step 2 of 3 · Country</Text>
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

// ─── Step 3: Stats + Goal ────────────────────────────────────────────────────

function GoalStep({
  language,
  onBack,
  onComplete,
}: {
  language: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
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
      const updated = await updateProfile({
        language,
        sex,
        birth_year: birthYear,
        height_cm: heightNum,
        weight_kg: weightNum,
        activity_factor: activityFactor,
        goal,
        diet_preference: dietPrefs.length > 0 ? dietPrefs.join(',') : 'vegetarian',
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
          <Text style={s.eyebrow}>Step 3 of 3 · Your stats</Text>
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
              <Segmented
                options={ACTIVITY_OPTIONS.map((o) => o.label)}
                selected={ACTIVITY_OPTIONS.findIndex((o) => o.factor === activityFactor)}
                onSelect={(i) => setActivityFactor(ACTIVITY_OPTIONS[i].factor)}
              />

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
              <Segmented
                options={ACTIVITY_OPTIONS.map((o) => o.label)}
                selected={ACTIVITY_OPTIONS.findIndex((o) => o.factor === activityFactor)}
                onSelect={(i) => setActivityFactor(ACTIVITY_OPTIONS[i].factor)}
              />

              <Text style={s.fieldLabel}>Your goal</Text>
              <GoalCards goal={goal} onSelect={setGoal} />

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
  const [step, setStep] = useState<'language' | 'country' | 'goal'>('language');
  const [language, setLanguage] = useState('en');
  const [country, setCountry] = useState<string>(() => {
    const locales = Localization.getLocales();
    return locales[0]?.regionCode ?? 'IN';
  });

  if (step === 'language') {
    return (
      <LanguageStep
        selected={language}
        onSelect={setLanguage}
        onContinue={() => setStep('country')}
      />
    );
  }

  if (step === 'country') {
    return (
      <CountryStep
        selected={country}
        onSelect={setCountry}
        onBack={() => setStep('language')}
        onContinue={() => setStep('goal')}
      />
    );
  }

  return <GoalStep language={language} onBack={() => setStep('country')} onComplete={onComplete} />;
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
