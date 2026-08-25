import React from 'react';
import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';

/**
 * CalibretaIcon (CIcon) — the branded 14-icon feature set, drawn to the U1 dial
 * geometry: 24-unit grid, consistent stroke, rounded caps/joins, C.green by
 * default. Each icon has a rest (outline) and an active (filled) state.
 *
 * This is separate from the generic Icon.tsx chrome set (chevrons, arrows,
 * checks…) which stays as-is. Only feature call sites use CIcon.
 *
 * Micro-animations (droplet wobble, flame flicker, needle sweep) are deliberately
 * OUT OF SCOPE this pass — static rest/active only; see the icon-motion follow-up.
 */
export type CIconName =
  | 'home'
  | 'mealLog'
  | 'water'
  | 'workout'
  | 'weight'
  | 'measurements'   // UNWIRED by design — no screen yet; kept for a future body-measurements feature
  | 'progressPhotos'
  | 'barcodeScan'
  | 'aiAssistant'
  | 'mealPlan'       // UNWIRED by design — plan.tsx has no feature-icon slot yet
  | 'insights'       // wired to the Home weekly AI-insight card
  | 'streak'
  | 'news'
  | 'settings';

interface CIconProps {
  name: CIconName;
  active?: boolean;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function CIcon({
  name,
  active = false,
  color = '#4C7C63',
  size = 24,
  strokeWidth = 1.9,
}: CIconProps) {
  // Rest stroke props / active fill props. Active internal cut-outs use the
  // even-odd fill rule so they read as transparent holes on any background.
  const s = {
    stroke: color,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const fillOnly = { fill: color };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph(name, active, s, fillOnly, color, strokeWidth)}
    </Svg>
  );
}

type StrokeProps = {
  stroke: string; strokeWidth: number; fill: 'none';
  strokeLinecap: 'round'; strokeLinejoin: 'round';
};

