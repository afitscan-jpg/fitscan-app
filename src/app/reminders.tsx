import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import {
  formatTime12,
  getPermissionStatus,
  getReminderMeta,
  getReminderSettings,
  requestRemindersPermission,
  resumeReminderType,
  stepTime,
  updateReminderSettings,
  type ReminderMeta,
  type ReminderSettings,
  type ReminderType,
} from '@/lib/reminders';

// Notifications.NotificationPermissionsStatus without importing the module here.
type Perm = { status: string; canAskAgain: boolean };

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ── Small controls ──────────────────────────────────────────────────────────────

function TimeStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => onChange(stepTime(value, -15))} hitSlop={6}>
        <Text style={s.stepBtnText}>−</Text>
      </Pressable>
      <Text style={s.stepVal}>{formatTime12(value)}</Text>
      <Pressable style={s.stepBtn} onPress={() => onChange(stepTime(value, 15))} hitSlop={6}>
        <Text style={s.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function DayPicker({ days, onToggle }: { days: number[]; onToggle: (d: number) => void }) {
  return (
    <View style={s.dayRow}>
      {WEEKDAYS.map((label, i) => {
        const on = days.includes(i);
        return (
          <Pressable
            key={i}
            onPress={() => onToggle(i)}
            style={[s.dayChip, on && s.dayChipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.dayChipText, on && s.dayChipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  title, sub, value, onValueChange,
}: { title: string; sub: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleText}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: C.line, true: C.green }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RemindersScreen() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [meta, setMeta] = useState<ReminderMeta | null>(null);
  const [perm, setPerm] = useState<Perm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [st, mt, p] = await Promise.all([
        getReminderSettings(), getReminderMeta(), getPermissionStatus(),
      ]);
      setSettings(st); setMeta(mt); setPerm(p);
      // First visit with an undetermined permission → ask, with the explanation
      // (the intro line + cards) already on screen behind the OS prompt.
      if (p.status === 'undetermined' && !mt.permissionRequested) {
        await requestRemindersPermission();
        setPerm(await getPermissionStatus());
        setMeta(await getReminderMeta());
      }
      setLoading(false);
    })();
  }, []);

  const granted = perm?.status === 'granted';

  async function ensurePermitted(): Promise<boolean> {
    const cur = await getPermissionStatus();
    if (cur.status === 'granted') { setPerm(cur); return true; }
    const status = await requestRemindersPermission();
    setPerm(await getPermissionStatus());
    setMeta(await getReminderMeta());
    return status === 'granted';
  }

  async function setEnabled(type: ReminderType, value: boolean) {
    if (!settings) return;
    if (value) {
      const ok = await ensurePermitted();
      if (!ok) return; // permission banner will guide them; leave the toggle off
      if (meta?.paused[type]) setMeta(await resumeReminderType(type));
    }
    const patch: Partial<ReminderSettings> =
      type === 'meals' ? { meals: { ...settings.meals, enabled: value } }
      : type === 'weighIn' ? { weighIn: { ...settings.weighIn, enabled: value } }
      : { weeklyInsight: { enabled: value } };
    setSettings(await updateReminderSettings(patch));
  }

  async function patchMeals(p: Partial<ReminderSettings['meals']>) {
    if (!settings) return;
    setSettings(await updateReminderSettings({ meals: { ...settings.meals, ...p } }));
  }
  async function patchWeigh(p: Partial<ReminderSettings['weighIn']>) {
    if (!settings) return;
    setSettings(await updateReminderSettings({ weighIn: { ...settings.weighIn, ...p } }));
  }
  function toggleWeighDay(d: number) {
    if (!settings) return;
    const days = settings.weighIn.days.includes(d)
      ? settings.weighIn.days.filter((x) => x !== d)
      : [...settings.weighIn.days, d].sort((a, b) => a - b);
    void patchWeigh({ days });
  }

  // A type is "on" only when enabled AND not auto-paused.
  const mealsOn  = !!settings?.meals.enabled && !meta?.paused.meals;
  const weighOn  = !!settings?.weighIn.enabled && !meta?.paused.weighIn;
  const weeklyOn = !!settings?.weeklyInsight.enabled && !meta?.paused.weeklyInsight;

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Reminders</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loading || !settings ? (
            <View style={s.loadingBox}><ActivityIndicator color={C.green} /></View>
          ) : (
            <>
              <Text style={s.intro}>
                Gentle nudges at the moments you might log — never about what you missed. Turn any off anytime.
              </Text>

              {/* Permission state */}
              {perm && perm.status !== 'granted' ? (
                <View style={s.permCard}>
                  <Text style={s.permText}>
                    {perm.canAskAgain
                      ? 'Turn on notifications to receive reminders.'
                      : 'Reminders are turned off in your system settings.'}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [s.permBtn, pressed && s.pressed]}
                    onPress={perm.canAskAgain ? ensurePermitted : () => Linking.openSettings()}
                  >
                    <Text style={s.permBtnText}>{perm.canAskAgain ? 'Turn on reminders' : 'Open settings'}</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Meals */}
              <View style={s.card}>
                <ToggleRow
                  title="Meal reminders"
                  sub="A nudge at lunch and dinner — skipped when you’ve already logged."
                  value={mealsOn}
                  onValueChange={(v) => setEnabled('meals', v)}
                />
                {meta?.paused.meals ? <Text style={s.pausedNote}>Paused — turn back on anytime.</Text> : null}
                {mealsOn ? (
                  <>
                    <View style={s.divider} />
                    <View style={s.timeRow}>
                      <Text style={s.timeLabel}>Lunch</Text>
                      <TimeStepper value={settings.meals.lunch} onChange={(v) => patchMeals({ lunch: v })} />
                    </View>
                    <View style={s.timeRow}>
                      <Text style={s.timeLabel}>Dinner</Text>
                      <TimeStepper value={settings.meals.dinner} onChange={(v) => patchMeals({ dinner: v })} />
                    </View>
                  </>
                ) : null}
              </View>

              {/* Weigh-in */}
              <View style={s.card}>
                <ToggleRow
                  title="Weigh-in reminder"
                  sub="On the days you choose — trends beat single days."
                  value={weighOn}
                  onValueChange={(v) => setEnabled('weighIn', v)}
                />
                {meta?.paused.weighIn ? <Text style={s.pausedNote}>Paused — turn back on anytime.</Text> : null}
                {weighOn ? (
                  <>
                    <View style={s.divider} />
                    <Text style={s.timeLabel}>Days</Text>
                    <DayPicker days={settings.weighIn.days} onToggle={toggleWeighDay} />
                    <View style={s.timeRow}>
                      <Text style={s.timeLabel}>Time</Text>
                      <TimeStepper value={settings.weighIn.time} onChange={(v) => patchWeigh({ time: v })} />
                    </View>
                  </>
                ) : null}
              </View>

              {/* Weekly insight */}
              <View style={s.card}>
                <ToggleRow
                  title="Weekly review"
                  sub="Sunday evening, only when you’ve logged 4+ days that week."
                  value={weeklyOn}
                  onValueChange={(v) => setEnabled('weeklyInsight', v)}
                />
                {meta?.paused.weeklyInsight ? <Text style={s.pausedNote}>Paused — turn back on anytime.</Text> : null}
              </View>

              <Text style={s.footnote}>
                Ignore a reminder a few times and we quietly pause it — no nagging.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 100, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, textAlign: 'center',
    fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3,
  },

  loadingBox: { paddingTop: 80, alignItems: 'center' },

  intro: {
    fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkSoft,
    lineHeight: 19, marginTop: 2, marginBottom: 2,
  },

  permCard: {
    backgroundColor: C.amberSoft,
    borderWidth: 1, borderColor: 'rgba(185,132,56,0.25)',
    borderRadius: Radius.md, padding: 14, gap: 10,
  },
  permText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: C.amberInk, lineHeight: 19 },
  permBtn: {
    alignSelf: 'flex-start', backgroundColor: C.green,
    borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 9,
  },
  permBtnText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: '#fff' },

  card: { backgroundColor: C.card, borderRadius: Radius.xl, padding: 16, ...Shadow.sm },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleText: { flex: 1, gap: 3 },
  toggleTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  toggleSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, lineHeight: 17 },

  pausedNote: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft, marginTop: 10 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 14 },

  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  timeLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.inkSoft },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, lineHeight: 24, color: C.green, fontWeight: '500' },
  stepVal: {
    minWidth: 84, textAlign: 'center',
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink,
    fontVariant: ['tabular-nums'],
  },

  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 6 },
  dayChip: {
    flex: 1, aspectRatio: 1, maxWidth: 42, borderRadius: 999,
    backgroundColor: '#F1EEE8', alignItems: 'center', justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: C.green },
  dayChipText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.inkSoft },
  dayChipTextOn: { color: '#fff' },

  pressed: { opacity: 0.85 },
  footnote: {
    fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkSoft,
    textAlign: 'center', lineHeight: 18, marginTop: 6,
  },
});
