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
import { useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, StyleSheet, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { C } from '@/constants/theme';
import { getProfile } from '@/lib/db';
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
    <>
      <StatusBar style="dark" />
      <AppTabs />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
