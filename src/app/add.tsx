import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { authFetch } from '@/lib/api';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { getProfile, logFood, mealTypeForNow, type MealType, type Profile } from '@/lib/db';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// ─── Food definitions ────────────────────────────────────────────────────────

type FoodUnit = 'piece' | 'g' | 'ml';

type Food = {
  name: string;
  unit: FoodUnit;
  per: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  defaultAmount: number;
  meal_type: MealType;
};

const INTERNATIONAL_FOODS: Food[] = [
  { name: 'Egg',     unit: 'piece', per: { kcal: 78,  protein_g: 6,   carbs_g: 0.6, fat_g: 5   }, defaultAmount: 1,   meal_type: 'breakfast' },
  { name: 'Bread',   unit: 'piece', per: { kcal: 79,  protein_g: 2.7, carbs_g: 15,  fat_g: 1   }, defaultAmount: 1,   meal_type: 'breakfast' },
  { name: 'Rice',    unit: 'g',     per: { kcal: 130, protein_g: 2.7, carbs_g: 28,  fat_g: 0.3 }, defaultAmount: 150, meal_type: 'lunch' },
  { name: 'Oats',    unit: 'g',     per: { kcal: 70,  protein_g: 2.5, carbs_g: 12,  fat_g: 1.5 }, defaultAmount: 200, meal_type: 'breakfast' },
  { name: 'Chicken', unit: 'g',     per: { kcal: 165, protein_g: 31,  carbs_g: 0,   fat_g: 3.6 }, defaultAmount: 100, meal_type: 'lunch' },
  { name: 'Banana',  unit: 'piece', per: { kcal: 105, protein_g: 1.3, carbs_g: 27,  fat_g: 0.4 }, defaultAmount: 1,   meal_type: 'snack' },
  { name: 'Apple',   unit: 'piece', per: { kcal: 95,  protein_g: 0.5, carbs_g: 25,  fat_g: 0.3 }, defaultAmount: 1,   meal_type: 'snack' },
  { name: 'Milk',    unit: 'ml',    per: { kcal: 61,  protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 }, defaultAmount: 200, meal_type: 'breakfast' },
  { name: 'Coffee',  unit: 'ml',    per: { kcal: 2,   protein_g: 0.1, carbs_g: 0,   fat_g: 0   }, defaultAmount: 200, meal_type: 'snack' },
  { name: 'Yogurt',  unit: 'g',     per: { kcal: 59,  protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 }, defaultAmount: 150, meal_type: 'snack' },
];

const INDIAN_FOODS: Food[] = [
  { name: 'Roti',   unit: 'piece', per: { kcal: 100, protein_g: 3,   carbs_g: 18,  fat_g: 2   }, defaultAmount: 1,   meal_type: 'lunch' },
  { name: 'Dal',    unit: 'g',     per: { kcal: 120, protein_g: 6,   carbs_g: 14,  fat_g: 3   }, defaultAmount: 150, meal_type: 'lunch' },
  { name: 'Rice',   unit: 'g',     per: { kcal: 130, protein_g: 2.7, carbs_g: 28,  fat_g: 0.3 }, defaultAmount: 150, meal_type: 'lunch' },
  { name: 'Idli',   unit: 'piece', per: { kcal: 58,  protein_g: 2,   carbs_g: 12,  fat_g: 0.4 }, defaultAmount: 2,   meal_type: 'breakfast' },
  { name: 'Poha',   unit: 'g',     per: { kcal: 130, protein_g: 2.5, carbs_g: 25,  fat_g: 2.5 }, defaultAmount: 150, meal_type: 'breakfast' },
  { name: 'Curd',   unit: 'g',     per: { kcal: 60,  protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 }, defaultAmount: 150, meal_type: 'snack' },
  { name: 'Chai',   unit: 'ml',    per: { kcal: 50,  protein_g: 1.2, carbs_g: 6,   fat_g: 1.8 }, defaultAmount: 150, meal_type: 'snack' },
  { name: 'Dosa',   unit: 'piece', per: { kcal: 130, protein_g: 3,   carbs_g: 22,  fat_g: 3.5 }, defaultAmount: 1,   meal_type: 'breakfast' },
  { name: 'Paneer', unit: 'g',     per: { kcal: 265, protein_g: 18,  carbs_g: 1.2, fat_g: 21  }, defaultAmount: 50,  meal_type: 'lunch' },
  { name: 'Egg',    unit: 'piece', per: { kcal: 78,  protein_g: 6,   carbs_g: 0.6, fat_g: 5   }, defaultAmount: 1,   meal_type: 'breakfast' },
  { name: 'Banana', unit: 'piece', per: { kcal: 105, protein_g: 1.3, carbs_g: 27,  fat_g: 0.4 }, defaultAmount: 1,   meal_type: 'snack' },
  { name: 'Apple',  unit: 'piece', per: { kcal: 95,  protein_g: 0.5, carbs_g: 25,  fat_g: 0.3 }, defaultAmount: 1,   meal_type: 'snack' },
];

