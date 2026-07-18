import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { REONBOARD_EVENT } from '@/app/_layout';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import { getProfile, updateProfile, type Goal, type Profile } from '@/lib/db';
import { getEntitlement, trialDaysLeft, type Entitlement } from '@/lib/entitlement';
import { ensureSession, supabase } from '@/lib/supabase';

// ─── Display helpers ────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: 'English', hinglish: 'Hinglish', hi: 'हिन्दी', bn: 'বাংলা', ta: 'தமிழ்',
  te: 'తెలుగు', kn: 'ಕನ್ನಡ', mr: 'मराठी', gu: 'ગુજરાતી', ml: 'മലയാളം',
  pa: 'ਪੰਜਾਬੀ', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch',
  ar: 'العربية', id: 'Bahasa Indonesia', zh: '中文', ja: '日本語', ko: '한국어',
};

const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', AU: 'Australia',
  CA: 'Canada', SG: 'Singapore', AE: 'UAE', PK: 'Pakistan', BD: 'Bangladesh',
  MY: 'Malaysia', NZ: 'New Zealand', ZA: 'South Africa',
};

function goalLabel(g?: Goal): string {
  if (g === 'lose')         return 'Lose weight';
  if (g === 'gain')         return 'Gain weight';
  if (g === 'build_muscle') return 'Build muscle';
  if (g === 'recomp')       return 'Lose fat + build muscle';
  return 'Maintain';
}

function proteinTarget(weight_kg: number | null | undefined, goal: Goal | undefined): number | null {
  if (weight_kg == null) return null;
  const factor =
    goal === 'build_muscle' || goal === 'recomp' ? 2.0 :
    goal === 'lose' ? 1.8 :
    goal === 'gain' ? 1.6 :
                      1.4;
  return Math.round((weight_kg * factor) / 5) * 5;
}

