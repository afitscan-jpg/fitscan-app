import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { C, Fonts, Spacing } from '@/constants/theme';
import { fetchScan } from '@/lib/scan';
import { logSuccess } from '@/lib/feedback';
import { scanResultStore } from '@/lib/scan-result-store';

type ScanState = 'idle' | 'loading' | 'error';

const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const RETICLE_SIZE = 260;
const CORNER = 24;
const CORNER_W = 3;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isBusy = useRef(false);

  // BARCODE motion: a sweep line runs down the reticle while scanning, and the
  // corners pulse while a scanned code is being looked up. Reduced-motion → still.
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, sweep]);
  useEffect(() => {
    if (reduced) { pulse.value = 1; return; }
    pulse.value = scanState === 'loading'
      ? withRepeat(withTiming(0.35, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [scanState, reduced, pulse]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * (RETICLE_SIZE - 3) }] }));
  const cornerPulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Reset state whenever this screen comes back into focus.
  useFocusEffect(
    useCallback(() => {
      isBusy.current = false;
      setScanState('idle');
      setErrorMsg(null);
    }, []),
  );

  const handleBarcode = useCallback(async (scan: BarcodeScanningResult) => {
    if (isBusy.current) return;
    isBusy.current = true;
    setScanState('loading');
    setErrorMsg(null);

    console.log('[Scanner] barcode detected:', scan.data, '| type:', scan.type);

    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      console.warn('[Scanner] EXPO_PUBLIC_API_URL is not set — set it in .env and restart to enable scanning');
      setErrorMsg("Scanning isn't available right now — please try again later.");
      setScanState('error');
      isBusy.current = false;
      return;
    }

    console.log('[Scanner] → GET', `${apiUrl}/scan/${scan.data}`);

    try {
      const outcome = await fetchScan(scan.data);
      console.log('[Scanner] ← outcome:', outcome.kind);

      if (outcome.kind === 'ok') {
        logSuccess();
        scanResultStore.set(outcome.data);
        router.push({ pathname: '/scanner/result', params: { outcome: 'ok' } });
      } else if (outcome.kind === 'not_found') {
        router.push({ pathname: '/scanner/result', params: { outcome: 'not_found' } });
      } else if (outcome.kind === 'upstream_error') {
        setErrorMsg('Server error — please try again.');
        setScanState('error');
        isBusy.current = false;
      } else {
        setErrorMsg('Barcode not recognised — try another.');
        setScanState('error');
        isBusy.current = false;
      }
    } catch (e) {
      console.error('[Scanner] fetch error:', e);
      setErrorMsg('Something went wrong — try again.');
      setScanState('error');
      isBusy.current = false;
    }
  }, []);

  const retry = useCallback(() => {
    setScanState('idle');
    setErrorMsg(null);
    isBusy.current = false;
  }, []);

  // ── Permission: still loading ──────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.green} />
      </View>
    );
  }

  // ── Permission: denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Calibreta needs the camera to scan product barcodes.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow camera</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>Open settings</Text>
          </Pressable>
        )}
      </SafeAreaView>
    );
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={scanState === 'idle' ? handleBarcode : undefined}
      />

      {/* Semi-transparent overlay with rectangular cut-out for the reticle */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.topFade} />
        <View style={styles.middleRow}>
          <View style={styles.sideFade} />
          <View style={styles.reticle}>
            <Reanimated.View style={[StyleSheet.absoluteFill, cornerPulseStyle]}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </Reanimated.View>
            {scanState !== 'error' && (
              <Reanimated.View style={[styles.scanLine, sweepStyle]} />
            )}
          </View>
          <View style={styles.sideFade} />
        </View>
        <View style={styles.bottomFade} />
      </View>

      {/* Status / feedback strip at the bottom */}
      <SafeAreaView style={styles.statusWrap} edges={['bottom']}>
        {scanState === 'idle' && (
          <Text style={styles.hint}>Point at a barcode</Text>
        )}

        {scanState === 'loading' && (
          <View style={styles.row}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.hint}>Looking up product…</Text>
          </View>
        )}

        {scanState === 'error' && errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Pressable onPress={retry} hitSlop={8}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  permTitle: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 20,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: C.green,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    marginTop: Spacing.two,
  },
  permBtnText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topFade: { flex: 1, backgroundColor: OVERLAY_COLOR },
  middleRow: { flexDirection: 'row', height: RETICLE_SIZE },
  sideFade: { flex: 1, backgroundColor: OVERLAY_COLOR },
  bottomFade: { flex: 1.5, backgroundColor: OVERLAY_COLOR },
  reticle: { width: RETICLE_SIZE, height: RETICLE_SIZE },
  scanLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: C.mint,
    opacity: 0.9,
  },

  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#fff',
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },

  statusWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hint: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  errorBox: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: 4,
    marginHorizontal: Spacing.four,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryText: {
    color: '#4DA3FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
