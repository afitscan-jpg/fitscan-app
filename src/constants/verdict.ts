import { C } from './theme';

// No red anywhere on the scan screen — amber is the strongest tone, sage marks
// positives. The scorer never emits red either; this keeps the UI honest by
// construction.
export type VerdictColorKey = 'green' | 'amber';

export const VerdictColors: Record<VerdictColorKey, { tint: string; text: string; badge: string }> = {
  green: { tint: C.greenSoft, text: C.greenInk, badge: C.green },
  amber: { tint: C.amberSoft, text: C.amberInk, badge: C.amber },
};

export const FlagColors: Record<VerdictColorKey, { tint: string; text: string }> = {
  green: { tint: C.greenSoft, text: C.greenInk },
  amber: { tint: C.amberSoft, text: C.amberInk },
};

// "What's in this" tag → colour. neutral/missing read muted, never alarming.
export type FactTag = 'high' | 'good' | 'neutral' | 'missing';
export const FactColors: Record<FactTag, { tint: string; text: string }> = {
  high:    { tint: C.amberSoft, text: C.amberInk },
  good:    { tint: C.greenSoft, text: C.greenInk },
  neutral: { tint: C.bg,        text: C.inkSoft },
  missing: { tint: C.bg,        text: C.inkFaint },
};

/** Threshold (grams) above which sugar is highlighted on the nutrient card. */
export const HIGH_SUGAR_G = 10;
