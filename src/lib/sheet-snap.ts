// src/lib/sheet-snap.ts
// Snap heights for a bottom sheet whose content varies (the photo "Ready to log"
// sheet: 1 to 6+ items plus a TOTAL). Pure, so it can be checked offline.
//
// WHY A DEFINITE HEIGHT. The sheet used to be `maxHeight: 82%` with a
// `flexShrink: 1, minHeight: 0` scroll region. That is the textbook answer and it
// held on most phones — but on the audit-fix-2 device build, three items plus
// the TOTAL left the ScrollView at its full content height, the sheet taller
// than its cap, and the TOTAL hidden under the pinned "Log all" with nothing to
// scroll. Yoga's max-constraint-with-auto-height shrink is exactly the case that
// has to be trusted blind. A measured, definite `height` is not: with it, the
// scroll region is `flex: 1`, which always resolves to a real box.

/** Fractions of the window height the sheet may occupy, smallest first. */
export const SHEET_SNAPS = [0.5, 0.7, 0.88] as const;

/**
 * Pick the sheet height in px.
 *   neededPx  everything the sheet wants to show without scrolling: top chrome +
 *             list + TOTAL + pinned footer + paddings. 0 = not measured yet.
 *   windowPx  window height.
 *   itemCount used only before measurement, so the first frame is already about
 *             the right size and the sheet does not visibly jump on open.
 * Returns the smallest snap that fits, or the largest snap (the list scrolls).
 */
export function pickSheetHeight(neededPx: number, windowPx: number, itemCount: number): number {
  const snaps = SHEET_SNAPS.map((f) => Math.round(f * windowPx));
  if (neededPx <= 0) {
    // Pre-measurement estimate by item count: one item fits the small snap,
    // two or three the middle, more needs the tall one and scrolls.
    return itemCount <= 1 ? snaps[0] : itemCount <= 3 ? snaps[1] : snaps[2];
  }
  return snaps.find((h) => h >= neededPx) ?? snaps[snaps.length - 1];
}
