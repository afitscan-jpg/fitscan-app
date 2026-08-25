import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';

// TODO: Implement OCR capture — snap the nutrition label and extract nutrients via OCR.
export default function OcrCaptureScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Icon name="camera" color={C.green} size={30} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>Label reading is coming soon</Text>
        <Text style={styles.sub}>
          We&apos;re still teaching Calibreta to read nutrition labels. For now, try the
          barcode or &ldquo;Just tell me&rdquo; instead.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
    marginTop: -40,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 22,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 15,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: C.card,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Shadow.sm,
  },
  btnText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    color: C.ink,
    fontSize: 15,
    fontWeight: '600',
  },
});
