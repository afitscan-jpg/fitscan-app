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
  if (lower.includes('sugar') || lower.includes('cheeni') || lower.includes('processed') || lower.includes('ultra')) {
    return 'red';
  }
  if (lower.includes('protein') || lower.includes('fiber') || lower.includes('fibre') || lower.includes('acha') || lower.includes('good')) {
    return 'green';
  }
  return 'amber';
}

export function FlagChip({ label }: Props) {
  const { tint, text } = FlagColors[getSeverity(label)];
  const iconColor = text;

  return (
    <View style={[styles.chip, { backgroundColor: tint }]}>
      <Icon name="alert" color={iconColor} size={13} strokeWidth={2} />
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
