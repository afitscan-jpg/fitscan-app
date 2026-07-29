import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { C, Fonts, Radius, Spacing } from '@/constants/theme';
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
// Icon matches the grade/verdict, not a hardcoded warning: good→check, ok→info,
// avoid→alert-triangle. Keyed off verdict_color so it always agrees with the card.
const VERDICT_ICON: Record<string, IconName> = {
  green: 'check',
  amber: 'info',
  red:   'alert',
};

interface Props { result: ScanResult }

export function VerdictCard({ result }: Props) {
  // Insufficient label data — render a clean "unknown" state with no grade,
  // score, or numbers, instead of a broken "Unknown · null/100" card.
  if (result.verdict === 'Unknown' || result.grade == null) {
    return (
      <View style={styles.unknownCard}>
        <View style={styles.unknownBadge}>
          <Icon name="search" color={C.inkSoft} size={22} strokeWidth={1.9} />
        </View>
        <View style={styles.unknownBody}>
          <Text style={styles.unknownTitle}>Couldn&apos;t identify this</Text>
          <Text style={styles.unknownSub}>
            Try describing it in text instead — that&apos;s usually more accurate
          </Text>
        </View>
      </View>
    );
  }

  const bg     = VERDICT_BG[result.verdict_color]     ?? VERDICT_BG.amber;
  const shadow = VERDICT_SHADOW_COLOR[result.verdict_color] ?? VERDICT_SHADOW_COLOR.amber;

  return (
    <View style={[styles.card, { backgroundColor: bg, shadowColor: shadow }]}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Icon name={VERDICT_ICON[result.verdict_color] ?? 'info'} color="#fff" size={24} strokeWidth={2} />
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
  // Neutral "couldn't identify" state (no verdict colour, no numbers).
  unknownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: Radius.xl,
    padding: Spacing.three,
  },
  unknownBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unknownBody: { flex: 1, gap: 4 },
  unknownTitle: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  unknownSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    lineHeight: 19,
  },
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
