// src/lib/partial-log.ts
// Honest reporting for meal logs that can only be written IN PART.
//
// Two surfaces log several rows at once and can legitimately write fewer than
// they show:
//   • the plan screen  — "idea" items have no verified numbers, so they are
//                        never written (a gap in OUR database),
//   • the photo sheet  — an individual insert can fail on a flaky connection
//                        (a transient save failure, nothing to do with the food).
//
// Both used to log a subset and then report a flat "Logged ✓", which is a lie of
// omission: the user believes the whole meal is on their diary. This module gives
// both a shared vocabulary so the button says what it will do BEFORE the tap and
// the result says what actually happened AFTER it.
//
// Brand rule (Balance, not guilt): a skipped item is always OUR gap or OUR
// failure. None of this copy blames the user or implies they logged wrong.

/**
 * Why an item the user could see was not written.
 *   gap         — no verified numbers exist for it yet (plan "idea" items)
 *   unavailable — the lookup itself failed, so we don't know if we have it
 *   failed      — we have the numbers, but this row didn't save (network/server)
 */
export type SkipReason = 'gap' | 'unavailable' | 'failed';

export interface SkippedItem {
  name: string;
  reason: SkipReason;
}

export interface PartialLogResult {
  /** Names actually written to the diary. */
  logged: string[];
  /** Everything shown but not written, with the reason it wasn't. */
  skipped: SkippedItem[];
}

// Tail clause per reason. Each explains OUR limitation; none scolds.
const REASON_TAIL: Record<SkipReason, string> = {
  gap: 'not in our database yet',
  unavailable: "couldn't check just now",
  // No retry hint here: the button itself switches to "Retry N items", and a
  // second em-dash inside this clause reads badly next to the leading one.
  failed: "didn't save yet",
};

// Reported in this order so the most actionable reason reads first.
const REASON_ORDER: SkipReason[] = ['failed', 'unavailable', 'gap'];

/**
 * Join names for display: at most two, then "+N more", so the line stays one
 * or two rows on a small screen instead of growing without bound.
 */
export function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

/**
 * Label for the log button, decided BEFORE the tap so the count is never a
 * surprise. `loggable` is how many items carry numbers we can actually write.
 *
 *   3 of 3 → "Log this meal"
 *   1 of 2 → "Log 1 of 2 items"
 *   0 of 2 → "Nothing to log yet"   (caller should disable the button)
 */
export function logButtonLabel(
  loggable: number,
  total: number,
  allLabel = 'Log this meal',
): string {
  if (total <= 0 || loggable <= 0) return 'Nothing to log yet';
  if (loggable >= total) return allLabel;
  return `Log ${loggable} of ${total} items`;
}

/**
 * One sentence describing what actually happened, or null when everything the
 * user saw was written (the caller then shows its plain "Logged" state).
 *
 *   logged [Dahi], skipped [Khichdi/gap]
 *     → "Logged Dahi · Khichdi not counted — not in our database yet"
 *   logged [], skipped [Khichdi/gap]
 *     → "Nothing logged · Khichdi not counted — not in our database yet"
 */
export function partialLogSummary(result: PartialLogResult): string | null {
  if (result.skipped.length === 0) return null;

  const parts: string[] = [
    result.logged.length > 0 ? `Logged ${joinNames(result.logged)}` : 'Nothing logged',
  ];

  for (const reason of REASON_ORDER) {
    const names = result.skipped.filter((s) => s.reason === reason).map((s) => s.name);
    if (names.length > 0) {
      parts.push(`${joinNames(names)} not counted — ${REASON_TAIL[reason]}`);
    }
  }

  return parts.join(' · ');
}

/** True when at least one row failed to save, so a retry is worth offering. */
export function hasRetryableFailure(result: PartialLogResult): boolean {
  return result.skipped.some((s) => s.reason === 'failed');
}

/**
 * Write every item independently and report per-item outcomes.
 *
 * Uses allSettled deliberately: with Promise.all a single rejection leaves the
 * already-written rows in the diary while the caller reports total failure, so a
 * retry duplicates everything that succeeded. Here a partial write is a first-
 * class result — the caller can report it honestly and retry ONLY `skipped`.
 *
 * Never rejects.
 */
export async function logAllSettled<T>(
  items: readonly T[],
  write: (item: T) => Promise<unknown>,
  nameOf: (item: T) => string,
): Promise<PartialLogResult & { failedItems: T[] }> {
  const settled = await Promise.allSettled(items.map((item) => write(item)));

  const logged: string[] = [];
  const skipped: SkippedItem[] = [];
  const failedItems: T[] = [];

  settled.forEach((outcome, i) => {
    const item = items[i];
    if (outcome.status === 'fulfilled') {
      logged.push(nameOf(item));
    } else {
      skipped.push({ name: nameOf(item), reason: 'failed' });
      failedItems.push(item);
    }
  });

  return { logged, skipped, failedItems };
}
