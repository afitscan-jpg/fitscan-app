import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
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

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { REONBOARD_EVENT } from '@/app/_layout';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import {
  createAccount,
  getAuthState,
  isValidEmail,
  resetPassword,
  signIn,
  signOutToAnonymous,
  type AuthState,
} from '@/lib/auth';

type Mode = 'create' | 'signin';

export default function AccountScreen() {
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    getAuthState().then(setAuthState).catch(() => setAuthState({ isAnonymous: true, email: null }));
  }, []);

  if (!authState) {
    return (
      <View style={s.root}>
        <AmbientBackground />
        <SafeAreaView style={[s.flex, s.center]} edges={['top']}>
          <ActivityIndicator color={C.green} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Account</Text>
          <View style={s.backBtn} />
        </View>

        {authState.isAnonymous ? (
          <AuthForms />
        ) : (
          <SignedIn email={authState.email} />
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Signed-in (permanent) view ───────────────────────────────────────────────

function SignedIn({ email }: { email: string | null }) {
  function handleSignOut() {
    Alert.alert(
      'Sign out?',
      'This returns you to a fresh anonymous session on this device. Your account and its data stay safe — sign back in anytime to see them again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOutToAnonymous();
              DeviceEventEmitter.emit(REONBOARD_EVENT);
            } catch {
              Alert.alert('Could not sign out — please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.signedIcon}>
        <Icon name="verified" color={C.greenInk} size={26} strokeWidth={2} />
      </View>
      <Text style={s.signedTitle}>You&apos;re signed in</Text>
      <Text style={s.signedEmail}>{email ?? 'Your account'}</Text>
      <Text style={s.signedSub}>
        Your progress is backed up to your account and safe on any device.
      </Text>

      <Pressable style={({ pressed }) => [s.secondaryBtn, pressed && s.pressed]} onPress={handleSignOut}>
        <Text style={s.secondaryText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Create / Sign-in forms ───────────────────────────────────────────────────

function AuthForms() {
  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function switchMode(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Use a password of at least 6 characters.');
    if (password !== confirm) return setError('Passwords don’t match.');

    setBusy(true);
    const res = await createAccount(email, password);
    setBusy(false);
    if (res.ok) {
      setCreated(true);
    } else {
      // If the email belongs to another account, nudge toward Sign In.
      if (res.code === 'email_taken') setMode('signin');
      setError(res.message);
    }
  }

  async function handleSignIn() {
    setError(null);
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');

    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.ok) {
      router.replace('/' as never);
    } else {
      setError(res.message);
    }
  }

  async function handleForgot() {
    if (!isValidEmail(email)) return setError('Enter your email above first, then tap Forgot password.');
    setBusy(true);
    const res = await resetPassword(email);
    setBusy(false);
    if (res.ok) {
      Alert.alert('Check your email', 'If an account exists for that address, we’ve sent a reset link.');
    } else {
      setError(res.message);
    }
  }

  if (created) {
    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.signedIcon}>
          <Icon name="check" color={C.greenInk} size={26} strokeWidth={2.6} />
        </View>
        <Text style={s.signedTitle}>Account created</Text>
        <Text style={s.signedSub}>Your data is saved — it&apos;s now safe on any device you sign in to.</Text>
        <Pressable style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]} onPress={() => router.back()}>
          <Text style={s.primaryText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.lead}>Save your progress</Text>
        <Text style={s.leadSub}>
          Your logs live on this device by default. Add a free account to keep them safe and reach
          them on any device.
        </Text>

        {/* Segmented control */}
        <View style={s.seg}>
          {(['create', 'signin'] as Mode[]).map((m) => {
            const on = mode === m;
            return (
              <Pressable key={m} style={[s.segBtn, on && s.segBtnOn]} onPress={() => switchMode(m)}>
                <Text style={[s.segText, on && s.segTextOn]}>{m === 'create' ? 'Create account' : 'Sign in'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.fieldLabel}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={(t) => { setEmail(t); setError(null); }}
          placeholder="you@example.com"
          placeholderTextColor={C.inkFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          editable={!busy}
        />

        <Text style={s.fieldLabel}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
          placeholder={mode === 'create' ? 'At least 6 characters' : 'Your password'}
          placeholderTextColor={C.inkFaint}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        {mode === 'create' ? (
          <>
            <Text style={s.fieldLabel}>Confirm password</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setError(null); }}
              placeholder="Re-enter password"
              placeholderTextColor={C.inkFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [s.primaryBtn, (busy) && s.dim, pressed && s.pressed]}
          onPress={mode === 'create' ? handleCreate : handleSignIn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryText}>{mode === 'create' ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        {mode === 'signin' ? (
          <>
            <Pressable onPress={handleForgot} disabled={busy} hitSlop={6} style={s.forgotWrap}>
              <Text style={s.forgot}>Forgot password?</Text>
            </Pressable>
            <Text style={s.warnNote}>
              Signing in loads your existing account. Anything logged on this device while
              anonymous stays with the anonymous session, not your account.
            </Text>
          </>
        ) : (
          <Text style={s.warnNote}>
            This upgrades your current anonymous session — everything you&apos;ve logged so far
            comes with you.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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

  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 60 },

  lead: { fontFamily: Fonts?.display ?? 'system', fontSize: 24, color: C.ink, letterSpacing: -0.3 },
  leadSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14.5,
    color: C.inkSoft,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },

  // Segmented control
  seg: {
    flexDirection: 'row',
    backgroundColor: '#F1EEE8',
    borderRadius: Radius.pill,
    padding: 4,
    gap: 2,
    marginBottom: 18,
  },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: Radius.pill },
  segBtnOn: { backgroundColor: C.green, ...Shadow.sm },
  segText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: C.inkSoft },
  segTextOn: { color: '#fff' },

  fieldLabel: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 13,
    fontWeight: '600',
    color: C.inkSoft,
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15.5,
    color: C.ink,
    ...Shadow.sm,
  },

  error: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    color: C.red,
    marginTop: 12,
    lineHeight: 19,
  },

  primaryBtn: {
    backgroundColor: C.green,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...Shadow.md,
  },
  primaryText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  dim: { opacity: 0.7 },
  pressed: { opacity: 0.9 },

  forgotWrap: { alignSelf: 'center', paddingVertical: 14 },
  forgot: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 13.5, fontWeight: '600', color: C.green },

  warnNote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: C.inkFaint,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 6,
  },

  // Signed-in / success views
  signedIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  signedTitle: { fontFamily: Fonts?.display ?? 'system', fontSize: 22, color: C.ink, textAlign: 'center', letterSpacing: -0.3 },
  signedEmail: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.greenInk,
    textAlign: 'center',
    marginTop: 6,
  },
  signedSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  secondaryBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    ...Shadow.sm,
  },
  secondaryText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.red },
});
