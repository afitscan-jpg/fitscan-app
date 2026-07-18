// src/data/exercise-science.ts
//
// Hand-curated, evidence-based "Science notes" for the CORE movements that
// docs/exercise-dataset/comprehensive_exercise_database.md actually covers.
// Every figure below is lifted from that document (its comparative EMG table +
// the MET values in its JSON records + its clinical-safety section) and
// translated from the academic wording into plain, user-friendly takeaways.
//
// This is a deliberately SMALL, static map — we do NOT parse the essay at
// runtime. Only movements the document genuinely discusses appear here; we do
// not fabricate notes for anything else (e.g. the doc mentions squat/bench only
// as future research intent, with no data, so they are intentionally absent).

export interface ScienceNote {
  /** What the muscles are doing — activation focus in plain terms. */
  primaryActivation: string;
  /** One biomechanics takeaway (joint mechanics / loading / safety). */
  biomechanicsNote: string;
  /** Metabolic equivalent, when the document gives one. */
  metValue?: number;
  /** Optional practical, non-medical coaching cue. */
  tip?: string;
}

// Keyed by a canonical movement id. `getScienceNote()` maps a real exercise
// name onto one of these.
const NOTES: Record<string, ScienceNote> = {
  // Conventional Barbell Deadlift — EMG table + met_value 7.5 + spinal-safety section.
  deadlift: {
    primaryActivation:
      'Very high spinal erector engagement (~85%) with a strong hamstring pull (~70% biceps femoris).',
    biomechanicsNote:
      'It is a hip hinge with the bar in front of your shins, so lower-back shear is high — hold a neutral spine throughout.',
    metValue: 7.5,
    tip: 'Losing a neutral spine under load shifts force onto passive tissues (discs and ligaments). Brace hard and keep the bar close.',
  },

  // Hex-Bar / Trap-Bar Deadlift — EMG table (quad-biased) + spinal-shear comparison.
  trapBarDeadlift: {
    primaryActivation:
      'Shifts emphasis toward the quads (vastus lateralis ~65%, rectus femoris ~60%) versus the conventional pull.',
    biomechanicsNote:
      'Standing inside the bar centres the load over your ankles, shortening the moment arm and markedly reducing lower-back shear.',
    tip: 'A solid deadlift alternative when your lower back is sensitive or deconditioned.',
  },

  // Barbell Hip Thrust — EMG table (peak glute activation).
  hipThrust: {
    primaryActivation:
      'Produces superior peak glute-max activation, highest at full (terminal) hip extension.',
    biomechanicsNote:
      'Force is horizontal with minimal axial load on the spine, so it hits the glutes hard with low back stress.',
    tip: 'Pause and squeeze at the top, where glute tension is greatest.',
  },

  // Seated Leg Extension — EMG table (VMO) + met_value 3.0 + patellofemoral section.
  legExtension: {
    primaryActivation:
      'Isolates the quads, with the vastus medialis oblique (VMO) peaking in the final ~60° of extension.',
    biomechanicsNote:
      'Single-joint knee extension with the pelvis braced against the pad, so the spine is essentially unloaded.',
    metValue: 3.0,
    tip: 'Emphasise the top of the range to recruit the VMO and support healthy kneecap tracking.',
  },

  // Downward-Facing Dog — muscle profile + met_value 2.5 + shoulder-impingement section.
  downwardDog: {
    primaryActivation:
      'Lengthens the calves and hamstrings while the shoulders stabilise your bodyweight.',
    biomechanicsNote:
      'An overhead, weight-bearing position that needs active rotator-cuff and scapular control to keep the shoulder safe.',
    metValue: 2.5,
    tip: 'Rotate the shoulders outward and press the floor away to keep the shoulder joint centred.',
  },

  // Static Standing Hamstring Stretch — muscle profile + met_value 1.8.
  standingHamstringStretch: {
    primaryActivation:
      'Passive end-range lengthening of the hamstring group at the muscle–tendon junction.',
    biomechanicsNote:
      'A static stretch aimed at increasing hamstring length and compliance rather than producing force.',
    metValue: 1.8,
    tip: 'Ease into a gentle end-range and hold steadily — no bouncing.',
  },

  // Running — muscle profile + met_value 10.0 + cardiometabolic + overuse (~10%/week) notes.
  running: {
    primaryActivation:
      'A cyclic lower-body effort driven by the quads, glutes and calves.',
    biomechanicsNote:
      'A high-output aerobic activity (~10 METs) that also lowers blood pressure and supports cardiometabolic health.',
    metValue: 10.0,
    tip: 'Build mileage gradually — around 10% per week at most — to avoid overuse injury.',
  },
};

// Ordered name matchers — MOST SPECIFIC FIRST so "trap-bar deadlift" resolves to
// the hex-bar entry before the generic "deadlift" match catches it.
const MATCHERS: Array<{ key: keyof typeof NOTES & string; needles: string[] }> = [
  { key: 'trapBarDeadlift', needles: ['trap bar deadlift', 'trap-bar deadlift', 'hex bar deadlift', 'hex-bar deadlift'] },
  { key: 'deadlift', needles: ['deadlift'] },
  { key: 'hipThrust', needles: ['hip thrust'] },
  { key: 'legExtension', needles: ['leg extension'] },
  { key: 'downwardDog', needles: ['downward dog', 'downward facing dog', 'downward-facing dog', 'adho mukha svanasana'] },
  { key: 'standingHamstringStretch', needles: ['standing hamstring stretch', 'standing toe touch', 'toe touch stretch'] },
  { key: 'running', needles: ['running', 'jogging'] },
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Return the science note for an exercise name, or null if the doc doesn't cover it. */
export function getScienceNote(name: string | null | undefined): ScienceNote | null {
  if (!name) return null;
  const n = ` ${normalize(name)} `;
  for (const m of MATCHERS) {
    if (m.needles.some((needle) => n.includes(needle))) return NOTES[m.key];
  }
  return null;
}
