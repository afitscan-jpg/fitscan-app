// src/lib/bottom-right-action.ts
// Who owns the bottom-right corner right now?
//
// The assistant FAB is rendered once, at the app root, bottom-right. Some
// screens put their own control there: Progress Photos' "+ add photo", the
// scan result's pinned "Log this / Scan next" row, the exercise page's "Log this
// exercise" bar. Twice now the FAB has landed on top of one of them, and the
// first fix was a per-screen offset keyed on the pathname — which is how the
// second one happened.
//
// This is the class fix. A screen that places a control at the bottom edge
// wraps it in <ReservedBottomAction>; that reports the control's TOP edge, in
// window coordinates, here. The FAB reads the highest reservation and sits a
// fixed gap above it. No screen knows about the FAB, and the FAB knows no
// screen names.
//
// Window coordinates on purpose: screens inside the tab navigator measure
// "bottom" from the top of the dock, the FAB from the bottom of the window, and
// a screen pushed over the dock measures from somewhere else again. A measured
// top edge needs none of that to be known.

type Listener = () => void;

const reservations = new Map<string, number>();   // id -> top edge, window y
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // a listener must never break the registry
    }
  });
}

export function setBottomRightReservation(id: string, topY: number | null): void {
  const before = reservations.get(id);
  if (topY == null) {
    if (!reservations.delete(id)) return;
  } else {
    if (before === topY) return;
    reservations.set(id, topY);
  }
  notify();
}

/** The highest (smallest y) reserved top edge, or null when nothing is reserved. */
export function highestBottomRightReservation(): number | null {
  let top: number | null = null;
  reservations.forEach((y) => {
    if (top == null || y < top) top = y;
  });
  return top;
}

export function subscribeBottomRight(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
