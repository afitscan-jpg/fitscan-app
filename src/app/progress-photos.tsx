import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
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
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { addPhoto, deletePhoto, listPhotos, type ProgressPhoto } from '@/lib/progress-photos';

type Tab = 'timeline' | 'compare';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PAD = 22;
const GRID_GAP = 10;
const COLS = 3;
const THUMB = Math.floor((SCREEN_W - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS);

// ─── Date helpers ─────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function longDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function sane(d: Date): boolean {
  const t = d.getTime();
  return !Number.isNaN(t) && t > Date.parse('2000-01-01') && t <= Date.now() + 60_000;
}

function captureDateISO(asset: ImagePicker.ImagePickerAsset): string {
  // EXIF DateTimeOriginal is "YYYY:MM:DD HH:MM:SS" — colons in the date part, camera-local time.
  const raw = asset.exif?.DateTimeOriginal ?? asset.exif?.DateTimeDigitized ?? asset.exif?.DateTime;
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const [, y, mo, d, h, mi, s] = m;
      const dt = new Date(+y, +mo - 1, +d, +h, +mi, +s);
      if (sane(dt)) return dt.toISOString();
    }
  }
  // creationTime isn't in this picker version's asset type — read it defensively.
  const creationTime = (asset as { creationTime?: number }).creationTime;
  if (typeof creationTime === 'number' && creationTime > 0) {
    const dt = new Date(creationTime);
    if (sane(dt)) return dt.toISOString();
  }
  return new Date().toISOString();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressPhotosScreen() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('timeline');

  const [viewer, setViewer] = useState<ProgressPhoto | null>(null);

  // Add flow: a picked uri opens the details sheet.
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [draftDate, setDraftDate] = useState<string>(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);

  // Compare selection (up to two photo ids).
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setPhotos(await listPhotos());
    } catch {
      // Local read failure — show empty rather than crash.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Default the compare pair to oldest + newest the first time there are 2+.
  useEffect(() => {
    if (tab === 'compare' && compareIds.length === 0 && photos.length >= 2) {
      setCompareIds([photos[photos.length - 1].id, photos[0].id]);
    }
  }, [tab, photos, compareIds.length]);

  // ── Permission + picking ────────────────────────────────────────────────────

  function permissionDenied(kind: 'camera' | 'library') {
    Alert.alert(
      kind === 'camera' ? 'Camera access needed' : 'Photo access needed',
      `Allow ${kind === 'camera' ? 'the camera' : 'photo library'} access in Settings to add progress photos. They stay on your device.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ],
    );
  }

  async function pick(source: 'camera' | 'library') {
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { permissionDenied(source === 'camera' ? 'camera' : 'library'); return; }

      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, exif: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: true });

      if (res.canceled) return;
      const asset = res.assets[0];
      if (!asset?.uri) return;
      setDraftWeight('');
      setDraftDate(captureDateISO(asset));
      setDraftUri(asset.uri);
    } catch {
      Alert.alert('Could not open the picker — please try again.');
    }
  }

  function openAddChooser() {
    Alert.alert('Add progress photo', 'Photos stay private on your device.', [
      { text: 'Take photo', onPress: () => pick('camera') },
      { text: 'Choose from gallery', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSaveDraft() {
    if (!draftUri || saving) return;
    setSaving(true);
    const w = parseFloat(draftWeight);
    const weight_kg = !Number.isNaN(w) && w > 0 && w <= 500 ? Math.round(w * 10) / 10 : null;
    try {
      await addPhoto(draftUri, { date: draftDate, weight_kg });
      setDraftUri(null);
      await load();
    } catch {
      Alert.alert('Could not save the photo. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(photo: ProgressPhoto) {
    Alert.alert('Delete this photo?', 'It will be removed from your device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhoto(photo.id);
            setViewer(null);
            setCompareIds((ids) => ids.filter((id) => id !== photo.id));
            await load();
          } catch {
            Alert.alert('Could not delete — please try again.');
          }
        },
      },
    ]);
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length < 2) return [...ids, id];
      return [ids[1], id]; // drop the oldest selection, keep it a rolling pair
    });
  }

  const comparePair = useMemo(
    () => compareIds.map((id) => photos.find((p) => p.id === id)).filter((p): p is ProgressPhoto => !!p),
    [compareIds, photos],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Progress Photos</Text>
          <View style={s.backBtn} />
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.green} /></View>
        ) : photos.length === 0 ? (
          <EmptyState onAdd={openAddChooser} />
        ) : (
          <>
            {/* Timeline | Compare toggle */}
            <View style={s.seg}>
              {(['timeline', 'compare'] as Tab[]).map((t) => {
                const on = tab === t;
                return (
                  <Pressable key={t} style={[s.segBtn, on && s.segBtnOn]} onPress={() => setTab(t)}>
                    <Text style={[s.segText, on && s.segTextOn]}>{t === 'timeline' ? 'Timeline' : 'Compare'}</Text>
                  </Pressable>
                );
              })}
            </View>

            {tab === 'timeline' ? (
              <FlatList
                data={photos}
                keyExtractor={(p) => p.id}
                numColumns={COLS}
                columnWrapperStyle={s.gridRow}
                contentContainerStyle={s.grid}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={<PrivacyNote />}
                renderItem={({ item }) => (
                  <AnimatedPressable style={s.cell} onPress={() => setViewer(item)}>
                    <Image source={{ uri: item.uri }} style={s.cellImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                    <View style={s.cellMeta}>
                      <Text style={s.cellDate}>{shortDate(item.date)}</Text>
                      {item.weight_kg != null ? <Text style={s.cellWeight}>{fmt1(item.weight_kg)} kg</Text> : null}
                    </View>
                  </AnimatedPressable>
                )}
              />
            ) : (
              <CompareView
                pair={comparePair}
                photos={photos}
                selectedIds={compareIds}
                onToggle={toggleCompare}
              />
            )}
          </>
        )}
      </SafeAreaView>

      {/* Add FAB */}
      {!loading && photos.length > 0 ? (
        <AnimatedPressable style={s.fab} onPress={openAddChooser} pressedScale={0.92} accessibilityLabel="Add photo">
          <Icon name="plus" color="#fff" size={24} strokeWidth={2.4} />
        </AnimatedPressable>
      ) : null}

      {/* Full viewer */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        {viewer ? <PhotoViewer photo={viewer} onClose={() => setViewer(null)} onDelete={() => confirmDelete(viewer)} /> : null}
      </Modal>

      {/* Add details sheet */}
      <Modal visible={draftUri !== null} transparent animationType="slide" onRequestClose={() => { if (!saving) setDraftUri(null); }}>
        {draftUri ? (
          <DetailsSheet
            uri={draftUri}
            date={draftDate}
            weight={draftWeight}
            onWeight={setDraftWeight}
            saving={saving}
            onCancel={() => { if (!saving) setDraftUri(null); }}
            onSave={handleSaveDraft}
          />
        ) : null}
      </Modal>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.emptyWrap} showsVerticalScrollIndicator={false}>
      <View style={s.emptyGlyph}>
        <Icon name="camera" color={C.green} size={30} strokeWidth={1.6} />
      </View>
      <Text style={s.emptyTitle}>Track progress beyond the scale</Text>
      <Text style={s.emptyBody}>
        Sometimes the change shows up in the mirror first. Add your first photo to start your
        private gallery.
      </Text>
      <View style={s.privatePill}>
        <Icon name="verified" color={C.greenInk} size={13} strokeWidth={2} />
        <Text style={s.privatePillText}>Photos stay on your device</Text>
      </View>
      <AnimatedPressable style={s.emptyBtn} onPress={onAdd}>
        <Text style={s.emptyBtnText}>Add first photo</Text>
      </AnimatedPressable>
    </ScrollView>
  );
}

function PrivacyNote() {
  return (
    <View style={s.privateNote}>
      <Icon name="verified" color={C.greenInk} size={13} strokeWidth={2} />
      <Text style={s.privateNoteText}>Private — these photos stay on your device and are never uploaded.</Text>
    </View>
  );
}

// ─── Compare view ─────────────────────────────────────────────────────────────

function CompareView({
  pair, photos, selectedIds, onToggle,
}: {
  pair: ProgressPhoto[];
  photos: ProgressPhoto[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={s.compareScroll} showsVerticalScrollIndicator={false}>
      <PrivacyNote />
      <View style={s.compareRow}>
        <CompareSlot label="Before" photo={pair[0]} />
        <CompareSlot label="After" photo={pair[1]} />
      </View>
      <Text style={s.compareHint}>
        Tap two photos below to compare them side by side.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stripRow}>
        {photos.map((p) => {
          const idx = selectedIds.indexOf(p.id);
          const on = idx !== -1;
          return (
            <Pressable key={p.id} onPress={() => onToggle(p.id)} style={[s.stripItem, on && s.stripItemOn]}>
              <Image source={{ uri: p.uri }} style={s.stripImg} contentFit="cover" cachePolicy="memory-disk" />
              {on ? (
                <View style={s.stripBadge}>
                  <Text style={s.stripBadgeText}>{idx + 1}</Text>
                </View>
              ) : null}
              <Text style={s.stripDate}>{shortDate(p.date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </ScrollView>
  );
}

function CompareSlot({ label, photo }: { label: string; photo?: ProgressPhoto }) {
  return (
    <View style={s.slot}>
      <Text style={s.slotLabel}>{label}</Text>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={s.slotImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          <Text style={s.slotDate}>{longDate(photo.date)}</Text>
          {photo.weight_kg != null ? <Text style={s.slotWeight}>{fmt1(photo.weight_kg)} kg</Text> : null}
        </>
      ) : (
        <View style={[s.slotImg, s.slotEmpty]}>
          <Icon name="plus" color={C.inkFaint} size={22} strokeWidth={2} />
        </View>
      )}
    </View>
  );
}

// ─── Full viewer ──────────────────────────────────────────────────────────────

function PhotoViewer({ photo, onClose, onDelete }: { photo: ProgressPhoto; onClose: () => void; onDelete: () => void }) {
  return (
    <View style={v.overlay}>
      <SafeAreaView style={v.bar} edges={['top']}>
        <Pressable onPress={onClose} hitSlop={12} style={v.iconBtn}>
          <Text style={v.close}>×</Text>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={12} style={v.iconBtn} accessibilityLabel="Delete photo">
          <Icon name="box" color="#fff" size={20} strokeWidth={1.9} />
        </Pressable>
      </SafeAreaView>

      <Pressable style={v.imgWrap} onPress={onClose}>
        <Image source={{ uri: photo.uri }} style={v.img} contentFit="contain" transition={150} />
      </Pressable>

      <SafeAreaView edges={['bottom']} style={v.caption}>
        <Text style={v.capDate}>{longDate(photo.date)}</Text>
        {photo.weight_kg != null ? <Text style={v.capWeight}>{fmt1(photo.weight_kg)} kg</Text> : null}
      </SafeAreaView>
    </View>
  );
}

// ─── Add details sheet ────────────────────────────────────────────────────────

function DetailsSheet({
  uri, date, weight, onWeight, saving, onCancel, onSave,
}: {
  uri: string;
  date: string;
  weight: string;
  onWeight: (t: string) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isToday = new Date(date).toDateString() === new Date().toDateString();
  return (
    <Pressable style={sh.overlay} onPress={onCancel}>
      <Pressable style={sh.sheet} onPress={() => undefined}>
        <View style={sh.handle} />
        <View style={sh.headerRow}>
          <Text style={sh.title}>New progress photo</Text>
          <Pressable onPress={onCancel} hitSlop={12} style={sh.closeBtn}>
            <Text style={sh.closeTxt}>×</Text>
          </Pressable>
        </View>

        <Image source={{ uri }} style={sh.preview} contentFit="cover" transition={150} />

        <Text style={sh.dateLine}>
          {isToday ? 'Dated today' : 'From this photo'} · {longDate(date)}
        </Text>

        <Text style={sh.fieldLabel}>Current weight (optional)</Text>
        <View style={sh.weightRow}>
          <TextInput
            style={sh.weightInput}
            value={weight}
            onChangeText={(t) => onWeight(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="e.g. 72.5"
            placeholderTextColor={C.inkFaint}
            returnKeyType="done"
            maxLength={6}
            selectTextOnFocus
          />
          <Text style={sh.unit}>kg</Text>
        </View>

        <Pressable style={[sh.saveBtn, saving && sh.saveDim]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={sh.saveTxt}>Save photo</Text>}
        </Pressable>
        <Text style={sh.privacy}>Saved only on this device — never uploaded.</Text>
      </Pressable>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },

  // Segmented
  seg: {
    flexDirection: 'row', backgroundColor: '#F1EEE8', borderRadius: Radius.pill,
    padding: 4, gap: 2, marginHorizontal: 22, marginBottom: 12,
  },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: Radius.pill },
  segBtnOn: { backgroundColor: C.green, ...Shadow.sm },
  segText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: C.inkSoft },
  segTextOn: { color: '#fff' },

  // Privacy note
  privateNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.greenSoft, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14,
  },
  privateNoteText: { flex: 1, fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.greenInk, lineHeight: 16 },

  // Grid
  grid: { paddingHorizontal: GRID_PAD, paddingBottom: 120 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  cell: {
    width: THUMB, height: THUMB, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: '#EDEAE2', ...Shadow.sm,
  },
  cellImg: { width: '100%', height: '100%' },
  cellMeta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 7, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  cellDate: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600', color: '#fff' },
  cellWeight: { fontFamily: Fonts?.body ?? 'system', fontSize: 10.5, color: 'rgba(255,255,255,0.9)' },

  // FAB
  fab: {
    position: 'absolute', right: 22, bottom: 34,
    width: 58, height: 58, borderRadius: 20, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', ...Shadow.lg,
  },

  // Empty state
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 60, gap: 12 },
  emptyGlyph: {
    width: 64, height: 64, borderRadius: Radius.lg, backgroundColor: C.greenSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: Fonts?.display ?? 'system', fontSize: 22, color: C.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: Fonts?.body ?? 'system', fontSize: 14.5, color: C.inkSoft, textAlign: 'center', lineHeight: 22 },
  privatePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.greenSoft, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7, marginTop: 2,
  },
  privatePillText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12, fontWeight: '600', color: C.greenInk },
  emptyBtn: {
    marginTop: 10, backgroundColor: C.green, borderRadius: Radius.md,
    paddingHorizontal: 26, height: 52, alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  emptyBtnText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },

  // Compare
  compareScroll: { paddingHorizontal: 22, paddingBottom: 120 },
  compareRow: { flexDirection: 'row', gap: 12 },
  slot: { flex: 1, gap: 6 },
  slotLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkFaint,
  },
  slotImg: { width: '100%', aspectRatio: 0.75, borderRadius: Radius.md, backgroundColor: '#EDEAE2', ...Shadow.sm },
  slotEmpty: { alignItems: 'center', justifyContent: 'center' },
  slotDate: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 12.5, fontWeight: '600', color: C.ink, marginTop: 2 },
  slotWeight: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.greenInk },
  compareHint: { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint, textAlign: 'center', marginTop: 16, marginBottom: 10 },
  stripRow: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  stripItem: { width: 74, borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  stripItemOn: { borderColor: C.green },
  stripImg: { width: '100%', height: 74 },
  stripBadge: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  stripBadgeText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 10, fontWeight: '700', color: '#fff' },
  stripDate: { fontFamily: Fonts?.body ?? 'system', fontSize: 10, color: C.inkSoft, textAlign: 'center', paddingVertical: 3 },
});

const v = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  close: { fontSize: 30, lineHeight: 34, color: '#fff' },
  imgWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  caption: { alignItems: 'center', paddingVertical: 18, gap: 3 },
  capDate: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  capWeight: { fontFamily: Fonts?.body ?? 'system', fontSize: 13.5, color: 'rgba(255,255,255,0.85)' },
});

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 32,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontFamily: Fonts?.display ?? 'system', fontSize: 20, color: C.ink, letterSpacing: -0.3 },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 22, lineHeight: 26, color: C.inkFaint },
  preview: { width: '100%', aspectRatio: 1, borderRadius: Radius.lg, backgroundColor: '#EDEAE2' },
  dateLine: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkFaint, marginTop: 12 },
  fieldLabel: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13, fontWeight: '600', color: C.inkSoft, marginTop: 16, marginBottom: 8 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 18,
    color: C.ink, fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: Fonts?.body ?? 'system', fontSize: 15, color: C.inkSoft },
  saveBtn: { backgroundColor: C.green, borderRadius: Radius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 20, ...Shadow.md },
  saveDim: { opacity: 0.7 },
  saveTxt: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  privacy: { fontFamily: Fonts?.body ?? 'system', fontSize: 12, color: C.inkFaint, textAlign: 'center', marginTop: 12 },
});
