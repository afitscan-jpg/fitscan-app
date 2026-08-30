import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { PaywallError } from '@/lib/api';
import { mealTypeForNow, type MealType } from '@/lib/db';
import {
  confirmLogItem,
  logTextFood,
  NeedsConfirmationError,
  type TextLogItem,
  type TextLogResponse,
} from '@/lib/text-log';

// Provenance → pill colours (matches the spec + v3 warm/sage palette).
type Pill = { bg: string; fg: string; border?: string };
const NEUTRAL_PILL: Pill = { bg: C.card, fg: C.inkSoft, border: C.cardBorder };
const PROV_PILL: Record<string, Pill> = {
  verified:          { bg: C.greenSoft, fg: C.greenInk },
  expert_verified:   { bg: C.greenSoft, fg: C.greenInk },
  composed:          { bg: C.waterBlueSoft, fg: C.waterBlueInk },
  verified_packaged: NEUTRAL_PILL,
  ai_estimate:       { bg: C.amberSoft, fg: C.amberInk },
  analog_estimate:   { bg: C.amberSoft, fg: C.amberInk },
};
function pillFor(provenance: string): Pill {
  return PROV_PILL[provenance] ?? NEUTRAL_PILL;
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── One resolved item row ────────────────────────────────────────────────────

/**
 * A HELD item: the portion was implausibly large, so the backend computed the
 * number but did NOT write it. It must never just vanish — we show what we
 * worked out, say plainly that it is not logged yet, and offer both ways out.
 * Framed as a question about the amount, never as the user getting it wrong.
 */
function HeldRow({
  item,
  meal,
  onLogged,
}: {
  item: TextLogItem;
  meal: MealType;
  onLogged: () => void;
}) {
  const [busy, setBusy]   = useState(false);
  const [done, setDone]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(item.clarification ?? '');
  const [editing, setEditing] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(item.qty));

  async function send(qty: number, confirmed: boolean) {
    if (!item.canonical_food_id || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmLogItem({
        canonicalFoodId: item.canonical_food_id,
        qty, unit: item.unit, meal, confirmed,
      });
      setDone(true);
      onLogged();
    } catch (e) {
      if (e instanceof NeedsConfirmationError) {
        // The corrected amount is still implausible — ask again with the new number.
        setPrompt(e.clarification);
        setEditing(false);
      } else {
        setError("Couldn't log that — please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={s.row}>
        <View style={s.rowTop}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.heldDone}>Logged</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.row, s.heldRow]}>
      <View style={s.rowTop}>
        <View style={s.rowLeft}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.qty}>{item.qty} {item.unit}</Text>
        </View>
        <Text style={s.heldTag}>not logged yet</Text>
      </View>

      <Text style={s.heldPrompt}>{prompt}</Text>

      {editing ? (
        <View style={s.heldEditRow}>
          <TextInput
            style={s.heldInput}
            value={qtyDraft}
            onChangeText={setQtyDraft}
            keyboardType="numeric"
            autoFocus
            accessibilityLabel={`Amount of ${item.name}`}
          />
          <Text style={s.heldUnit}>{item.unit}</Text>
          <Pressable
            style={s.heldBtn}
            disabled={busy}
            onPress={() => {
              const n = parseFloat(qtyDraft);
              if (!Number.isFinite(n) || n <= 0) { setError('Enter an amount above zero.'); return; }
              send(n, false);   // corrected amount is re-checked, not force-logged
            }}
          >
            <Text style={s.heldBtnText}>Save</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.heldActions}>
          <Pressable style={s.heldBtn} onPress={() => send(item.qty, true)} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.heldBtnText}>Yes, log it</Text>}
          </Pressable>
          <Pressable style={s.heldBtnGhost} onPress={() => setEditing(true)} disabled={busy}>
            <Text style={s.heldBtnGhostText}>Change amount</Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function ResultRow({ item }: { item: TextLogItem }) {
  const pill = pillFor(item.provenance);
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <View style={s.rowLeft}>
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.qty}>{item.qty} {item.unit}</Text>
        </View>
        {/* display_kcal is pre-formatted by the backend — render verbatim. */}
        <Text style={s.kcal}>{item.display_kcal}</Text>
      </View>

      <View style={s.metaRow}>
        <View style={[s.pill, { backgroundColor: pill.bg }, pill.border ? { borderWidth: 1, borderColor: pill.border } : null]}>
          <Text style={[s.pillText, { color: pill.fg }]}>{item.badge}</Text>
        </View>
        {item.needs_clarification ? (
          // Static state marker — this item needs clarification. Not tappable.
          <View style={s.verify}>
            <Text style={s.verifyText}>unverified</Text>
          </View>
        ) : null}
      </View>

      {item.modifier_note ? <Text style={s.modNote}>{item.modifier_note}</Text> : null}
    </View>
  );
}

