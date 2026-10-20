import { BrandMark } from '@/components/brand/brand-mark';
import { Breathe } from '@/components/motion/breathe';
import { C } from '@/constants/theme';

// v2 §14 — the empty-state breathing dial: the BrandMark wrapped in Breathe
// (1.0 → 1.04 + soft halo, 3 s). The Home ring on an empty day uses Breathe
// directly, so both empty states breathe the same way.
export function BreathingDial({ size = 60, color = C.green }: { size?: number; color?: string }) {
  return (
    <Breathe haloInset={-10} haloPeak={0.14}>
      <BrandMark size={size} color={color} />
    </Breathe>
  );
}
