import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { PaywallSheet } from '@/components/paywall-sheet';
import { PaywallError } from '@/lib/api';
import { CIcon } from '@/components/CalibretaIcon';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';

// Mount fade-in-up wrapper (useAnimatedStyle, not `entering` — release-fragile on
// this stack; see motion notes). Plays once per message row mount.
function EnterDown({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { v.value = 1; return; }
    v.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [v, reduced]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: 12 * (1 - v.value) }] }));
  return <Reanimated.View style={[style, a]}>{children}</Reanimated.View>;
}
import {
  askAssistant,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  type AssistantAction,
  type ChatTurn,
} from '@/lib/assistant';
import { logExercise } from '@/lib/exercises';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AssistantAction | null;
  /** true for the calm inline "couldn't reach" bubble */
  error?: boolean;
}

const STARTERS = [
  'How much protein today?',
  'What should I eat tonight?',
  'Log 2 roti and dal',
  'Did 3 sets of 10 pushups',
];

let seq = 0;
const nextId = () => `m${++seq}-${Date.now()}`;

// ─── Typing indicator ────────────────────────────────────────────────────────

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [o, delay]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Reanimated.View style={[ty.dot, a]} />;
}

function TypingBubble() {
  return (
    <View style={[b.row, b.rowLeft]}>
      <View style={[b.bubble, b.assistant, ty.wrap]}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  );
}

const ty = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.inkFaint },
});

// ─── Action confirm cards ────────────────────────────────────────────────────

