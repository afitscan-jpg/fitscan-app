import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState as RNAppState, DeviceEventEmitter, StyleSheet, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AssistantFab } from '@/components/assistant-fab';
import { ToastProvider } from '@/components/toast';
import { SplashSting } from '@/components/splash-sting';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { C } from '@/constants/theme';
import { getProfile } from '@/lib/db';
import { initFeedback } from '@/lib/feedback';
import { onRemindersAppActive } from '@/lib/reminders';
import { ensureSession } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

// Emitted by the Settings screen to send the user back through onboarding
// (Restart setup / Sign out & start fresh). Onboarding is rendered by state
// here, not a route, so a DeviceEventEmitter signal is the clean way to flip it.
export const REONBOARD_EVENT = 'fitscan:reonboard';

type AppState = 'loading' | 'onboarding' | 'ready';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'BricolageGrotesque-Regular': BricolageGrotesque_400Regular,
    'BricolageGrotesque-Medium': BricolageGrotesque_500Medium,
    'BricolageGrotesque-SemiBold': BricolageGrotesque_600SemiBold,
    'BricolageGrotesque-Bold': BricolageGrotesque_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  const [appState, setAppState] = useState<AppState>('loading');

  // Launch sting: play once per process, the first time the app is ready. A ref
  // guard keeps it from replaying when Settings sends the user back through
  // onboarding (ready → onboarding → ready again).
  const [showSting, setShowSting] = useState(false);
  const stingPlayed = useRef(false);
  useEffect(() => {
    if (appState === 'ready' && !stingPlayed.current) {
      stingPlayed.current = true;
      setShowSting(true);
    }
  }, [appState]);

  useEffect(() => {
    async function init() {
      try {
        await ensureSession();
        const profile = await getProfile();
        setAppState(profile?.onboarded ? 'ready' : 'onboarding');
      } catch (e) {
        console.warn('[init] error', e);
        setAppState('onboarding');
      }
    }
    init();
  }, []);

  // Preload the tick sound + load the "Sounds & haptics" preference + set the
  // audio mode (respect the silent switch). Fire-and-forget; never blocks.
  useEffect(() => { void initFeedback(); }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(REONBOARD_EVENT, () => {
      setAppState('onboarding');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded && appState !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appState]);

  // Local reminders: resolve auto-pause + reschedule (with suppression) once the
  // session is ready and again on every foreground. Never blocks or throws.
  useEffect(() => {
    if (appState !== 'ready') return;
    void onRemindersAppActive();
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') void onRemindersAppActive();
    });
    return () => sub.remove();
  }, [appState]);

  if (!fontsLoaded || appState === 'loading') {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <ActivityIndicator color={C.green} size="large" />
      </View>
    );
  }

  if (appState === 'onboarding') {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingFlow onComplete={() => setAppState('ready')} />
      </>
    );
  }

  return (
    <ToastProvider>
      <View style={styles.appRoot}>
        <StatusBar style="dark" />
        <AppTabs />
        {/* Single global instance — persists across all tabs (never per-screen). */}
        <AssistantFab />
        {showSting && <SplashSting onDone={() => setShowSting(false)} />}
      </View>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