// ─── The card: input + meal chips + resolved results ──────────────────────────

export function TextLogCard({
  onPaywall,
  onLogged,
  initialText,
  country,
}: {
  onPaywall: (e: PaywallError) => void;
  /** Called after a successful log so the caller can refresh the home ring. */
  onLogged?: () => void;
  /** Pre-filled text (e.g. the assistant's "Review & log" handoff) — auto-submitted once. */
  initialText?: string;
  /** Profile country, for the speech-recognition locale (IN → en-IN). */
  country?: string | null;
}) {
  const [text, setText] = useState(initialText ?? '');
  const [meal, setMeal] = useState<MealType>(() => mealTypeForNow());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TextLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const micPulse = useRef(new Animated.Value(1)).current;

  // ── Voice (same wiring the old /ai/parse box used) ──────────────────────────
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end',   () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    // Populate the text input; the user reviews and taps "Log this meal".
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setText(transcript);
      setError(null);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'aborted') {
      setError("Couldn't hear that — try again.");
    }
  });

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.abort(); };
  }, []);

  // Gentle pulse while listening.
  useEffect(() => {
    if (listening) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    micPulse.setValue(1);
  }, [listening, micPulse]);

  async function handleMicPress() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError('Mic permission needed for voice.');
      return;
    }
    setError(null);
    const lang = country === 'IN' ? 'en-IN' : 'en-US';
    ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false });
  }

  async function submit(override?: string) {
    const t = (override ?? text).trim();
    if (!t || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await logTextFood(t, meal);
      setResult(res);
    } catch (e) {
      if (e instanceof PaywallError) onPaywall(e);
      else setError("Couldn't log that — please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Reset to a fresh form — ONLY on the completed-log "Done" action. Never while
  // a log is in progress or if the user leaves without finishing: this screen is a
  // mounted tab, so an in-progress query or a typed-but-unlogged draft must survive
  // navigating away and back. Only tapping Done (which appears only after a
  // successful log) clears the input, result and total.
  function handleDone() {
    setText('');
    setResult(null);
    setError(null);
    setMeal(mealTypeForNow());
    onLogged?.();
  }

  // Auto-submit a handed-off prefill once (assistant "Review & log").
  const autoDone = useRef(false);
  useEffect(() => {
    const t = (initialText ?? '').trim();
    if (t && !autoDone.current) {
      autoDone.current = true;
      setText(t);
      submit(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  return (
    <View style={s.card}>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="e.g. 2 rotis and a katori of dal tadka"
          placeholderTextColor={C.inkFaint}
          value={text}
          onChangeText={(v) => { setText(v); setError(null); }}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => submit()}
          submitBehavior="blurAndSubmit"
          editable={!loading}
        />
        <Animated.View style={{ opacity: listening ? micPulse : 1 }}>
          <Pressable
            style={[s.micBtn, listening && s.micBtnOn]}
            onPress={handleMicPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop voice input' : 'Log by voice'}
          >
            <Icon name="mic" color={listening ? '#fff' : C.inkFaint} size={18} strokeWidth={1.5} />
          </Pressable>
        </Animated.View>
      </View>

      <View style={s.mealRow}>
        {MEALS.map((m) => {
          const on = meal === m;
          return (
            <Pressable key={m} style={[s.mealChip, on && s.mealChipOn]} onPress={() => setMeal(m)} disabled={loading}>
              <Text style={[s.mealText, on && s.mealTextOn]}>{cap(m)}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <AnimatedPressable
        style={[s.submit, (loading || !text.trim()) && s.submitDim]}
        onPress={() => submit()}
        disabled={loading || !text.trim()}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitText}>Log this meal</Text>}
      </AnimatedPressable>

      {result ? (
        <View style={s.results}>
          {result.items.length === 0 ? (
            <Text style={s.emptyNote}>No foods recognised — try rephrasing.</Text>
          ) : (
            result.items.map((item, i) =>
              item.requires_confirmation ? (
                <HeldRow
                  key={`${item.name}-${i}`}
                  item={item}
                  meal={meal}
                  onLogged={() => onLogged?.()}
                />
              ) : (
                <ResultRow key={`${item.name}-${i}`} item={item} />
              ),
            )
          )}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{cap(result.meal)} total</Text>
            {/* total.display is pre-formatted — render verbatim. */}
            <Text style={s.totalValue}>{result.total.display}</Text>
          </View>

          {result.total.unverified_items > 0 ? (
            <Text style={s.unverified}>
              {result.total.unverified_items} item(s) couldn&apos;t be verified
            </Text>
          ) : null}

          <Text style={s.footer}>
            Every number shows how sure we are — verified, calculated, or estimated.
          </Text>

          {onLogged && result.items.some(
            (it) => it.kcal != null || it.requires_confirmation) ? (
            <AnimatedPressable style={s.done} onPress={handleDone}>
              <Text style={s.doneText}>Done — back to home</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    minHeight: 50,
    textAlignVertical: 'top',
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14.5,
    color: C.ink,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnOn: { backgroundColor: C.green },

  mealRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  mealChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#F1EEE8',
  },
  mealChipOn: { backgroundColor: C.green },
  mealText: { fontFamily: Fonts?.bodyMed ?? 'system', fontSize: 12.5, fontWeight: '500', color: C.inkSoft },
  mealTextOn: { color: '#fff' },

  error: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.red, marginTop: 10 },
  // Held item — amber (a question about the amount), never red (not an error).
  heldRow: {
    backgroundColor: C.amberSoft,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  heldTag: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600',
    color: C.amberInk,
  },
  heldPrompt: {
    fontFamily: Fonts?.body ?? 'system', fontSize: 13, lineHeight: 18,
    color: C.ink, marginTop: 6,
  },
  heldActions: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  heldEditRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  heldInput: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, color: C.ink,
    backgroundColor: C.card, borderRadius: Radius.sm, borderWidth: 1,
    borderColor: C.cardBorder, paddingHorizontal: 12, minWidth: 78, minHeight: 44,
  },
  heldUnit: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkSoft },
  heldBtn: {
    backgroundColor: C.accent, borderRadius: Radius.md,
    paddingHorizontal: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  heldBtnText: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: '#fff',
  },
  heldBtnGhost: {
    paddingHorizontal: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  heldBtnGhostText: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.amberInk,
  },
  heldDone: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600', color: C.greenInk,
  },

  submit: {
    backgroundColor: C.green,
    borderRadius: Radius.sm,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitDim: { opacity: 0.4 },
  submitText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14.5, fontWeight: '600', color: '#fff' },

  // Results
  results: { marginTop: 16, gap: 10 },
  emptyNote: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkFaint, textAlign: 'center', paddingVertical: 8 },

  row: {
    backgroundColor: '#FBF9F4',
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 8,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  rowLeft: { flex: 1, gap: 2 },
  name: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkStrong },
  qty: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },
  kcal: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'right',
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  verify: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 2 },
  verifyText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11.5,
    fontWeight: '600',
    color: C.inkFaint,
  },
  modNote: { fontFamily: Fonts?.body ?? 'system', fontSize: 11.5, color: C.inkFaint, lineHeight: 16 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    paddingTop: 12,
    marginTop: 2,
  },
  totalLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.ink },
  totalValue: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.inkStrong, fontVariant: ['tabular-nums'] },

  unverified: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },
  footer: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 2,
  },
  done: {
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    borderRadius: Radius.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  doneText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.greenInk },
});
