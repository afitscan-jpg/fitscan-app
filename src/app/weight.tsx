import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
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
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { GlassCard } from '@/components/glass-card';
import { Icon } from '@/components/Icon';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  deleteWeight,
  getWeightLogs,
  logWeight,
  setTargetWeight,
  type WeightLog,
  type WeightPeriod,
} from '@/lib/weight';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const PERIODS: { key: WeightPeriod; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

// ─── Line chart (react-native-svg, warm/sage) ─────────────────────────────────

const CHART_H = 190;
const PAD_T = 20;
const PAD_B = 26;
const PAD_L = 12;
const PAD_R = 14;
const GRAD_ID = 'weightArea';

function WeightChart({ logs, target }: { logs: WeightLog[]; target: number | null }) {
  const [width, setWidth] = useState(0);

  const geom = useMemo(() => {
    if (width <= 0 || logs.length === 0) return null;
    const innerW = width - PAD_L - PAD_R;
    const innerH = CHART_H - PAD_T - PAD_B;

    const values = logs.map((l) => l.weight_kg);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
    if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; } // avoid flat/zero span
    const pad = (hi - lo) * 0.15;
    lo -= pad; hi += pad;

    const n = logs.length;
    const x = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * innerH;

    const pts = logs.map((l, i) => ({ x: x(i), y: y(l.weight_kg), v: l.weight_kg, date: l.log_date }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const baseY = PAD_T + innerH;
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;
    const targetY = target != null ? y(target) : null;

    return { pts, line, area, targetY, hi, lo };
  }, [width, logs, target]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={ch.wrap}>
      {geom ? (
        <Svg width={width} height={CHART_H}>
          <Defs>
            <SvgLinearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={C.accent} stopOpacity={0.02} />
            </SvgLinearGradient>
          </Defs>

          {/* Dashed goal line */}
          {geom.targetY != null ? (
            <>
              <Line
                x1={PAD_L}
                y1={geom.targetY}
                x2={width - PAD_R}
                y2={geom.targetY}
                stroke={C.amber}
                strokeWidth={1.5}
                strokeDasharray="5 5"
              />
              <SvgText
                x={width - PAD_R}
                y={geom.targetY - 6}
                fill={C.amberInk}
                fontSize={10}
                fontWeight="600"
                textAnchor="end"
              >
                {`Target ${fmt1(target as number)}`}
              </SvgText>
            </>
          ) : null}

          {/* Area + line */}
          <Path d={geom.area} fill={`url(#${GRAD_ID})`} />
          <Path d={geom.line} stroke={C.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points (last one emphasized) */}
          {geom.pts.map((p, i) => {
            const last = i === geom.pts.length - 1;
            return (
              <Circle
                key={p.date}
                cx={p.x}
                cy={p.y}
                r={last ? 5 : 3}
                fill={last ? C.accent : C.card}
                stroke={C.accent}
                strokeWidth={last ? 2 : 1.5}
              />
            );
          })}

          {/* Range weight labels (min/max) */}
          <SvgText x={PAD_L} y={PAD_T - 7} fill={C.inkFaint} fontSize={9.5}>{fmt1(geom.hi)}</SvgText>
          <SvgText x={PAD_L} y={CHART_H - 10} fill={C.inkFaint} fontSize={9.5}>{fmt1(geom.lo)}</SvgText>

          {/* First / last date labels */}
          <SvgText x={geom.pts[0].x} y={CHART_H - 2} fill={C.inkFaint} fontSize={9.5} textAnchor="start">
            {shortDate(geom.pts[0].date)}
          </SvgText>
          {geom.pts.length > 1 ? (
            <SvgText x={geom.pts[geom.pts.length - 1].x} y={CHART_H - 2} fill={C.inkFaint} fontSize={9.5} textAnchor="end">
              {shortDate(geom.pts[geom.pts.length - 1].date)}
            </SvgText>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: CHART_H }} />
      )}
    </View>
  );
}

const ch = StyleSheet.create({
  wrap: { width: '100%' },
});

// ─── Log-weight sheet ─────────────────────────────────────────────────────────

function LogWeightSheet({ current, onClose, onSaved }: {
  current: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState(current != null ? fmt1(current) : '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 500) {
      Alert.alert('Enter a valid weight in kilograms.');
      return;
    }
    setSaving(true);
    try {
      await logWeight(Math.round(parsed * 10) / 10, { note: note.trim() || undefined });
      onSaved();
    } catch {
      setSaving(false);
      Alert.alert('Could not save your weigh-in. Please try again.');
    }
  }

  return (
    <Pressable style={sh.overlay} onPress={onClose}>
      <Pressable style={sh.sheet} onPress={() => undefined}>
        <View style={sh.handle} />
        <View style={sh.headerRow}>
          <Text style={sh.title}>Log weight</Text>
          <Pressable onPress={onClose} hitSlop={12} style={sh.closeBtn}>
            <Text style={sh.closeTxt}>×</Text>
          </Pressable>
        </View>

        <Text style={sh.hint}>Today · {longDate(todayStr())}</Text>

        <View style={sh.weightRow}>
          <TextInput
            style={sh.weightInput}
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={C.inkDim}
            returnKeyType="done"
            maxLength={6}
            selectTextOnFocus
            autoFocus
          />
          <Text style={sh.unit}>kg</Text>
        </View>

        <TextInput
          style={sh.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={C.inkDim}
          maxLength={120}
          returnKeyType="done"
        />

        <Pressable style={[sh.saveBtn, saving && sh.saveDim]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveTxt}>Save weigh-in</Text>}
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeightScreen() {
  const [period, setPeriod] = useState<WeightPeriod>('month');
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);

  const load = useCallback(async (p: WeightPeriod, showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const res = await getWeightLogs(p);
      setLogs(res.logs);
      setTarget(res.target_weight_kg);
    } catch {
      // keep any existing data; a transient failure shouldn't blank the screen
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus (also refreshes after a log) and whenever the period changes.
  useFocusEffect(useCallback(() => { load(period, true); }, [load, period]));

  function changePeriod(p: WeightPeriod) {
    if (p === period) return;
    setPeriod(p);
    load(p);
  }

  function handleDelete(entry: WeightLog) {
    Alert.alert('Remove this weigh-in?', `${fmt1(entry.weight_kg)} kg · ${longDate(entry.log_date)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWeight(entry.id);
            await load(period);
          } catch {
            Alert.alert('Could not delete — please try again.');
          }
        },
      },
    ]);
  }

  // logs are oldest-first; current = latest, list shows newest-first.
  const current = logs.length > 0 ? logs[logs.length - 1].weight_kg : null;
  const first = logs.length > 0 ? logs[0].weight_kg : null;
  const delta = current != null && first != null ? current - first : 0;
  const newestFirst = useMemo(() => [...logs].reverse(), [logs]);
  const hasData = logs.length > 0;

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle}>Weight</Text>
          <AnimatedPressable onPress={() => setSheetOpen(true)} style={s.addBtn} pressedScale={0.9} accessibilityLabel="Log weight">
            <Icon name="plus" color="#fff" size={20} strokeWidth={2.4} />
          </AnimatedPressable>
        </View>

        <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* Current + Target cards */}
              <View style={s.cardsRow}>
                <View style={s.statCardWrap}>
                  <GlassCard contentStyle={s.statCard}>
                    <Text style={s.statLabel}>Current</Text>
                    {current != null ? (
                      <Text style={s.statValue}>{fmt1(current)}<Text style={s.statUnit}> kg</Text></Text>
                    ) : (
                      <Text style={s.statDash}>—</Text>
                    )}
                    {hasData && Math.abs(delta) >= 0.1 ? (
                      <Text style={s.statTrend}>
                        {delta < 0 ? '↓' : '↑'} {fmt1(Math.abs(delta))} kg this {period === 'all' ? 'range' : period}
                      </Text>
                    ) : (
                      <Text style={s.statTrendMuted}>No change yet</Text>
                    )}
                  </GlassCard>
                </View>

                <AnimatedPressable
                  style={s.statCardWrap}
                  onPress={() => setTargetSheetOpen(true)}
                  accessibilityLabel="Set goal weight"
                >
                  <GlassCard contentStyle={s.statCard}>
                    <Text style={s.statLabel}>Target</Text>
                    {target != null ? (
                      <Text style={s.statValue}>{fmt1(target)}<Text style={s.statUnit}> kg</Text></Text>
                    ) : (
                      <Text style={s.statDash}>—</Text>
                    )}
                    {target != null && current != null ? (
                      <Text style={s.statTrendMuted}>
                        {Math.abs(current - target) < 0.1
                          ? 'At your goal'
                          : `${fmt1(Math.abs(current - target))} kg to go`}
                      </Text>
                    ) : (
                      <Text style={s.statLink}>{target == null ? 'Tap to set' : 'Tap to edit'}</Text>
                    )}
                  </GlassCard>
                </AnimatedPressable>
              </View>

              {/* Period tabs */}
              <View style={s.tabs}>
                {PERIODS.map((p) => {
                  const active = p.key === period;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => changePeriod(p.key)}
                      style={[s.tab, active && s.tabActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[s.tabText, active && s.tabTextActive]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Chart */}
              {hasData ? (
                <GlassCard contentStyle={s.chartCard}>
                  <WeightChart logs={logs} target={target} />
                </GlassCard>
              ) : (
                <GlassCard contentStyle={s.emptyCard}>
                  <View style={s.emptyGlyph}>
                    <Icon name="spark" color={C.accent} size={22} strokeWidth={2} />
                  </View>
                  <Text style={s.emptyTitle}>Log your first weigh-in</Text>
                  <Text style={s.emptyBody}>Tap the + button to record your weight and start seeing your trend here.</Text>
                  <AnimatedPressable onPress={() => setSheetOpen(true)} style={s.emptyBtn} pressedScale={0.96}>
                    <Text style={s.emptyBtnText}>Log weight</Text>
                  </AnimatedPressable>
                </GlassCard>
              )}

              {/* Progress photos — natural pairing with weight */}
              <AnimatedPressable style={s.photoCard} onPress={() => router.push('/progress-photos' as never)}>
                <View style={s.photoIcon}>
                  <Icon name="camera" color={C.greenInk} size={20} strokeWidth={1.9} />
                </View>
                <View style={s.photoText}>
                  <Text style={s.photoTitle}>Progress Photos</Text>
                  <Text style={s.photoSub}>See your change in the mirror — private, on-device.</Text>
                </View>
                <Icon name="arrow" color={C.green} size={18} strokeWidth={2} />
              </AnimatedPressable>

              {/* Entries */}
              {hasData ? (
                <View style={s.listSection}>
                  <Text style={s.sectionTitle}>Weight Entries</Text>
                  {newestFirst.map((entry) => (
                    <View key={entry.id} style={s.entry}>
                      <View style={s.entryLeft}>
                        <Text style={s.entryWeight}>{fmt1(entry.weight_kg)}<Text style={s.entryUnit}> kg</Text></Text>
                        <View style={s.entryMeta}>
                          <Text style={s.entryDate}>{longDate(entry.log_date)}</Text>
                          {entry.note ? <Text style={s.entryNote} numberOfLines={1}> · {entry.note}</Text> : null}
                        </View>
                      </View>
                      <Pressable onPress={() => handleDelete(entry)} hitSlop={10} style={s.delBtn} accessibilityLabel="Delete entry">
                        <Text style={s.delTxt}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Text style={s.footnote}>Tap × to remove an entry. One weigh-in is kept per day.</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <LogWeightSheet
          current={current}
          onClose={() => setSheetOpen(false)}
          onSaved={() => { setSheetOpen(false); load(period); }}
        />
      </Modal>

      <Modal visible={targetSheetOpen} transparent animationType="slide" onRequestClose={() => setTargetSheetOpen(false)}>
        <TargetWeightSheet
          current={target}
          onClose={() => setTargetSheetOpen(false)}
          onSaved={(v) => { setTarget(v); setTargetSheetOpen(false); }}
        />
      </Modal>
    </View>
  );
}

// ─── Set-goal-weight sheet ────────────────────────────────────────────────────

function TargetWeightSheet({ current, onClose, onSaved }: {
  current: number | null; onClose: () => void; onSaved: (v: number) => void;
}) {
  const [draft, setDraft] = useState(current != null ? fmt1(current) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 500) {
      Alert.alert('Enter a valid goal weight in kilograms.');
      return;
    }
    setSaving(true);
    try {
      const rounded = Math.round(parsed * 10) / 10;
      await setTargetWeight(rounded);
      onSaved(rounded);
    } catch {
      setSaving(false);
      Alert.alert('Could not save your goal weight. Please try again.');
    }
  }

  return (
    <Pressable style={sh.overlay} onPress={onClose}>
      <Pressable style={sh.sheet} onPress={() => undefined}>
        <View style={sh.handle} />
        <View style={sh.headerRow}>
          <Text style={sh.title}>Goal weight</Text>
          <Pressable onPress={onClose} hitSlop={12} style={sh.closeBtn}>
            <Text style={sh.closeTxt}>×</Text>
          </Pressable>
        </View>

        <Text style={sh.hint}>Your target — the chart marks it with a dashed line.</Text>

        <View style={sh.weightRow}>
          <TextInput
            style={sh.weightInput}
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={C.inkDim}
            returnKeyType="done"
            maxLength={6}
            selectTextOnFocus
            autoFocus
          />
          <Text style={sh.unit}>kg</Text>
        </View>

        <Pressable style={[sh.saveBtn, saving && sh.saveDim]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveTxt}>Save goal</Text>}
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <SkeletonPulse style={{ gap: 16 }}>
      <View style={s.cardsRow}>
        <View style={s.skStatCard} />
        <View style={s.skStatCard} />
      </View>
      <View style={s.skTabs} />
      <View style={s.skChart} />
      <View style={{ gap: 11 }}>
        <View style={s.skEntry} />
        <View style={s.skEntry} />
        <View style={s.skEntry} />
      </View>
    </SkeletonPulse>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 120, gap: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center', ...Shadow.sm,
  },

  // Stat cards
  cardsRow: { flexDirection: 'row', gap: 12 },
  statCardWrap: { flex: 1 },
  statCard: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, minHeight: 104, justifyContent: 'center' },
  statLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: C.inkFaint },
  statValue: { marginTop: 6, fontFamily: Fonts?.display ?? 'system', fontSize: 30, color: C.inkStrong, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statUnit: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkSoft },
  statDash: { marginTop: 6, fontFamily: Fonts?.display ?? 'system', fontSize: 30, color: C.inkDim },
  statTrend: { marginTop: 5, fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600', color: C.greenInk },
  statTrendMuted: { marginTop: 5, fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },
  statLink: { marginTop: 5, fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600', color: C.green },

  // Period tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F1EEE8',
    borderRadius: Radius.pill,
    padding: 4,
    gap: 2,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: Radius.pill },
  tabActive: { backgroundColor: C.accent, ...Shadow.sm },
  tabText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.inkSoft },
  tabTextActive: { color: '#fff' },

  // Chart
  chartCard: { paddingHorizontal: 10, paddingVertical: 14 },

  // Empty
  emptyCard: { paddingHorizontal: 22, paddingVertical: 30, alignItems: 'center', gap: 8 },
  emptyGlyph: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 16, color: C.ink },
  emptyBody: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: C.inkFaint, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: C.accent, borderRadius: Radius.md, paddingHorizontal: 22, paddingVertical: 12, ...Shadow.sm },
  emptyBtnText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: '#fff' },

  // Progress photos entry card
  photoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 14, ...Shadow.sm,
  },
  photoIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  photoText: { flex: 1, gap: 2 },
  photoTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  photoSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },

  // Entries list
  listSection: { gap: 11 },
  sectionTitle: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, color: C.ink, letterSpacing: -0.2, marginBottom: 1 },
  entry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder,
    paddingLeft: 16, paddingRight: 8, paddingVertical: 14, ...Shadow.sm,
  },
  entryLeft: { flex: 1, gap: 3 },
  entryWeight: { fontFamily: Fonts?.displaySemi ?? 'system', fontSize: 17, fontWeight: '600', color: C.inkStrong, fontVariant: ['tabular-nums'] },
  entryUnit: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, fontWeight: '400', color: C.inkFaint },
  entryMeta: { flexDirection: 'row', alignItems: 'center' },
  entryDate: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkSoft },
  entryNote: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, flexShrink: 1 },
  delBtn: { paddingHorizontal: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  delTxt: { fontSize: 20, lineHeight: 24, color: C.inkDim },
  footnote: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, textAlign: 'center', marginTop: 4, lineHeight: 17 },

  // Skeleton
  skStatCard: { flex: 1, height: 104, borderRadius: Radius.xl, backgroundColor: C.line },
  skTabs: { height: 42, borderRadius: Radius.pill, backgroundColor: C.line },
  skChart: { height: CHART_H + 28, borderRadius: Radius.xl, backgroundColor: C.line },
  skEntry: { height: 62, borderRadius: 18, backgroundColor: C.line },
});

// ─── Sheet styles ─────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkFaint },
  hint: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkFaint, marginBottom: 18 },

  weightRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 18 },
  weightInput: {
    minWidth: 130,
    textAlign: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 34,
    color: C.ink,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 16, color: C.inkSoft, paddingBottom: 14 },
  noteInput: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: 14,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.ink,
    marginBottom: 18,
  },
  saveBtn: { backgroundColor: C.accent, borderRadius: Radius.md, height: 52, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  saveDim: { opacity: 0.7 },
  saveTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
});
