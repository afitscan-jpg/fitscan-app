import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import type { ScanResult } from '@/types/scan';

// Map the verdict_color key to solid bg colors matching the v3 accent palette.
const VERDICT_BG: Record<string, string> = {
  green: '#4C7C63',
  amber: '#B98438',
  red:   '#C4553D',
};
const VERDICT_SHADOW_COLOR: Record<string, string> = {
  green: 'rgba(76,124,99,0.30)',
  amber: 'rgba(185,132,56,0.30)',
  red:   'rgba(196,85,61,0.30)',
};

interface Props { result: ScanResult }

export function VerdictCard({ result }: Props) {
  const bg     = VERDICT_BG[result.verdict_color]     ?? VERDICT_BG.amber;
  const shadow = VERDICT_SHADOW_COLOR[result.verdict_color] ?? VERDICT_SHADOW_COLOR.amber;

  return (
    <View style={[styles.card, { backgroundColor: bg, shadowColor: shadow }]}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Icon name="alert" color="#fff" size={24} strokeWidth={2} />
        </View>
        <View style={styles.body}>
          <Text style={styles.grade}>{result.grade} · {result.verdict}</Text>
          <Text style={styles.score}>{result.score}/100</Text>
        </View>
      </View>
      <Text style={styles.message}>{result.headline_hinglish}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.three,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 1 },
  grade: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  score: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  message: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 20,
    marginTop: 14,
  },
});