function getFoods(profile: Profile | null): Food[] {
  if (profile?.country === 'IN') return INDIAN_FOODS;
  return INTERNATIONAL_FOODS;
}

function computeNutrition(food: Food, amount: number) {
  const factor = food.unit === 'piece' ? amount : amount / 100;
  return {
    kcal:      food.per.kcal      * factor,
    protein_g: food.per.protein_g * factor,
    carbs_g:   food.per.carbs_g   * factor,
    fat_g:     food.per.fat_g     * factor,
  };
}

// ─── AI logger types ─────────────────────────────────────────────────────────

interface AiParseItem {
  name: string;
  amount: number;
  unit: FoodUnit;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface AiParseResponse {
  items: AiParseItem[];
  clarify: string | null;
  note: string | null;
  source: string;
}

interface AiItem {
  id: string;
  name: string;
  amount: number;
  unit: FoodUnit;
  per: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  edited: boolean;
}

function clampAiAmount(raw: number, unit: FoodUnit): number {
  if (Number.isNaN(raw)) return unit === 'piece' ? 1 : 100;
  if (unit === 'piece') return Math.max(1, Math.min(20, Math.round(raw * 2) / 2));
  return Math.max(1, Math.min(2000, Math.round(raw)));
}

interface AiSheet {
  items: AiItem[];
  clarify: string | null;
}

function computeAiNutr(item: AiItem) {
  const factor = item.unit === 'piece' ? item.amount : item.amount / 100;
  return {
    kcal:      item.per.kcal      * factor,
    protein_g: item.per.protein_g * factor,
    carbs_g:   item.per.carbs_g   * factor,
    fat_g:     item.per.fat_g     * factor,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddFoodScreen() {
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [selected,    setSelected]    = useState<Food | null>(null);
  const [amount,      setAmount]      = useState(1);
  const [logging,     setLogging]     = useState(false);

  const [aiText,      setAiText]      = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiStage,     setAiStage]     = useState<string | null>(null);
  const [aiInlineMsg, setAiInlineMsg] = useState<string | null>(null);
  const stageTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [aiSheet,     setAiSheet]     = useState<AiSheet | null>(null);
  const [aiLogging,    setAiLogging]    = useState(false);
  const [aiSuccess,    setAiSuccess]    = useState(false);
  const [micListening,  setMicListening]  = useState(false);
  const [showCamera,    setShowCamera]    = useState(false);
  const [cameraReady,   setCameraReady]   = useState(false);
  const micPulse  = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const params = useLocalSearchParams<{ prefill?: string }>();
  const prefillDone = useRef<string | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

  // The assistant hands food text here (`/add?prefill=...`) instead of logging it
  // itself, so it flows through the normal parse → editable confirm sheet → log
  // pipeline. Guarded by a ref so it fires once per distinct handoff.
  useEffect(() => {
    const text = typeof params.prefill === 'string' ? params.prefill.trim() : '';
    if (!text || prefillDone.current === text) return;
    prefillDone.current = text;
    setAiText(text);
    handleAiSubmit(text);
    // handleAiSubmit is a stable in-component function; the ref guard prevents re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.prefill]);

  useSpeechRecognitionEvent('start', () => setMicListening(true));
  useSpeechRecognitionEvent('end',   () => setMicListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setAiText(transcript);
      setAiInlineMsg(null);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setMicListening(false);
    if (event.error !== 'aborted') {
      setAiInlineMsg("Couldn't hear that — try again.");
    }
  });

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.abort(); };
  }, []);

