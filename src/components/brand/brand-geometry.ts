// Calibreta dial — the ONE source of geometry for the brand mark.
//
// BrandMark (brand-mark.tsx) renders this statically; splash-sting.tsx animates
// this exact path + needle. Both import from here so the mark can never drift
// between surfaces again. Proportions taken from
// assets/brand/calibreta-final-u1-dial.svg; rendered stroked because that is the
// release-reliable technique already proven in the splash sting (a filled path
// cannot be stroke-drawn, and useAnimatedProps on SVG does not update in release
// on this stack — see the motion release-fragility note).

export const BRAND_VIEWBOX = 120;
export const BRAND_CX = 60;
export const BRAND_CY = 60;
export const BRAND_R = 38;
export const BRAND_NEEDLE_LEN = 36;

// Degrees of arc drawn; the ~70° gap on the right forms the C.
export const BRAND_ARC_SPAN = 290;
export const BRAND_ARC_LEN = 2 * Math.PI * BRAND_R * (BRAND_ARC_SPAN / 360);

// C opening to the right: endpoints at ±35°, the major arc (large-arc-flag 1)
// sweeps through the left.
export const BRAND_ARC_D = 'M91.13 81.80 A38 38 0 1 0 91.13 38.20';

export const BRAND_ARC_STROKE = 9;
export const BRAND_NEEDLE_STROKE = 4;
export const BRAND_HUB_R = 4;
