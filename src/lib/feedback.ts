// Tactile + audio feedback for success/tap moments. One tiny surface so call
// sites stay one-liners (logSuccess / tap / celebrate) — never sprinkle raw
// Haptics/audio calls across screens.
//
// Anti-guilt: a single soft <150ms tick for log successes (calm, never gamified),
// restrained haptics (Light < Medium < a double-tap only for the streak moment).
//
// Device respect:
//  • Master toggle ("Sounds & haptics", default ON) gates everything.
//  • Sound uses the iOS ambient session (playsInSilentMode:false) → stays silent
//    on the ring/silent switch; haptics still fire. NOTE: Android media-stream
//    audio does not follow the ringer switch — see the release-test note.
//  • Haptics auto-skip on web and no-op (try/catch) where there's no vibrator.
//  • The tick player is preloaded once at import — never per tap (latency).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const PREF_KEY = 'calibreta:feedback:enabled';
const TICK_VOLUME = 0.45; // low volume; the WAV is already quiet

// Preloaded once at module load. Guarded so a load failure never crashes a tap.
let tickPlayer: AudioPlayer | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  tickPlayer = createAudioPlayer(require('../../assets/sounds/tick.wav'));
  tickPlayer.volume = TICK_VOLUME;
} catch {
  tickPlayer = null;
}

// Cached master toggle (default ON) so call sites are synchronous and free.
let enabled = true;

/** Call once at app start: load the saved preference + configure the audio mode. */
export async function initFeedback(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (raw != null) enabled = raw === '1';
  } catch {
    // keep the default
  }
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,   // iOS: honour the silent switch (no sound, haptic only)
      interruptionMode: 'mixWithOthers', // never duck the user's music
      shouldPlayInBackground: false,
    });
  } catch {
    // audio still works with defaults
  }
}

export function isFeedbackEnabled(): boolean {
  return enabled;
}

export async function setFeedbackEnabled(on: boolean): Promise<void> {
  enabled = on;
  try {
    await AsyncStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    // in-memory value still applies for this session
  }
}

function haptic(run: () => Promise<void> | void): void {
  if (!enabled || Platform.OS === 'web') return;
  try {
    const r = run();
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch(() => {}); // swallow "no vibrator"/unsupported
    }
  } catch {
    // no-op
  }
}

function playTick(): void {
  if (!enabled || !tickPlayer) return;
  try {
    void tickPlayer.seekTo(0);
    tickPlayer.play();
  } catch {
    // no-op
  }
}

/** Food / water / weight / exercise / barcode-scan success. One consistent pattern. */
export function logSuccess(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  playTick();
}

/** Light tactile for navigation-ish taps (tab switch, quick-add chips). No sound. */
export function tap(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The one celebration: streak increment. A slightly stronger double-tap + tick. */
export function celebrate(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  playTick();
  setTimeout(() => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 100);
}
