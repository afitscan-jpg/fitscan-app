export type VerdictColorKey = 'green' | 'amber' | 'red';

export const VerdictColors: Record<VerdictColorKey, { tint: string; text: string; badge: string }> = {
  green: { tint: '#E8F5E9', text: '#2E7D32', badge: '#43A047' },
  amber: { tint: '#FFF8E1', text: '#E65100', badge: '#FB8C00' },
  red:   { tint: '#FFEBEE', text: '#B71C1C', badge: '#E53935' },
};

export const FlagColors: Record<VerdictColorKey, { tint: string; text: string }> = {
  green: { tint: '#E8F5E9', text: '#2E7D32' },
  amber: { tint: '#FFF8E1', text: '#E65100' },
  red:   { tint: '#FFEBEE', text: '#B71C1C' },
};

/** Threshold (grams) above which sugar is highlighted on the nutrient card. */
export const HIGH_SUGAR_G = 10;
