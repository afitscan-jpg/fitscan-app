import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { C, Fonts } from '@/constants/theme';
import type { VerdictColorKey } from '@/constants/verdict';
import { FlagColors } from '@/constants/verdict';

interface Props {
  label: string;
}

function getSeverity(flag: string): VerdictColorKey {
  const lower = flag.toLowerCase();
  // Positives read sage; everything cautionary reads amber. No red — a "high in
  // sugar" chip states a fact, it does not scold.
  if (lower.includes('protein') || lower.includes('fiber') || lower.includes('fibre') || lower.includes('good')) {
    return 'green';
  }
  return 'amber';
}

export function FlagChip({ label }: Props) {
  const severity = getSeverity(label);
  const { tint, text } = FlagColors[severity];

  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <Icon name={severity === 'green' ? 'check' : 'info'} color={text} size={13} strokeWidth={2} />
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  label: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 12,
    fontWeight: '500',
    color: C.inkSoft,
  },
});
