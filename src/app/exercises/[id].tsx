import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Easing as RNEasing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { ExerciseDemo } from '@/components/exercise-demo';
import { GlassCard } from '@/components/glass-card';
import { CIcon } from '@/components/CalibretaIcon';
import { Icon } from '@/components/Icon';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { C, Fonts, Gradients, Radius, Shadow } from '@/constants/theme';
import { getScienceNote } from '@/data/exercise-science';
import { logExercise, type Exercise } from '@/lib/exercises';
import { logSuccess } from '@/lib/feedback';

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Demo video (expo-video) ──────────────────────────────────────────────────

function DemoVideo({ url, onFail }: { url: string; onFail: () => void }) {
  const ref = useRef<VideoView>(null);
  const [ready, setReady] = useState(false);

  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') setReady(true);
      else if (status === 'error') onFail();
    });
    return () => sub.remove();
  }, [player, onFail]);

  // Play only while this screen is focused; pause on blur so only one video
  // ever plays at a time.
  useFocusEffect(
    useCallback(() => {
      player.play();
      return () => player.pause();
    }, [player]),
  );

  return (
    <View style={media.fill}>
      <VideoView
        ref={ref}
        player={player}
        style={media.fill}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Tap overlay → fullscreen */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => ref.current?.enterFullscreen()}
        accessibilityLabel="Play fullscreen"
      >
        <View style={media.fsHint}>
          <Icon name="scan" color="#fff" size={16} strokeWidth={2} />
        </View>
      </Pressable>
      {!ready ? (
        <SkeletonPulse style={[StyleSheet.absoluteFill, media.skeleton]}>
          <View />
        </SkeletonPulse>
      ) : null}
    </View>
  );
}

// Media priority: a real video (MP4) keeps the expo-video player; otherwise the
// image-based catalog (free-exercise-db) uses the looping start/end-frame demo,
// which also handles the single-image and no-image (placeholder) cases itself.
function MediaArea({ exercise }: { exercise: Exercise }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const hasVideo = !!exercise.video_url && !videoFailed;

  if (hasVideo) {
    return (
      <View style={media.card}>
        <DemoVideo url={exercise.video_url as string} onFail={() => setVideoFailed(true)} />
      </View>
    );
  }

  return (
    <ExerciseDemo
      frames={exercise.image_urls}
      thumbnail={exercise.thumbnail_url}
      height={240}
      radius={Radius.xl}
    />
  );
}

