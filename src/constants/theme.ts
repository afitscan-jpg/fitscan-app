import '@/global.css';
import { Platform } from 'react-native';

// ─── FitScan design tokens — premium-minimal direction ───────────────────────

export const C = {
  // Core ink / text
  ink:      '#16241D',
  inkSoft:  '#54635B',
  inkFaint: '#8A968F',

  // Backgrounds
  bg:   '#F4EFE6',
  card: '#FFFFFF',
  line: '#ECE5D8',

  // Brand green
  green:    '#2F7D5B',
  greenSoft:'#E6F0EA',
  greenInk: '#1C5640',   // also called greenDeep in premium.html

  // Amber / warning
  amber:    '#C9852F',
  amberSoft:'#F6ECD9',
  amberInk: '#7A4E14',

  // Red / avoid
  red:    '#C0463C',
  redSoft:'#F7E6E3',
  redInk: '#7C271F',

  // Marigold (AI accent)
  marigold: '#E69138',

  // Water / teal
  waterBlue:    '#54AEC2',
  waterBlueSoft:'#EAF4F7',
  waterBlueInk: '#1F6B7E',
} as const;

// ─── Depth shadows (premium-minimal: soft, layered, low opacity) ─────────────
// React Native shadows: iOS uses shadow* props; Android uses elevation.
// Outer array = first/secondary layer approximated by a single shadow per platform.

export const Shadow = {
  sm: Platform.select({
    ios:     { shadowColor: '#16241D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios:     { shadowColor: '#16241D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 14 },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios:     { shadowColor: '#16241D', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24 },
    android: { elevation: 12 },
    default: {},
  }),
  dark: Platform.select({
    ios:     { shadowColor: '#0c1a14', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.34, shadowRadius: 20 },
    android: { elevation: 16 },
    default: {},
  }),
} as const;

// ─── Ring gradient stops ──────────────────────────────────────────────────────
export const RingGradient = {
  from: '#2F7D5B',  // green
  to:   '#54AEC2',  // teal
} as const;

// ─── Legacy Colors (kept for existing components) ────────────────────────────

export const Colors = {
  light: {
    text: C.ink,
    background: C.bg,
    backgroundElement: '#E7E0D3',
    backgroundSelected: '#DDD5C8',
    textSecondary: C.inkSoft,
  },
  dark: {
    text: C.ink,
    background: C.bg,
    backgroundElement: '#E7E0D3',
    backgroundSelected: '#DDD5C8',
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
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
