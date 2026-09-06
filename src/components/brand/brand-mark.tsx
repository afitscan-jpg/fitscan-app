import Svg, { Circle, Line, Path } from 'react-native-svg';

import { C } from '@/constants/theme';

import {
  BRAND_ARC_D,
  BRAND_ARC_STROKE,
  BRAND_CX,
  BRAND_CY,
  BRAND_HUB_R,
  BRAND_NEEDLE_LEN,
  BRAND_NEEDLE_STROKE,
  BRAND_VIEWBOX,
} from './brand-geometry';

interface Props {
  /** Rendered width/height in px (square). Default 28 — the Home-header size. */
  size?: number;
  /** Mark colour. Default sage (C.green); pass a light colour on a sage badge. */
  color?: string;
}

// The Calibreta mark — the U1 dial: a gauge "C" with the needle resting at 12
// o'clock. The single source of truth for the brand mark; use this everywhere a
// static mark appears (onboarding, Home header, …). Static and
// reduced-motion-safe by construction — the animated sibling is splash-sting.tsx,
// which draws this exact geometry (brand-geometry.ts).
export function BrandMark({ size = 28, color = C.green }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${BRAND_VIEWBOX} ${BRAND_VIEWBOX}`}
      accessibilityRole="image"
      accessibilityLabel="Calibreta"
    >
      <Path
        d={BRAND_ARC_D}
        stroke={color}
        strokeWidth={BRAND_ARC_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Line
        x1={BRAND_CX}
        y1={BRAND_CY}
        x2={BRAND_CX}
        y2={BRAND_CY - BRAND_NEEDLE_LEN}
        stroke={color}
        strokeWidth={BRAND_NEEDLE_STROKE}
        strokeLinecap="round"
      />
      <Circle cx={BRAND_CX} cy={BRAND_CY} r={BRAND_HUB_R} fill={color} />
    </Svg>
  );
}
