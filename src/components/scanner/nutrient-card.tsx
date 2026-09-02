import { StyleSheet, Text, View } from 'react-native';

import { C, Fonts, Radius, Shadow } from '@/constants/theme';

interface Props {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}

export function NutrientCard({ label, value, unit, highlight = false }: Props) {
  return (
    <View style={[styles.card, highlight && styles.cardHi]}>
      <Text style={styles.key}>{label}</Text>
      <Text style={[styles.value, highlight && styles.valueHi]}>
        {value}
        <Text style={[styles.unit, highlight && styles.valueHi]}> {unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: C.card,
    borderRadius: Radius.md,
    padding: 13,
    ...Shadow.sm,
  },
  cardHi: {
    backgroundColor: C.amberSoft,
  },
  key: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkSoft,
  },
  value: {
    fontFamily: Fonts?.displaySemi ?? 'system',
    fontWeight: '600',
    fontSize: 20,
    color: C.ink,
    marginTop: 3,
  },
  valueHi: {
    color: C.amberInk,
  },
  unit: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13,
    fontWeight: '400',
    color: C.inkSoft,
  },
});
