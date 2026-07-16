import React from 'react';
import { Circle, G, Path, Svg } from 'react-native-svg';

export type IconName =
  | 'leaf'
  | 'search'
  | 'check'
  | 'home'
  | 'plus'
  | 'scan'
  | 'news'
  | 'droplet'
  | 'spark'
  | 'arrow'
  | 'chevL'
  | 'box'
  | 'alert'
  | 'verified'
  | 'mic'
  | 'camera'
  | 'gear'
  | 'pencil'
  | 'refresh'
  | 'dumbbell';

interface IconProps {
  name: IconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, color = '#16241D', size = 22, strokeWidth = 1.75 }: IconProps) {
  const p: React.ComponentProps<typeof Path> = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (name) {
    case 'leaf':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M11 20c-4 0-8-3-8-8 0-5 4-9 9-9 4 0 7 2 8 5-1 6-5 12-12 12-1 0-2-.2-3-.6" {...p} />
          <Path d="M11 20c0-5 2-9 6-12" {...p} />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M21 21l-4-4" {...p} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M20 6L9 17l-5-5" {...p} />
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 11l9-8 9 8" {...p} />
          <Path d="M5 10v10h14V10" {...p} />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" {...p} />
        </Svg>
      );
    case 'scan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" {...p} />
        </Svg>
      );
    case 'news':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 19V6a2 2 0 0 1 2-2h13v15M6 17h13" {...p} />
          <Path d="M8 8h7M8 11h7" {...p} />
        </Svg>
      );
    case 'droplet':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" {...p} />
        </Svg>
      );
    case 'spark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" {...p} />
        </Svg>
      );
    case 'arrow':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 12h14M13 6l6 6-6 6" {...p} />
        </Svg>
      );
    case 'chevL':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M15 6l-6 6 6 6" {...p} />
        </Svg>
      );
    case 'box':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M21 8l-9-5-9 5 9 5 9-5z" {...p} />
          <Path d="M3 8v8l9 5 9-5V8" {...p} />
          <Path d="M12 13v8" {...p} />
        </Svg>
      );
    case 'alert':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 9v4M12 17h.01M10.3 4l-7 12a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0z" {...p} />
        </Svg>
      );
    case 'verified':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <G>
            <Path d="M12 2l2.4 1.8 3-.2 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3.2 16l1-2.8-1-2.8 2.4-1.8 1-2.8 3 .2z" {...p} />
            <Path d="M9 12l2 2 4-4" {...p} />
          </G>
        </Svg>
      );
    case 'mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" {...p} />
          <Path d="M19 10a7 7 0 0 1-14 0" {...p} />
          <Path d="M12 19v3" {...p} />
          <Path d="M9 22h6" {...p} />
        </Svg>
      );
    case 'camera':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...p} />
          <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'gear':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...p} />
        </Svg>
      );
    case 'pencil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" {...p} />
        </Svg>
      );
    case 'refresh':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M1 4v6h6" {...p} />
          <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" {...p} />
        </Svg>
      );
    case 'dumbbell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6.5 6.5l11 11" {...p} />
          <Path d="M21 21l-1.5-1.5M4.5 4.5L3 3" {...p} />
          <Path d="M18.5 15.5l3-3-3-3-3 3M8.5 5.5l-3 3 3 3 3-3" {...p} />
        </Svg>
      );
    default:
      return null;
  }
}
