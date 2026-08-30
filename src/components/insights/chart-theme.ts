// src/components/insights/chart-theme.ts
// Chart palette for Nutrition Insights. Series colours are validated for
// colourblind-safety (dataviz check) and chosen for the anti-guilt language:
// one calm hue for the person's own data, a NEUTRAL reference for the target,
// texture (never a warning colour) for estimated data.

import { C } from '@/constants/theme';

export const CHART = {
  sage:      '#4C7C63',   // the person's own data (single series)
  sageSoft:  '#CFE0D3',   // hatch ground + over-target tint (same hue, lighter)
  target:    '#9BA393',   // neutral dashed reference — NOT a red ceiling
  avg:       '#B4AE9F',   // faint weekly-average line
  grid:      '#E7E9E0',
  todayRing: '#34573F',   // outline on today's bar (emphasis without recolour)
  onFill:    '#FFFFFF',   // text sitting on a filled bar
  // meal-type categorical (fixed order; always direct-labelled)
  meal: {
    breakfast: '#C4881F',
    lunch:     '#2E8B57',
    snack:     '#3A6EA5',
    dinner:    '#B4472C',
  },
  ink:      C.ink,
  inkDim:   C.inkSoft,
  inkFaint: C.inkFaint,
} as const;

// A "nice" axis maximum at or above the data/target, rounded to a clean step so
// the y-axis reads honestly (and always includes the target line).
export function niceMax(values: number[], target: number | null, step: number): number {
  const peak = Math.max(1, ...values, target ?? 0);
  return Math.ceil((peak * 1.12) / step) * step;
}