const media = StyleSheet.create({
  card: {
    height: 240,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#EDEAE2',
    borderWidth: 1,
    borderColor: C.cardBorder,
    ...Shadow.md,
  },
  fill: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  skeleton: { backgroundColor: C.line },
  fsHint: {
    position: 'absolute', right: 12, bottom: 12,
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Numeric field (stepper + typeable) ───────────────────────────────────────

function NumberField({
  label, value, onChange, step, min, max, decimal, unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
  decimal?: boolean;
  unit?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(value ? String(value) : ''); }, [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, decimal ? Math.round(n * 10) / 10 : Math.round(n)));

  function commit() {
    const parsed = decimal ? parseFloat(draft) : parseInt(draft, 10);
    if (Number.isNaN(parsed)) { setDraft(value ? String(value) : ''); return; }
    onChange(clamp(parsed));
  }

  return (
    <View style={nf.row}>
      <Text style={nf.label}>{label}{unit ? <Text style={nf.unit}>{`  (${unit})`}</Text> : null}</Text>
      <View style={nf.group}>
        <Pressable
          style={[nf.stepBtn, value <= min && nf.stepDim]}
          onPress={() => onChange(clamp(value - step))}
          disabled={value <= min}
          hitSlop={6}
        >
          <Text style={[nf.stepTxt, value <= min && nf.stepTxtDim]}>−</Text>
        </Pressable>
        <TextInput
          style={nf.input}
          value={draft}
          onChangeText={(t) => setDraft(decimal ? t.replace(/[^0-9.]/g, '') : t.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          placeholder="0"
          placeholderTextColor={C.inkFaint}
          maxLength={6}
          selectTextOnFocus
        />
        <Pressable
          style={[nf.stepBtn, value >= max && nf.stepDim]}
          onPress={() => onChange(clamp(value + step))}
          disabled={value >= max}
          hitSlop={6}
        >
          <Text style={[nf.stepTxt, value >= max && nf.stepTxtDim]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const nf = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14.5, fontWeight: '600', color: C.inkSoft },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, fontWeight: '400', color: C.inkFaint },
  group: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDim: { borderColor: C.line },
  stepTxt: { fontSize: 19, lineHeight: 22, color: C.green, fontWeight: '500' },
  stepTxtDim: { color: C.inkFaint },
  input: {
    minWidth: 64, textAlign: 'center',
    backgroundColor: 'rgba(76,124,99,0.08)', borderWidth: 1, borderColor: 'rgba(76,124,99,0.32)',
    borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: 8,
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 16, fontWeight: '600',
    color: C.greenInk, fontVariant: ['tabular-nums'],
  },
});

// ─── Science notes (evidence-based) ───────────────────────────────────────────

function ScienceNotes({ name }: { name: string }) {
  const note = getScienceNote(name);
  if (!note) return null;

  return (
    <GlassCard
      style={sci.wrap}
      contentStyle={sci.card}
      colors={Gradients.coach}
      borderColor="rgba(76,124,99,0.16)"
    >
      <View style={sci.head}>
        <Icon name="spark" color={C.greenInk} size={15} strokeWidth={2} />
        <Text style={sci.eyebrow}>Evidence-based</Text>
      </View>
      <Text style={sci.title}>Science notes</Text>

      <View style={sci.row}>
        <Text style={sci.label}>Primary activation</Text>
        <Text style={sci.body}>{note.primaryActivation}</Text>
      </View>

      <View style={sci.row}>
        <Text style={sci.label}>Biomechanics</Text>
        <Text style={sci.body}>{note.biomechanicsNote}</Text>
      </View>

      {note.metValue != null ? (
        <View style={sci.row}>
          <Text style={sci.label}>Intensity</Text>
          <Text style={sci.body}>{note.metValue} METs</Text>
        </View>
      ) : null}

      {note.tip ? (
        <View style={sci.tipRow}>
          <Icon name="spark" color={C.marigold} size={14} strokeWidth={2} />
          <Text style={sci.tip}>{note.tip}</Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const sci = StyleSheet.create({
  wrap: { marginTop: 26 },
  card: { padding: 18, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.6, textTransform: 'uppercase', color: C.greenInk,
  },
  title: {
    fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, color: C.ink,
    letterSpacing: -0.2, marginTop: -4,
  },
  row: { gap: 3 },
  label: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', color: C.inkFaint,
  },
  body: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkSoft, lineHeight: 21 },
  tipRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderTopWidth: 1, borderTopColor: C.hairline, paddingTop: 12,
  },
  tip: { flex: 1, fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.ink, lineHeight: 20 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ id: string; data?: string }>();

  const exercise = useMemo<Exercise | null>(() => {
    if (!params.data) return null;
    try { return JSON.parse(params.data) as Exercise; } catch { return null; }
  }, [params.data]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(false);

  if (!exercise) {
    return (
      <View style={s.root}>
        <AmbientBackground />
        <SafeAreaView style={s.flex} edges={['top']}>
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
              <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={s.centerFill}>
            <Text style={s.emptyTitle}>Exercise unavailable</Text>
            <Text style={s.emptySub}>Go back and open it from the list.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isCardio = exercise.exercise_type === 'cardio';
  const secondary = exercise.secondary_muscles ?? [];
  const steps = exercise.instructions ?? [];

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{exercise.name}</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <MediaArea exercise={exercise} />

          <Text style={s.name}>{exercise.name}</Text>

          {/* Chips */}
          <View style={s.chips}>
            <View style={[s.chip, s.chipAccent]}>
              <Text style={[s.chipText, s.chipAccentText]}>{cap(exercise.primary_muscle)}</Text>
            </View>
            {secondary.map((m) => (
              <View key={m} style={s.chip}>
                <Text style={s.chipText}>{cap(m)}</Text>
              </View>
            ))}
            {exercise.equipment ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{cap(exercise.equipment)}</Text>
              </View>
            ) : null}
            {exercise.difficulty ? (
              <View style={s.chip}>
                <Text style={s.chipText}>{cap(exercise.difficulty)}</Text>
              </View>
            ) : null}
            <View style={s.chip}>
              <Text style={s.chipText}>{cap(exercise.exercise_type)}</Text>
            </View>
          </View>

          {/* Instructions */}
          {steps.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>How to do it</Text>
              {steps.map((step, i) => (
                <View key={i} style={s.step}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Text style={s.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Evidence-based science notes — only for movements the research doc covers */}
          <ScienceNotes name={exercise.name} />
        </ScrollView>

        {/* Log CTA */}
        <View style={s.ctaBar}>
          <AnimatedPressable style={s.cta} onPress={() => setSheetOpen(true)}>
            <CIcon name="workout" color="#fff" size={18} />
            <Text style={s.ctaText}>Log this exercise</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>

      {/* Logging sheet */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <LogSheet
          exercise={exercise}
          isCardio={isCardio}
          onClose={() => setSheetOpen(false)}
          onLogged={() => {
            setSheetOpen(false);
            setToast(true);
          }}
        />
      </Modal>

      <Toast visible={toast} onDone={() => setToast(false)} />
    </View>
  );
}

// ─── Logging sheet ────────────────────────────────────────────────────────────

function LogSheet({
  exercise, isCardio, onClose, onLogged,
}: {
  exercise: Exercise;
  isCardio: boolean;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(0);
  const [duration, setDuration] = useState(20);
  const [distance, setDistance] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await logExercise({
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        ...(isCardio
          ? {
              duration_min: duration > 0 ? duration : null,
              distance_km: distance > 0 ? distance : null,
            }
          : {
              sets: sets > 0 ? sets : null,
              reps: reps > 0 ? reps : null,
              weight_kg: weight > 0 ? weight : null,
            }),
      });
      logSuccess();
      onLogged();
    } catch {
      setSaving(false);
      // Keep the sheet open so the user can retry.
    }
  }

  return (
    <Pressable style={ls.overlay} onPress={onClose}>
      <Pressable style={ls.sheet} onPress={() => undefined}>
        <View style={ls.handle} />
        <View style={ls.headerRow}>
          <Text style={ls.title} numberOfLines={1}>{exercise.name}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={ls.closeBtn}>
            <Text style={ls.closeTxt}>×</Text>
          </Pressable>
        </View>
        <Text style={ls.subtitle}>{isCardio ? 'Log your effort' : 'Log your set'}</Text>

        {isCardio ? (
          <>
            <NumberField label="Duration" unit="min" value={duration} onChange={setDuration} step={5} min={0} max={600} decimal />
            <NumberField label="Distance" unit="km" value={distance} onChange={setDistance} step={0.5} min={0} max={200} decimal />
          </>
        ) : (
          <>
            <NumberField label="Sets" value={sets} onChange={setSets} step={1} min={0} max={50} />
            <NumberField label="Reps" value={reps} onChange={setReps} step={1} min={0} max={100} />
            <NumberField label="Weight" unit="kg" value={weight} onChange={setWeight} step={2.5} min={0} max={500} decimal />
          </>
        )}

        <AnimatedPressable style={[ls.saveBtn, saving && ls.saveDim]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={ls.saveTxt}>Save</Text>}
        </AnimatedPressable>
      </Pressable>
    </Pressable>
  );
}

const ls = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkFaint },
  subtitle: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkSoft, marginTop: 2, marginBottom: 18 },
  saveBtn: {
    backgroundColor: C.green, borderRadius: Radius.md, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 6, ...Shadow.md,
  },
  saveDim: { opacity: 0.7 },
  saveTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
});

// ─── Toast ────────────────────────────────────────────────────────────────────

// EXERCISE log-success: the check draws on — circle stroke first, then the tick.
// Uses legacy RN Animated (strokeDashoffset via interpolate), NOT Reanimated
// useAnimatedProps — the latter does not update SVG props in release on this
// stack (Reanimated 4 + Fabric); CalorieRing's proven pattern is mirrored here.
// Delays are scaled down from 850/1250ms to fit the toast's ~1.6s life.
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);
const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const CHECK_CIRC = 2 * Math.PI * 10; // r=10
const CHECK_TICK = 19;               // ~length of the tick path

function AnimatedCheck() {
  const reduced = useReducedMotion();
  const circle = useRef(new RNAnimated.Value(reduced ? 1 : 0)).current;
  const tick = useRef(new RNAnimated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    RNAnimated.timing(circle, { toValue: 1, duration: 320, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }).start();
    RNAnimated.timing(tick, { toValue: 1, duration: 300, delay: 300, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: false }).start();
  }, [circle, tick, reduced]);
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <AnimatedCircle
        cx={12} cy={12} r={10} stroke="#fff" strokeWidth={2} fill="none"
        strokeDasharray={CHECK_CIRC}
        strokeDashoffset={circle.interpolate({ inputRange: [0, 1], outputRange: [CHECK_CIRC, 0] })}
      />
      <AnimatedPath
        d="M6 12.5 L10.5 17 L18 8" stroke="#fff" strokeWidth={2.6} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={CHECK_TICK}
        strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [CHECK_TICK, 0] })}
      />
    </Svg>
  );
}