function FoodConfirmCard({ text, done, onConfirm }: {
  text: string; done: boolean; onConfirm: () => void;
}) {
  return (
    <View style={cc.card}>
      <Text style={cc.title}>Log this?</Text>
      <Text style={cc.body}>{text}</Text>
      {done ? (
        <View style={cc.doneRow}>
          <Icon name="check" color={C.greenInk} size={14} strokeWidth={2.6} />
          <Text style={cc.doneText}>Opened in Log</Text>
        </View>
      ) : (
        <AnimatedPressable style={cc.btn} onPress={onConfirm}>
          <Text style={cc.btnText}>Review &amp; log</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

function ExerciseConfirmCard({ action, done, onConfirm }: {
  action: Extract<AssistantAction, { type: 'log_exercise' }>;
  done: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const { name, sets, reps, weight_kg } = action.payload;

  const detail = [
    sets != null ? `${sets} sets` : null,
    reps != null ? `${reps} reps` : null,
    weight_kg != null ? `${weight_kg} kg` : null,
  ].filter(Boolean).join(' · ');

  async function handle() {
    if (saving || done) return;
    setSaving(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={cc.card}>
      <Text style={cc.title}>Log this workout?</Text>
      <Text style={cc.body}>{name}</Text>
      {detail ? <Text style={cc.meta}>{detail}</Text> : null}
      {done ? (
        <View style={cc.doneRow}>
          <Icon name="check" color={C.greenInk} size={14} strokeWidth={2.6} />
          <Text style={cc.doneText}>Logged</Text>
        </View>
      ) : (
        <>
          <AnimatedPressable style={[cc.btn, saving && cc.btnDim]} onPress={handle} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={cc.btnText}>Confirm</Text>}
          </AnimatedPressable>
          {failed ? <Text style={cc.failText}>Couldn&apos;t log that — tap to retry.</Text> : null}
        </>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    borderRadius: Radius.lg,
    padding: 13,
    gap: 4,
    ...Shadow.sm,
  },
  title: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkFaint,
  },
  body: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  meta: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },
  btn: {
    marginTop: 8, backgroundColor: C.green, borderRadius: Radius.sm,
    height: 42, alignItems: 'center', justifyContent: 'center',
  },
  btnDim: { opacity: 0.7 },
  btnText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: '#fff' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  doneText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: C.greenInk },
  failText: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.red, marginTop: 6 },
});

// ─── Bubbles ─────────────────────────────────────────────────────────────────

const b = StyleSheet.create({
  row: { marginBottom: 12, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  col: { maxWidth: '86%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  user: {
    backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: 'rgba(76,124,99,0.22)',
    borderBottomRightRadius: 6,
  },
  assistant: {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.cardBorder,
    borderBottomLeftRadius: 6,
    ...Shadow.sm,
  },
  userText: { fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, lineHeight: 21, color: C.greenInk },
  assistText: { fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, lineHeight: 21, color: C.ink },
  errorText: { color: C.inkSoft },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [paywall, setPaywall] = useState<PaywallError | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const send = useCallback(async (raw: string) => {
    const message = raw.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!message || loading) return;

    // Prior turns only — the backend appends `message` as the final user turn.
    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }))
      .slice(-MAX_HISTORY_TURNS);

    setInput('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: message }]);
    setLoading(true);

    try {
      const res = await askAssistant(message, history);
      setMessages((prev) => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: res.reply || "I didn't catch that — could you rephrase?",
        action: res.action,
      }]);
    } catch (e) {
      if (e instanceof PaywallError) {
        setPaywall(e);
      } else {
        setMessages((prev) => [...prev, {
          id: nextId(),
          role: 'assistant',
          content: "Couldn't reach the assistant — try again.",
          error: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  // log_food → hand the text to the Log screen, which runs the existing
  // parse → editable confirm sheet → logFood pipeline. No logging logic here.
  function confirmFood(msgId: string, text: string) {
    setConfirmed((c) => ({ ...c, [msgId]: true }));
    router.push({ pathname: '/add', params: { prefill: text } } as never);
  }

  // log_exercise → reuse logExercise() from the exercises lib.
  async function confirmExercise(
    msgId: string,
    action: Extract<AssistantAction, { type: 'log_exercise' }>,
  ) {
    await logExercise({
      exercise_name: action.payload.name,
      sets: action.payload.sets,
      reps: action.payload.reps,
      weight_kg: action.payload.weight_kg,
    });
    setConfirmed((c) => ({ ...c, [msgId]: true }));
  }

  const canSend = input.trim().length > 0 && !loading;
  const isEmpty = messages.length === 0;

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.title}>Ask Calibreta</Text>
            <Text style={s.subtitle}>Your logs · not medical advice</Text>
          </View>
          <View style={s.backBtn} />
        </View>

        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={s.flex}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isEmpty ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <CIcon name="aiAssistant" color={C.marigold} size={22} />
                </View>
                <Text style={s.emptyTitle}>Ask about your day</Text>
                <Text style={s.emptySub}>
                  I can read your logged food and workouts, and help you log more.
                </Text>
              </View>
            ) : null}

            {messages.map((m) => {
              const mine = m.role === 'user';
              const action = m.action ?? null;
              return (
                <EnterDown
                  key={m.id}
                  style={[b.row, mine ? b.rowRight : b.rowLeft]}
                >
                  <View style={b.col}>
                    <View style={[b.bubble, mine ? b.user : b.assistant]}>
                      <Text style={[mine ? b.userText : b.assistText, m.error && b.errorText]}>
                        {m.content}
                      </Text>
                    </View>

                    {action?.type === 'log_food' ? (
                      <FoodConfirmCard
                        text={action.payload.text}
                        done={!!confirmed[m.id]}
                        onConfirm={() => confirmFood(m.id, action.payload.text)}
                      />
                    ) : null}

                    {action?.type === 'log_exercise' ? (
                      <ExerciseConfirmCard
                        action={action}
                        done={!!confirmed[m.id]}
                        onConfirm={() => confirmExercise(m.id, action)}
                      />
                    ) : null}
                  </View>
                </EnterDown>
              );
            })}

            {loading ? <TypingBubble /> : null}
          </ScrollView>

          {/* Starter chips */}
          {isEmpty ? (
            <View style={s.starters}>
              {STARTERS.map((sug) => (
                <AnimatedPressable key={sug} style={s.starterChip} onPress={() => send(sug)}>
                  <Text style={s.starterText}>{sug}</Text>
                </AnimatedPressable>
              ))}
            </View>
          ) : null}

          {/* Input bar */}
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              placeholder="Ask about your day…"
              placeholderTextColor={C.inkFaint}
              value={input}
              onChangeText={setInput}
              maxLength={MAX_MESSAGE_CHARS}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => send(input)}
              submitBehavior="blurAndSubmit"
              editable={!loading}
            />
            <AnimatedPressable
              style={[s.sendBtn, !canSend && s.sendDim]}
              onPress={() => send(input)}
              disabled={!canSend}
              accessibilityLabel="Send"
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Icon name="arrow" color="#fff" size={18} strokeWidth={2.2} />}
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <PaywallSheet error={paywall} onClose={() => setPaywall(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  title: { fontFamily: Fonts?.display ?? 'system', fontSize: 19, color: C.ink, letterSpacing: -0.3 },
  subtitle: { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkFaint, marginTop: 1 },

  scroll: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, flexGrow: 1 },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 20, gap: 8 },
  emptyIcon: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: C.amberSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, color: C.ink },
  emptySub: {
    fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkFaint,
    textAlign: 'center', lineHeight: 20,
  },

  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  starterChip: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, ...Shadow.sm,
  },
  starterText: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 12.5, fontWeight: '500', color: C.inkSoft },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18,
  },
  input: {
    flex: 1, maxHeight: 110,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: 20, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 11,
    fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, color: C.ink,
    ...Shadow.sm,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },
  sendDim: { opacity: 0.4 },
});