function glyph(
  name: CIconName,
  active: boolean,
  s: StrokeProps,
  f: { fill: string },
  color: string,
  sw: number,
) {
  switch (name) {
    // ── home ──────────────────────────────────────────────────────────────
    case 'home':
      return active ? (
        <Path {...f} d="M12 3 21 11.5H18V21H14V15H10V21H6V11.5H3Z" />
      ) : (
        <>
          <Path d="M3.5 11.5 12 4l8.5 7.5" {...s} />
          <Path d="M6 10.5V20h12v-9.5" {...s} />
          <Path d="M10 20v-5.5h4V20" {...s} />
        </>
      );

    // ── meal log (bowl + steam) ───────────────────────────────────────────
    case 'mealLog':
      return (
        <>
          {active ? (
            <Path {...f} d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
          ) : (
            <Path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" {...s} />
          )}
          <Path d="M9 3.6c0 1.2 1 1.2 1 2.4M12 3c0 1.2 1 1.2 1 2.4M15 3.6c0 1.2 1 1.2 1 2.4" {...s} />
        </>
      );

    // ── water (droplet) ───────────────────────────────────────────────────
    case 'water': {
      const d = 'M12 3.5c0 0-6.5 6.5-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3.5 12 3.5z';
      return active ? <Path {...f} d={d} /> : <Path d={d} {...s} />;
    }

    // ── workout (dumbbell) ────────────────────────────────────────────────
    case 'workout':
      return active ? (
        <>
          <Rect x={2.5} y={9.5} width={2.6} height={5} rx={1} {...f} />
          <Rect x={5.4} y={7.8} width={2.6} height={8.4} rx={1.2} {...f} />
          <Rect x={16} y={7.8} width={2.6} height={8.4} rx={1.2} {...f} />
          <Rect x={18.9} y={9.5} width={2.6} height={5} rx={1} {...f} />
          <Path d="M8 12h8" stroke={color} strokeWidth={sw + 0.4} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Rect x={2.5} y={9.5} width={2.6} height={5} rx={1} {...s} />
          <Rect x={5.4} y={7.8} width={2.6} height={8.4} rx={1.2} {...s} />
          <Path d="M8 12h8" {...s} />
          <Rect x={16} y={7.8} width={2.6} height={8.4} rx={1.2} {...s} />
          <Rect x={18.9} y={9.5} width={2.6} height={5} rx={1} {...s} />
        </>
      );

    // ── weight (bathroom scale: rounded body + gauge dial & needle, echoing
    //    the U1 mark) ───────────────────────────────────────────────────────
    case 'weight':
      return active ? (
        <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4.5} {...f} />
          <Path d="M8 14.5A4 4 0 0 1 16 14.5" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Path d="M12 14.5 9.6 11.6" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Circle cx={12} cy={14.5} r={1.15} fill="#FFFFFF" />
        </>
      ) : (
        <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4.5} {...s} />
          <Path d="M8 14.5A4 4 0 0 1 16 14.5" {...s} />
          <Path d="M12 14.5 9.6 11.6" {...s} />
          <Circle cx={12} cy={14.5} r={1.15} fill={color} />
        </>
      );

    // ── measurements (ruler) ──────────────────────────────────────────────
    case 'measurements':
      return active ? (
        <>
          <Rect x={3} y={8.5} width={18} height={7} rx={1.5} {...f} />
          <Path d="M6.5 8.5v3.6M10 8.5v2.4M13.5 8.5v3.6M17 8.5v2.4" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Rect x={3} y={8.5} width={18} height={7} rx={1.5} {...s} />
          <Path d="M6.5 8.5v3.6M10 8.5v2.4M13.5 8.5v3.6M17 8.5v2.4" {...s} />
        </>
      );

    // ── progress photos (camera, lens = even-odd hole when active) ────────
    case 'progressPhotos': {
      const body = 'M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z';
      return active ? (
        <>
          <Path {...f} d={body} />
          <Circle cx={12} cy={13.5} r={3.6} fill="#FFFFFF" />
          <Circle cx={12} cy={13.5} r={1.9} fill={color} />
        </>
      ) : (
        <>
          <Path d={body} {...s} />
          <Circle cx={12} cy={13.5} r={3.6} {...s} />
        </>
      );
    }

    // ── barcode scan (frame corners + bars) ───────────────────────────────
    case 'barcodeScan':
      return active ? (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={5} {...f} />
          <Path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...s} />
          <Path d="M8 9.5v5M11 9.5v5M14 9.5v5M16.5 9.5v5" {...s} />
        </>
      );

    // ── AI assistant (sparkle) ────────────────────────────────────────────
    case 'aiAssistant': {
      const star = 'M12 3c.5 5 1 5.5 6 6-5 .5-5.5 1-6 6-.5-5-1-5.5-6-6 5-.5 5.5-1 6-6z';
      const spark = 'M18.5 14.5c.2 1.9.4 2.1 2.3 2.3-1.9.2-2.1.4-2.3 2.3-.2-1.9-.4-2.1-2.3-2.3 1.9-.2 2.1-.4 2.3-2.3z';
      return active ? (
        <>
          <Path {...f} d={star} />
          <Path {...f} d={spark} />
        </>
      ) : (
        <>
          <Path d={star} {...s} />
          <Path d={spark} {...s} />
        </>
      );
    }

    // ── meal plan (calendar + check) ──────────────────────────────────────
    case 'mealPlan':
      return active ? (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...f} />
          <Path d="M8 3.5v3M16 3.5v3" {...s} />
          <Path d="M3.5 9.5h17" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Path d="M8.5 14.5 11 17l4.5-4.5" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      ) : (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...s} />
          <Path d="M3.5 9.5h17" {...s} />
          <Path d="M8 3.5v3M16 3.5v3" {...s} />
          <Path d="M8.5 14.5 11 17l4.5-4.5" {...s} />
        </>
      );

    // ── insights (bar chart) ──────────────────────────────────────────────
    case 'insights':
      return active ? (
        <>
          <Rect x={5.5} y={11} width={3.4} height={7} rx={1.2} {...f} />
          <Rect x={10.3} y={7} width={3.4} height={11} rx={1.2} {...f} />
          <Rect x={15.1} y={13.5} width={3.4} height={4.5} rx={1.2} {...f} />
          <Path d="M4 20.5h16" {...s} />
        </>
      ) : (
        <>
          <Path d="M4 20.5h16" {...s} />
          <Rect x={5.5} y={11} width={3.4} height={7} rx={1.2} {...s} />
          <Rect x={10.3} y={7} width={3.4} height={11} rx={1.2} {...s} />
          <Rect x={15.1} y={13.5} width={3.4} height={4.5} rx={1.2} {...s} />
        </>
      );

    // ── streak (flame) ────────────────────────────────────────────────────
    case 'streak': {
      // Asymmetric flicked tip + wide base — unmistakably fire, not a droplet.
      const flame = 'M13.2 2c-0.4 2.7-2.2 4.2-3.8 5.9C7.8 9.5 6 11.4 6 14.2a6 6 0 0 0 12 0c0-2.4-1.2-4.2-2.6-5.6-0.2 1.6-1.1 2.4-2.2 2.6C12 6.9 13.7 4.9 13.2 2z';
      return active ? <Path {...f} d={flame} /> : <Path d={flame} {...s} />;
    }

    // ── news (newspaper) ──────────────────────────────────────────────────
    case 'news':
      return active ? (
        <>
          <Path {...f} d="M4 6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H7a3 3 0 0 1-3-3z" />
          <Path d="M7 9.5h6M7 12.5h6M7 15.5h4" stroke="#FFFFFF" strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Rect x={14.5} y={9.5} width={2.5} height={2.5} rx={0.6} fill="#FFFFFF" />
        </>
      ) : (
        <>
          <Path d="M4 6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H7a3 3 0 0 1-3-3z" {...s} />
          <Path d="M7 9.5h6M7 12.5h6M7 15.5h4" {...s} />
          <Rect x={14.5} y={9.5} width={2.5} height={2.5} rx={0.6} {...s} />
        </>
      );

    // ── settings (calibration sliders — thematic to the dial) ─────────────
    case 'settings':
      return active ? (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={17} x2={20} y2={17} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={16} cy={7} r={2.6} {...f} />
          <Circle cx={9} cy={12} r={2.6} {...f} />
          <Circle cx={15} cy={17} r={2.6} {...f} />
        </>
      ) : (
        <>
          <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={17} x2={20} y2={17} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={16} cy={7} r={2.6} fill="#FAF8F4" stroke={color} strokeWidth={sw} />
          <Circle cx={9} cy={12} r={2.6} fill="#FAF8F4" stroke={color} strokeWidth={sw} />
          <Circle cx={15} cy={17} r={2.6} fill="#FAF8F4" stroke={color} strokeWidth={sw} />
        </>
      );

    default:
      return null;
  }
}