function Toast({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const o = useSharedValue(0);
  const y = useSharedValue(20);

  useEffect(() => {
    if (!visible) return;
    o.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    y.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
    const t = setTimeout(() => {
      o.value = withTiming(0, { duration: 220 });
      y.value = withTiming(20, { duration: 220 });
      setTimeout(onDone, 240);
    }, 1600);
    return () => clearTimeout(t);
  }, [visible, o, y, onDone]);

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={ts.wrap}>
      <Reanimated.View style={[ts.toast, style]}>
        <AnimatedCheck />
        <Text style={ts.text}>Logged</Text>
      </Reanimated.View>
    </View>
  );
}

const ts = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.greenDeep, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    ...Shadow.lg,
  },
  text: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: '#fff' },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 6,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkSoft },

  scroll: { paddingHorizontal: 22, paddingBottom: 120 },

  name: {
    fontFamily: Fonts?.display ?? 'system', fontSize: 24, color: C.ink,
    letterSpacing: -0.4, marginTop: 18,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipAccent: { backgroundColor: C.greenSoft, borderColor: 'rgba(76,124,99,0.22)' },
  chipText: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 12.5, fontWeight: '500', color: C.inkSoft },
  chipAccentText: { color: C.greenInk, fontWeight: '600' },

  section: { marginTop: 26 },
  sectionTitle: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, color: C.ink, marginBottom: 14, letterSpacing: -0.2 },
  step: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: C.greenSoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '700', color: C.greenInk },
  stepText: { flex: 1, fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, color: C.inkSoft, lineHeight: 22 },

  ctaBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 22, paddingTop: 10, paddingBottom: 30,
    backgroundColor: 'transparent',
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: C.green, borderRadius: Radius.lg, height: 54, ...Shadow.md,
  },
  ctaText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15.5, fontWeight: '600', color: '#fff' },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 16, fontWeight: '600', color: C.ink },
  emptySub: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkFaint, textAlign: 'center' },
});
