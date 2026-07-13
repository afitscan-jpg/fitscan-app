import '@/global.css';
import { Platform } from 'react-native';

// ─── FitScan design tokens — PREMIUM v3 (light / warm) direction ───────────────
// Extracted from design/premium-v3/FitScan Premium v3.dc.html.
// v3 flips the palette back to a light, warm wellness look: a cream ambient
// background, solid white cards with warm borders/shadows, and a sage-green
// accent with a mix-derived deep/tint system (the html's CSS-var scheme):
//   accent      = #4C7C63  (the html's DEFAULT `accent` prop)
//   accentDeep  = mix(accent, #000,     0.24) = #3A5E4B
//   accentTint  = mix(accent, #FAF8F4,  0.90) = #E9ECE6
// Token NAMES are preserved so every screen inherits the flip; the green/greenSoft
// /greenInk trio is aliased to accent/accentTint/accentDeep for back-compat.

// Accent trio — the single source of truth (no in-app switcher this pass).
const ACCENT      = '#4C7C63';
const ACCENT_DEEP = '#3A5E4B';
const ACCENT_TINT = '#E9ECE6';

export const C = {
  // Core ink / text (dark-on-light)
  ink:      '#2B2822',   // primary body text / headings
  inkSoft:  '#79726A',   // secondary body
  inkFaint: '#A79F91',   // muted labels / eyebrows

  // Backgrounds
  bg:   '#FAF8F4',       // warm cream app background
  card: '#FFFFFF',       // solid card surface
  line: 'rgba(74,58,34,0.09)',

  // Brand green (accent) — aliases to the accent trio
  green:    ACCENT,
  greenSoft: ACCENT_TINT,   // tint chip / fill background
  greenInk: ACCENT_DEEP,    // accent text on tint chips/fills

  // Amber / energy
  amber:    '#B98438',
  amberSoft:'#F4EDE0',
  amberInk: '#8A5E28',

  // Red / avoid
  red:    '#C4553D',
  redSoft:'rgba(196,85,61,0.12)',
  redInk: '#A8452F',

  // Marigold (AI accent)
  marigold: '#B98438',

  // Water / blue
  waterBlue:    '#5C86A6',
  waterBlueSoft:'#E9EFF3',
  waterBlueInk: '#3C6B8C',

  // ── v3 system tokens ────────────────────────────────────────────────────────
  inkStrong: '#2B2822',  // strong headings (same ink; kept as a distinct name)
  inkDim:    '#ACA597',  // faintest (nav inactive, disabled, axis labels)
  bgElev:    '#FFFFFF',  // elevated surface
  ambientTop:'#FCF6EC',  // morning-light wash (top)
  ambientMid:'#FAF6EF',
  ambientBot:'#F5EFE4',  // morning-light wash (bottom)
  // Card gradient (near-white warm) + warm border/hairline
  cardTop:   '#FFFFFF',
  cardBot:   '#FCFAF6',
  cardBorder:'rgba(74,58,34,0.07)',
  hairline:  'rgba(74,58,34,0.06)',

  // Accent trio exposed as tokens too
  accent:     ACCENT,
  accentDeep: ACCENT_DEEP,
  accentTint: ACCENT_TINT,

  mint:      ACCENT,     // primary accent dot/glow (name kept)
  greenDeep: ACCENT_DEEP,
  greenMid:  ACCENT,
  teal:      '#5C86A6',
  tealDeep:  '#3C6B8C',
  waterLight:'#9CC0D8',
  amberLight:'#B98438',
  amberText: '#8A5E28',

  // Macro accents (mini rings + meal rows) — v3 uses one set
  macroP:   ACCENT,
  macroC:   '#B98438',
  macroF:   '#5C86A6',
  mealP:    ACCENT,
  mealC:    '#B98438',
  mealF:    '#5C86A6',
} as const;

// ─── Depth shadows (warm soft brown, matching v3's rgba(74,58,34,…)) ──────────
export const Shadow = {
  sm: Platform.select({
    ios:     { shadowColor: '#4A3A22', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 20 },
    android: { elevation: 3 },
    default: {},
  }),
  md: Platform.select({
    ios:     { shadowColor: '#4A3A22', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.14, shadowRadius: 30 },
    android: { elevation: 8 },
    default: {},
  }),
  lg: Platform.select({
    ios:     { shadowColor: '#4A3A22', shadowOffset: { width: 0, height: 26 }, shadowOpacity: 0.18, shadowRadius: 44 },
    android: { elevation: 14 },
    default: {},
  }),
  dark: Platform.select({
    ios:     { shadowColor: '#4A3A22', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.16, shadowRadius: 40 },
    android: { elevation: 10 },
    default: {},
  }),
} as const;

// ─── Ring gradient stops (gentle deep-green sweep on the solid accent) ─────────
export const RingGradient = {
  from: '#5B9075',
  mid:  ACCENT,
  to:   ACCENT_DEEP,
} as const;

// Common linear-gradient color arrays for expo-linear-gradient
export const Gradients = {
  glass:   ['#FFFFFF', '#FCFAF6'] as const,
  greenTeal: [ACCENT, ACCENT_DEEP] as const,   // FAB / primary
  greenDeep: [ACCENT, ACCENT_DEEP] as const,
  water:   ['#9CC0D8', '#6E9CBC'] as const,
  amber:   ['#C79A5A', '#B98438'] as const,
  ambient: ['#FCF6EC', '#FAF8F4', '#F5EFE4'] as const,
  coach:   ['#F4F6EE', '#FBFAF5'] as const,    // AI-coach card wash
} as const;

// ─── Legacy Colors (kept for template components; now light/warm) ─────────────
export const Colors = {
  light: {
    text: C.ink,
    background: C.bg,
    backgroundElement: '#F1EFEA',
    backgroundSelected: ACCENT_TINT,
    textSecondary: C.inkSoft,
  },
  dark: {
    text: C.ink,
    background: C.bg,
    backgroundElement: '#F1EFEA',
    backgroundSelected: ACCENT_TINT,
    textSecondary: C.inkSoft,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    display:    'BricolageGrotesque-Bold',
    displaySemi:'BricolageGrotesque-SemiBold',
    displayMed: 'BricolageGrotesque-Medium',
    body:       'Inter-Regular',
    bodyMed:    'Inter-Medium',
    bodySemi:   'Inter-SemiBold',
    sans:   'system-ui',
    serif:  'ui-serif',
    rounded:'ui-rounded',
    mono:   'ui-monospace',
  },
  default: {
    display:    'BricolageGrotesque-Bold',
    displaySemi:'BricolageGrotesque-SemiBold',
    displayMed: 'BricolageGrotesque-Medium',
    body:       'Inter-Regular',
    bodyMed:    'Inter-Medium',
    bodySemi:   'Inter-SemiBold',
    sans:   'normal',
    serif:  'serif',
    rounded:'normal',
    mono:   'monospace',
  },
  web: {
    display:    'BricolageGrotesque-Bold',
    displaySemi:'BricolageGrotesque-SemiBold',
    displayMed: 'BricolageGrotesque-Medium',
    body:       'Inter-Regular',
    bodyMed:    'Inter-Medium',
    bodySemi:   'Inter-SemiBold',
    sans:   'var(--font-display)',
    serif:  'var(--font-serif)',
    rounded:'var(--font-rounded)',
    mono:   'var(--font-mono)',
  },
});

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one:  4,
  two:  8,
  three:16,
  four: 24,
  five: 32,
  six:  64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