  // Staged "the server is waking up" copy so a slow first response feels handled.
  function startStages() {
    stopStages();
    stageTimers.current = [
      setTimeout(() => setAiStage('Waking the server…'), 4000),
      setTimeout(() => setAiStage('Almost there…'), 12000),
    ];
  }
  function stopStages() {
    stageTimers.current.forEach(clearTimeout);
    stageTimers.current = [];
    setAiStage(null);
  }
  useEffect(() => () => { stageTimers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (micListening) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      micPulse.setValue(1);
    }
  }, [micListening, micPulse]);

  const foods = getFoods(profile);

  // ── Quick-add ──────────────────────────────────────────────────────────────

  function openStepper(food: Food) {
    setSelected(food);
    setAmount(food.defaultAmount);
  }

  function closeStepper() {
    if (logging) return;
    setSelected(null);
  }

  async function handleConfirmLog() {
    if (!selected || logging) return;
    setLogging(true);
    const nutr = computeNutrition(selected, amount);
    try {
      await logFood({
        name: selected.name,
        kcal: Math.round(nutr.kcal),
        protein_g: parseFloat(nutr.protein_g.toFixed(1)),
        carbs_g:   parseFloat(nutr.carbs_g.toFixed(1)),
        fat_g:     parseFloat(nutr.fat_g.toFixed(1)),
        meal_type: selected.meal_type,
        source: 'quick_add',
        verdict: 'good',
        quantity: amount,
        unit: selected.unit,
      });
      setSelected(null);
      router.back();
    } catch {
      Alert.alert('Could not log food. Please try again.');
    } finally {
      setLogging(false);
    }
  }

  // ── AI logger ──────────────────────────────────────────────────────────────

  function applyAiParseResponse(data: AiParseResponse) {
    if (!data.items || data.items.length === 0) {
      setAiInlineMsg(data.note ?? 'No foods found. Try rephrasing.');
    } else {
      const aiItems: AiItem[] = data.items.map((item, i) => {
        const factor = item.unit === 'piece' ? item.amount : item.amount / 100;
        const safe = factor > 0 ? factor : 1;
        return {
          id: `ai-${i}-${Date.now()}`,
          name: item.name,
          amount: item.amount > 0 ? item.amount : (item.unit === 'piece' ? 1 : 100),
          unit: item.unit,
          per: {
            kcal:      item.kcal      / safe,
            protein_g: item.protein_g / safe,
            carbs_g:   item.carbs_g   / safe,
            fat_g:     item.fat_g     / safe,
          },
          edited: false,
        };
      });
      setAiSheet({ items: aiItems, clarify: data.clarify ?? null });
    }
  }

  async function handleAiSubmit(textOverride?: string) {
    const text = (textOverride ?? aiText).trim();
    if (!text || aiLoading) return;
    setAiLoading(true);
    setAiInlineMsg(null);
    startStages();
    try {
      const res = await authFetch('/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          country: profile?.country ?? null,
          diet: profile?.diet_preference ?? null,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      applyAiParseResponse(await res.json());
    } catch {
      setAiInlineMsg("Couldn't reach the server — is the backend running?");
    } finally {
      stopStages();
      setAiLoading(false);
    }
  }

  function updateAiAmount(id: string, newAmount: number) {
    setAiSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, amount: newAmount, edited: true } : item
        ),
      };
    });
  }

  // Edit an item's kcal directly: scale its macros proportionally and rewrite
  // the per-unit values so the amount stepper keeps rescaling correctly.
  function updateAiKcal(id: string, newKcal: number) {
    setAiSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== id) return item;
          const clamped = Math.max(0, Math.min(3000, newKcal));
          const factor = item.unit === 'piece' ? item.amount : item.amount / 100;
          if (factor <= 0) return item;
          const currentKcal = item.per.kcal * factor;
          if (currentKcal <= 0) {
            return { ...item, edited: true, per: { ...item.per, kcal: clamped / factor } };
          }
          const ratio = clamped / currentKcal;
          return {
            ...item,
            edited: true,
            per: {
              kcal:      item.per.kcal      * ratio,
              protein_g: item.per.protein_g * ratio,
              carbs_g:   item.per.carbs_g   * ratio,
              fat_g:     item.per.fat_g     * ratio,
            },
          };
        }),
      };
    });
  }

  function removeAiItem(id: string) {
    setAiSheet((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== id) };
    });
  }

  async function handleLogAll() {
    if (!aiSheet || aiLogging || aiSheet.items.length === 0) return;
    setAiLogging(true);
    try {
      await Promise.all(
        aiSheet.items.map((item) => {
          const nutr = computeAiNutr(item);
          return logFood({
            name:      item.name,
            kcal:      Math.round(nutr.kcal),
            protein_g: parseFloat(nutr.protein_g.toFixed(1)),
            carbs_g:   parseFloat(nutr.carbs_g.toFixed(1)),
            fat_g:     parseFloat(nutr.fat_g.toFixed(1)),
            source:    'ai_estimate',
            meal_type: mealTypeForNow(),
            ai_raw_input: aiText.trim(),
          });
        })
      );
      // Brief success beat on the button before the sheet dismisses.
      setAiSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 400));
      setAiSheet(null);
      setAiText('');
      router.back();
    } catch {
      Alert.alert('Could not log food. Please try again.');
    } finally {
      setAiLogging(false);
      setAiSuccess(false);
    }
  }

  // ── Photo ─────────────────────────────────────────────────────────────────

  async function handleCameraPress() {
    if (aiLoading) return;
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        setAiInlineMsg('Camera permission needed for photo.');
        return;
      }
    }
    setAiInlineMsg(null);
    setCameraReady(false);
    setShowCamera(true);
  }

  async function handleShutter() {
    if (!cameraRef.current || !cameraReady || aiLoading) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.4 });
      setShowCamera(false);
      if (!photo?.base64) {
        setAiInlineMsg("Couldn't capture the photo — try again.");
        return;
      }
      setAiLoading(true);
      setAiInlineMsg(null);
      startStages();
      const res = await authFetch('/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: photo.base64,
          country: profile?.country ?? null,
          diet: profile?.diet_preference ?? null,
        }),
      });
      if (!res.ok) {
        console.warn('[AI photo] status', res.status, await res.text());
        throw new Error(`Server error ${res.status}`);
      }
      applyAiParseResponse(await res.json());
    } catch {
      setShowCamera(false);
      setAiInlineMsg("Couldn't reach the server — is the backend running?");
    } finally {
      stopStages();
      setAiLoading(false);
    }
  }

  // ── Voice ─────────────────────────────────────────────────────────────────

  async function handleMicPress() {
    if (micListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setAiInlineMsg('Mic permission needed for voice.');
      return;
    }
    setAiInlineMsg(null);
    const lang = profile?.country === 'IN' ? 'en-IN' : 'en-US';
    ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false });
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const liveNutr = selected ? computeNutrition(selected, amount) : null;
  const step     = selected?.unit === 'piece' ? 1  : 10;
  const minAmt   = selected?.unit === 'piece' ? 1  : 10;
  const maxAmt   = selected?.unit === 'piece' ? 20 : 1000;

  const logBtnLabel = selected
    ? selected.unit === 'piece'
      ? `Log ${amount} ${selected.name}`
      : `Log ${amount} ${selected.unit} ${selected.name}`
    : 'Log';

  const aiTotal = aiSheet?.items.reduce(
    (acc, item) => {
      const n = computeAiNutr(item);
      return {
        kcal:      acc.kcal      + n.kcal,
        protein_g: acc.protein_g + n.protein_g,
        carbs_g:   acc.carbs_g   + n.carbs_g,
        fat_g:     acc.fat_g     + n.fat_g,
      };
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  ) ?? null;

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
              <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
            </Pressable>
            <Text style={s.title}>What did you eat?</Text>
          </View>

          {/* AI logger */}
          <View style={s.aiBox}>
            <View style={s.aiHeader}>
              <Icon name="spark" color={C.marigold} size={16} strokeWidth={1.5} />
              <Text style={s.aiTitle}>Just tell me</Text>
            </View>
            <TextInput
              style={[s.aiInput, aiLoading && s.aiInputDim]}
              placeholder="2 roti, dal aur thoda rice"
              placeholderTextColor={C.inkFaint}
              value={aiText}
              onChangeText={(t) => { setAiText(t); setAiInlineMsg(null); }}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => handleAiSubmit()}
              submitBehavior="blurAndSubmit"
              editable={!aiLoading}
            />
            {aiInlineMsg != null ? (
              <Text style={s.aiNote}>{aiInlineMsg}</Text>
            ) : null}
            <View style={s.aiActions}>
              <View style={s.aiLeftBtns}>
                <Animated.View style={{ opacity: micListening ? micPulse : 1 }}>
                  <Pressable
                    style={[s.aiMicBtn, micListening && s.aiMicBtnOn]}
                    onPress={handleMicPress}
                    hitSlop={8}
                  >
                    <Icon name="mic" color={micListening ? '#fff' : C.inkFaint} size={18} strokeWidth={1.5} />
                  </Pressable>
                </Animated.View>
                <Pressable
                  style={s.aiCamBtn}
                  onPress={handleCameraPress}
                  hitSlop={8}
                  disabled={aiLoading}
                >
                  <Icon name="camera" color={C.inkFaint} size={18} strokeWidth={1.5} />
                </Pressable>
              </View>
              <AnimatedPressable
                style={[s.aiSend, (aiLoading || !aiText.trim()) && s.aiSendDim]}
                onPress={() => handleAiSubmit()}
                disabled={aiLoading || !aiText.trim()}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.aiSendText}>Analyse →</Text>
                )}
              </AnimatedPressable>
            </View>
            {aiLoading && aiStage != null ? (
              <Text style={s.aiStageText}>{aiStage}</Text>
            ) : null}
          </View>

          {/* Quick add */}
          <Text style={s.sectionLabel}>Quick add</Text>
          <View style={s.chips}>
            {foods.map((food) => (
              <QuickChip
                key={food.name}
                name={food.name}
                kcal={Math.round(computeNutrition(food, food.defaultAmount).kcal)}
                onPress={() => openStepper(food)}
              />
            ))}
          </View>

          {/* Workout entry point */}
          <Text style={s.sectionLabel}>Movement</Text>
          <AnimatedPressable style={s.workoutCard} onPress={() => router.push('/exercises' as never)}>
            <View style={s.workoutIcon}>
              <Icon name="dumbbell" color={C.greenInk} size={22} strokeWidth={1.9} />
            </View>
            <View style={s.workoutBody}>
              <Text style={s.workoutTitle}>Log a workout</Text>
              <Text style={s.workoutSub}>Browse exercises with demos & log sets</Text>
            </View>
            <Icon name="arrow" color={C.green} size={18} strokeWidth={2} />
          </AnimatedPressable>

          {/* Assistant entry point */}
          <Text style={s.sectionLabel}>Assistant</Text>
          <AnimatedPressable style={s.assistCard} onPress={() => router.push('/assistant' as never)}>
            <View style={s.assistIcon}>
              <Icon name="spark" color={C.marigold} size={18} strokeWidth={1.9} />
            </View>
            <Text style={s.assistText}>Ask FitScan</Text>
            <Icon name="arrow" color={C.marigold} size={17} strokeWidth={2} />
          </AnimatedPressable>
        </ScrollView>
      </SafeAreaView>

      {/* Quick-add stepper sheet */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={closeStepper}
      >
        <Pressable style={s.overlay} onPress={closeStepper}>
          <Pressable style={s.sheet} onPress={() => undefined}>
            <View style={s.sheetHandle} />

            <View style={s.sheetRow}>
              <View style={s.sheetDot} />
              <Text style={s.sheetName}>{selected?.name}</Text>
              <Pressable onPress={closeStepper} hitSlop={12} style={s.closeBtn}>
                <Text style={s.closeBtnText}>×</Text>
              </Pressable>
            </View>

            <Text style={s.sheetBase}>{selected?.meal_type}</Text>

            <View style={s.stepper}>
              <Pressable
                style={[s.stepBtn, amount <= minAmt && s.stepBtnDim]}
                onPress={() => setAmount((a) => Math.max(minAmt, a - step))}
                disabled={amount <= minAmt}
                hitSlop={8}
              >
                <Text style={[s.stepBtnText, amount <= minAmt && s.stepBtnTextDim]}>−</Text>
              </Pressable>

              <View style={s.stepQtyWrap}>
                <Text style={s.stepQty}>{amount}</Text>
                <Text style={s.stepUnit}>
                  {selected?.unit === 'piece'
                    ? `piece${amount !== 1 ? 's' : ''}`
                    : (selected?.unit ?? '')}
                </Text>
              </View>

              <Pressable
                style={[s.stepBtn, amount >= maxAmt && s.stepBtnDim]}
                onPress={() => setAmount((a) => Math.min(maxAmt, a + step))}
                disabled={amount >= maxAmt}
                hitSlop={8}
              >
                <Text style={[s.stepBtnText, amount >= maxAmt && s.stepBtnTextDim]}>+</Text>
              </Pressable>
            </View>

            {liveNutr && (
              <View style={s.liveRow}>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{Math.round(liveNutr.kcal)}</Text>
                  <Text style={s.liveKey}>kcal</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{liveNutr.protein_g.toFixed(1)}</Text>
                  <Text style={s.liveKey}>protein</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{liveNutr.carbs_g.toFixed(1)}</Text>
                  <Text style={s.liveKey}>carbs</Text>
                </View>
                <View style={s.liveStat}>
                  <Text style={s.liveVal}>{liveNutr.fat_g.toFixed(1)}</Text>
                  <Text style={s.liveKey}>fat</Text>
                </View>
              </View>
            )}

            <AnimatedPressable
              style={[s.logBtn, logging && s.logBtnLoading]}
              onPress={handleConfirmLog}
              disabled={logging}
            >
              {logging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.logBtnText}>{logBtnLabel}</Text>
              )}
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Camera modal */}
      <Modal
        visible={showCamera}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setShowCamera(false);
              setAiInlineMsg("Couldn't start the camera.");
            }}
          />
          <SafeAreaView style={s.camTopBar} edges={['top']}>
            <Pressable style={s.camClose} onPress={() => setShowCamera(false)} hitSlop={12}>
              <Text style={s.camCloseText}>×</Text>
            </Pressable>
          </SafeAreaView>
          <SafeAreaView style={s.camBottomBar} edges={['bottom']}>
            <Pressable
              style={[s.camShutter, (!cameraReady || aiLoading) && s.camShutterDim]}
              onPress={handleShutter}
              disabled={!cameraReady || aiLoading}
              hitSlop={8}
            >
              {aiLoading ? <ActivityIndicator color="#fff" size="large" /> : null}
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      {/* AI confirm sheet */}
      <Modal
        visible={aiSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!aiLogging) setAiSheet(null); }}
      >
        <Pressable style={s.overlay} onPress={() => { if (!aiLogging) setAiSheet(null); }}>
          <Pressable style={s.aiSheetOuter} onPress={() => undefined}>
            <View style={s.sheetHandle} />

            <View style={s.sheetRow}>
              <Text style={s.sheetName}>Ready to log</Text>
              <Pressable
                onPress={() => { if (!aiLogging) setAiSheet(null); }}
                hitSlop={12}
                style={s.closeBtn}
              >
                <Text style={s.closeBtnText}>×</Text>
              </Pressable>
            </View>
            <Text style={s.aiSubtitle}>Check what I found — edit anything before logging.</Text>

            <ScrollView
              style={s.aiSheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {aiSheet?.clarify != null ? (
                <Text style={s.aiClarify}>{aiSheet.clarify}</Text>
              ) : null}

              {(aiSheet?.items.length ?? 0) > 0 ? (
                <Text style={s.editHint}>
                  Tap any number to change it — amounts and calories are editable.
                </Text>
              ) : null}

              {aiSheet?.items.map((item) => (
                <AiConfirmItem
                  key={item.id}
                  item={item}
                  onAmount={updateAiAmount}
                  onKcal={updateAiKcal}
                  onRemove={removeAiItem}
                />
              ))}

              {aiSheet?.items.length === 0 ? (
                <Text style={s.aiClarify}>No items left — close and try again.</Text>
              ) : null}

              {aiTotal != null && (aiSheet?.items.length ?? 0) > 0 ? (
                <>
                  <Text style={s.aiTotalEyebrow}>Total</Text>
                  <View style={s.liveRow}>
                    <View style={s.liveStat}>
                      <Text style={s.liveVal}>{Math.round(aiTotal.kcal)}</Text>
                      <Text style={s.liveKey}>kcal</Text>
                    </View>
                    <View style={s.liveStat}>
                      <Text style={s.liveVal}>{aiTotal.protein_g.toFixed(1)}</Text>
                      <Text style={s.liveKey}>protein</Text>
                    </View>
                    <View style={s.liveStat}>
                      <Text style={s.liveVal}>{aiTotal.carbs_g.toFixed(1)}</Text>
                      <Text style={s.liveKey}>carbs</Text>
                    </View>
                    <View style={s.liveStat}>
                      <Text style={s.liveVal}>{aiTotal.fat_g.toFixed(1)}</Text>
                      <Text style={s.liveKey}>fat</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>

            <AnimatedPressable
              style={[
                s.aiLogBtn,
                ((aiLogging && !aiSuccess) || (aiSheet?.items.length ?? 0) === 0) && s.logBtnLoading,
              ]}
              onPress={handleLogAll}
              disabled={aiLogging || (aiSheet?.items.length ?? 0) === 0}
            >
              {aiSuccess ? (
                <View style={s.aiLoggedRow}>
                  <Icon name="check" color="#fff" size={16} strokeWidth={2.6} />
                  <Text style={s.logBtnText}>Logged</Text>
                </View>
              ) : aiLogging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.logBtnText}>Log all</Text>
              )}
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function QuickChip({
  name,
  kcal,
  onPress,
}: {
  name: string;
  kcal: number;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable style={s.chip} onPress={onPress}>
      <View style={s.chipDot} />
      <Text style={s.chipName}>{name}</Text>
      <Text style={s.chipKcal}>{kcal} kcal</Text>
    </AnimatedPressable>
  );
}

// Every item row exposes its amount and kcal as ALWAYS-VISIBLE numeric inputs
// (not tap-to-reveal chips), with ± buttons flanking the amount. Values are held
// in local draft strings and committed on blur / submit so macros rescale then.
function AiConfirmItem({
  item,
  onAmount,
  onKcal,
  onRemove,
}: {
  item: AiItem;
  onAmount: (id: string, amount: number) => void;
  onKcal: (id: string, kcal: number) => void;
  onRemove: (id: string) => void;
}) {
  const nutr          = computeAiNutr(item);
  const displayedKcal = Math.round(nutr.kcal);

  const isPiece  = item.unit === 'piece';
  const itemStep = isPiece ? 1  : 10;
  const itemMin  = isPiece ? 1  : 10;
  const itemMax  = isPiece ? 20 : 2000;
  const unitLabel = isPiece ? (item.amount === 1 ? 'piece' : 'pieces') : item.unit;

  const [amtDraft, setAmtDraft]   = useState(String(item.amount));
  const [kcalDraft, setKcalDraft] = useState(String(displayedKcal));

  // Keep drafts in sync when the values change from outside (± buttons, or a
  // kcal edit rescaling the amount and vice-versa).
  useEffect(() => { setAmtDraft(String(item.amount)); }, [item.amount]);
  useEffect(() => { setKcalDraft(String(displayedKcal)); }, [displayedKcal]);

  function commitAmt() {
    const parsed = isPiece ? parseFloat(amtDraft) : parseInt(amtDraft, 10);
    if (Number.isNaN(parsed)) { setAmtDraft(String(item.amount)); return; }
    onAmount(item.id, clampAiAmount(parsed, item.unit));
  }
  function commitKcal() {
    const parsed = parseInt(kcalDraft, 10);
    if (Number.isNaN(parsed)) { setKcalDraft(String(displayedKcal)); return; }
    onKcal(item.id, parsed);
  }

  return (
    <View style={s.aiItemCard}>
      <View style={s.aiItemTop}>
        <Text style={s.aiItemName}>{item.name}</Text>
        <Pressable onPress={() => onRemove(item.id)} hitSlop={10} style={s.aiItemRemoveBtn}>
          <Text style={s.aiItemRemoveText}>×</Text>
        </Pressable>
      </View>

      <View style={s.aiControlsRow}>
        {/* Amount:  −  [ 150 ]  +  g */}
        <View style={s.aiAmtGroup}>
          <Pressable
            style={[s.aiStepBtn, item.amount <= itemMin && s.stepBtnDim]}
            onPress={() => onAmount(item.id, Math.max(itemMin, item.amount - itemStep))}
            disabled={item.amount <= itemMin}
            hitSlop={8}
          >
            <Text style={[s.aiStepBtnText, item.amount <= itemMin && s.stepBtnTextDim]}>−</Text>
          </Pressable>

          <TextInput
            style={s.numInput}
            value={amtDraft}
            onChangeText={(t) => setAmtDraft(isPiece ? t.replace(/[^0-9.]/g, '') : t.replace(/[^0-9]/g, ''))}
            onBlur={commitAmt}
            onSubmitEditing={commitAmt}
            keyboardType={isPiece ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            maxLength={6}
            selectTextOnFocus
          />

          <Pressable
            style={[s.aiStepBtn, item.amount >= itemMax && s.stepBtnDim]}
            onPress={() => onAmount(item.id, Math.min(itemMax, item.amount + itemStep))}
            disabled={item.amount >= itemMax}
            hitSlop={8}
          >
            <Text style={[s.aiStepBtnText, item.amount >= itemMax && s.stepBtnTextDim]}>+</Text>
          </Pressable>

          <Text style={s.unitLabel}>{unitLabel}</Text>
        </View>

        {/* kcal:  [ 389 ]  kcal */}
        <View style={s.aiKcalGroup}>
          <TextInput
            style={s.numInput}
            value={kcalDraft}
            onChangeText={(t) => setKcalDraft(t.replace(/[^0-9]/g, ''))}
            onBlur={commitKcal}
            onSubmitEditing={commitKcal}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={5}
            selectTextOnFocus
          />
          <Text style={s.unitLabel}>kcal</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 60,
    gap: Spacing.two,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.two,
    marginBottom: 4,
    gap: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 22,
    color: C.ink,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: Spacing.two,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.ink,
  },

  // ── AI box ─────────────────────────────────────────────────────────────────
  aiBox: {
    backgroundColor: '#FCF7EF',
    borderWidth: 1,
    borderColor: 'rgba(185,132,56,0.2)',
    borderRadius: Radius.lg,
    padding: 16,
    marginTop: Spacing.two,
    gap: 0,
    ...Shadow.md,
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiTitle: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: C.inkStrong,
  },
  aiInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(74,58,34,0.12)',
    borderRadius: 12,
    padding: 12,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14,
    color: C.ink,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  aiNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkFaint,
    marginTop: 8,
    lineHeight: 18,
  },
  aiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  aiMicBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMicBtnOn: { backgroundColor: C.green },
  aiSend: {
    backgroundColor: C.green,
    borderRadius: Radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  aiSendDim: { opacity: 0.4 },
  aiSendText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  sectionLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkFaint,
    marginTop: Spacing.three,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minWidth: 80,
    ...Shadow.sm,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  chipName: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 14,
    fontWeight: '500',
    color: C.ink,
  },
  chipKcal: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
  },

  // ── Workout entry point ──────────────────────────────────────────────────────
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...Shadow.sm,
  },
  workoutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutBody: { flex: 1, gap: 2 },
  workoutTitle: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  workoutSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkFaint,
  },

  // ── Assistant entry point (slim) ─────────────────────────────────────────────
  assistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FCF7EF',
    borderWidth: 1,
    borderColor: 'rgba(185,132,56,0.2)',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Shadow.sm,
  },
  assistIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: C.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistText: {
    flex: 1,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14.5,
    fontWeight: '600',
    color: C.ink,
  },

  // ── Shared sheet chrome ────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.green,
  },
  sheetName: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 22,
    color: C.ink,
    flex: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 22,
    color: C.inkFaint,
    lineHeight: 26,
  },
  sheetBase: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkSoft,
    textTransform: 'capitalize',
    marginTop: 4,
    marginBottom: 24,
  },

  // ── Stepper (quick-add) ────────────────────────────────────────────────────
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDim: { borderColor: C.line },
  stepBtnText: {
    fontSize: 22,
    lineHeight: 26,
    color: C.green,
    fontWeight: '500',
  },
  stepBtnTextDim: { color: C.inkFaint },
  stepQtyWrap: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepQty: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 40,
    color: C.ink,
    lineHeight: 44,
  },
  stepUnit: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    marginTop: 2,
  },

  liveRow: {
    flexDirection: 'row',
    backgroundColor: C.greenSoft,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginBottom: 16,
  },
  liveStat: {
    flex: 1,
    alignItems: 'center',
  },
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

  logBtn: {
    backgroundColor: C.green,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  logBtnLoading: { opacity: 0.7 },
  logBtnText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // ── AI confirm sheet ───────────────────────────────────────────────────────
  aiSheetOuter: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  aiSheetScroll: {
    // NOTE: must be flexShrink (basis auto), NOT flex:1. The sheet has a
    // maxHeight but no fixed height, so flex:1 (basis 0) collapses this
    // ScrollView to zero height and hides every item row inside it.
    flexShrink: 1,
    marginTop: 12,
    marginBottom: 12,
  },
  aiSubtitle: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    lineHeight: 19,
    marginTop: 4,
  },
  aiClarify: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    lineHeight: 20,
    marginBottom: 12,
  },
  aiKcalEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 44,
    paddingLeft: 8,
  },
  aiKcalValue: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.green,
    fontVariant: ['tabular-nums'],
  },
  aiKcalUnit: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkFaint,
    marginRight: 2,
  },
  aiKcalInput: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    minWidth: 52,
    textAlign: 'right',
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: C.green,
    fontVariant: ['tabular-nums'],
  },
  aiItemCard: {
    backgroundColor: '#F7F4EE',
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.lg,
    padding: 13,
    marginBottom: 12,
    gap: 10,
  },
  aiItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiItemName: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    flex: 1,
  },
  aiItemRemoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiItemRemoveText: {
    fontSize: 17,
    lineHeight: 19,
    color: C.inkFaint,
  },
  aiItemHint: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 11.5,
    color: C.inkFaint,
    marginTop: -2,
  },

  // Explicit "tap any number" instruction above the item list
  editHint: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 12.5,
    fontWeight: '600',
    color: C.green,
    lineHeight: 18,
    marginBottom: 6,
  },

  // Always-visible amount + kcal inputs
  aiControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  aiAmtGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiKcalGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numInput: {
    minWidth: 50,
    textAlign: 'center',
    backgroundColor: 'rgba(76,124,99,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.32)',
    borderRadius: Radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 8,
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.greenInk,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkSoft,
  },
  aiTotalEyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkFaint,
    marginBottom: 6,
  },
  aiLogBtn: {
    backgroundColor: C.green,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  pressed85: { opacity: 0.85 },
  aiLoggedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiInputDim: { opacity: 0.5 },
  aiStageText: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkFaint,
    marginTop: 10,
  },
  aiItemStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiItemStepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStepBtnText: {
    fontSize: 18,
    lineHeight: 22,
    color: C.green,
    fontWeight: '500',
  },
  aiStepQtyWrap: {
    alignItems: 'center',
    minWidth: 60,
  },
  aiStepQty: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 22,
    color: C.ink,
    lineHeight: 26,
  },
  aiItemKcal: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.inkSoft,
  },

  // ── AI actions row ─────────────────────────────────────────────────────────
  aiLeftBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiCamBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Camera modal ───────────────────────────────────────────────────────────
  camTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  camClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camCloseText: {
    fontSize: 26,
    color: '#fff',
    lineHeight: 30,
  },
  camBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 44,
  },
  camShutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camShutterDim: { opacity: 0.45 },
});