function planLabel(ent: Entitlement | null): string {
  if (!ent) return '—';
  if (ent.status === 'premium' || ent.is_premium) return 'Premium';
  if (ent.status === 'trial') {
    const days = trialDaysLeft(ent.trial_ends);
    return `Trial · ${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  return 'Free';
}

function dietLabel(pref?: string): string | null {
  if (!pref) return null;
  const map: Record<string, string> = {
    vegetarian: 'Vegetarian', veg: 'Vegetarian', eggetarian: 'Eggetarian',
    non_veg: 'Non-vegetarian', vegan: 'Vegan',
  };
  return pref.split(',').map((p) => map[p] ?? p).join(', ');
}

// ─── Row ────────────────────────────────────────────────────────────────────────

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[s.row, first && s.rowFirst]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ent, setEnt]         = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
    getEntitlement().then(setEnt).catch(() => {});
  }, []);

  function handleRestartSetup() {
    Alert.alert(
      'Restart setup?',
      "We'll walk you through language, country and your goal again. Your logged food and history stay exactly as they are.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            setBusy(true);
            try {
              await updateProfile({ onboarded: false });
              DeviceEventEmitter.emit(REONBOARD_EVENT);
            } catch {
              setBusy(false);
              Alert.alert('Could not restart setup — please try again.');
            }
          },
        },
      ],
    );
  }

  function handleSignOutFresh() {
    Alert.alert(
      'Sign out & start fresh?',
      'This starts a brand-new anonymous profile. Your current logs and history will no longer be visible on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start fresh',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await supabase.auth.signOut();
              await ensureSession();
              DeviceEventEmitter.emit(REONBOARD_EVENT);
            } catch {
              setBusy(false);
              Alert.alert('Could not sign out — please try again.');
            }
          },
        },
      ],
    );
  }

  const protein = proteinTarget(profile?.weight_kg, profile?.goal);
  const diet    = dietLabel(profile?.diet_preference);

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Settings</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={C.green} />
            </View>
          ) : (
            <>
              <Text style={s.eyebrow}>Your profile</Text>
              <View style={s.card}>
                <Row first label="Language" value={profile?.language ? (LANG_NAMES[profile.language] ?? profile.language) : '—'} />
                <Row label="Country" value={profile?.country ? (COUNTRY_NAMES[profile.country] ?? profile.country) : '—'} />
                <Row label="Goal" value={goalLabel(profile?.goal)} />
                {diet ? <Row label="Diet" value={diet} /> : null}
                <Row
                  label="Daily target"
                  value={profile?.daily_target_kcal ? `${profile.daily_target_kcal.toLocaleString()} kcal` : '—'}
                />
                <Row
                  label="Maintenance"
                  value={profile?.maintenance_kcal ? `${profile.maintenance_kcal.toLocaleString()} kcal` : '—'}
                />
                {protein != null ? <Row label="Protein target" value={`${protein} g`} /> : null}
              </View>

              <Text style={s.eyebrow}>Plan</Text>
              <Pressable
                style={({ pressed }) => [s.actionBtn, s.linkRow, pressed && s.pressed]}
                onPress={() => router.push('/premium' as never)}
              >
                <View style={s.linkText}>
                  <Text style={s.actionText}>{planLabel(ent)}</Text>
                  <Text style={s.actionSub}>
                    {ent && (ent.status === 'premium' || ent.is_premium)
                      ? 'Unlimited AI logging, insights & planner'
                      : 'Go Premium for unlimited AI, insights & planner'}
                  </Text>
                </View>
                <Icon name="arrow" color={C.inkDim} size={18} strokeWidth={2} />
              </Pressable>

              <Text style={s.eyebrow}>Tracking</Text>
              <Pressable
                style={({ pressed }) => [s.actionBtn, s.linkRow, pressed && s.pressed]}
                onPress={() => router.push('/weight' as never)}
              >
                <View style={s.linkText}>
                  <Text style={s.actionText}>Weight tracker</Text>
                  <Text style={s.actionSub}>
                    {profile?.weight_kg != null
                      ? `Current ${(Math.round(profile.weight_kg * 10) / 10).toFixed(1)} kg · view trend`
                      : 'Log your weight and see your trend'}
                  </Text>
                </View>
                <Icon name="arrow" color={C.inkDim} size={18} strokeWidth={2} />
              </Pressable>

              <Text style={s.eyebrow}>Setup</Text>
              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
                onPress={handleRestartSetup}
                disabled={busy}
              >
                <Text style={s.actionText}>Restart setup</Text>
                <Text style={s.actionSub}>Re-run language, country and goal</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
                onPress={handleSignOutFresh}
                disabled={busy}
              >
                <Text style={[s.actionText, s.danger]}>Sign out &amp; start fresh</Text>
                <Text style={s.actionSub}>Begin a new anonymous profile</Text>
              </Pressable>

              {busy ? (
                <View style={s.busyRow}>
                  <ActivityIndicator color={C.green} size="small" />
                </View>
              ) : null}

              <Text style={s.footnote}>
                FitScan keeps you anonymous by default — no account needed.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingBottom: 100, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 20,
    color: C.ink,
    letterSpacing: -0.3,
  },

  loadingBox: { paddingTop: 80, alignItems: 'center' },

  eyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkFaint,
    marginTop: 6,
    marginBottom: -2,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  rowFirst: { borderTopWidth: 0 },
  rowLabel: { fontFamily: Fonts?.body ?? 'system', fontSize: 14, color: C.inkSoft },
  rowValue: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
    fontVariant: ['tabular-nums'],
  },

  actionBtn: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
    ...Shadow.sm,
  },
  pressed:    { opacity: 0.85 },
  linkRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linkText:   { flex: 1, gap: 2 },
  actionText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  actionSub:  { fontFamily: Fonts?.body ?? 'system', fontSize: 12.5, color: C.inkFaint },
  danger:     { color: C.red },

  busyRow: { alignItems: 'center', paddingVertical: 4 },

  footnote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
});
