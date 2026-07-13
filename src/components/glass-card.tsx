import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { C, Gradients, Radius, Shadow } from '@/constants/theme';

/**
 * The design's signature surface: a translucent-white gradient over the dark
 * background, a 1px light border, and a deep soft shadow. `style` positions the
 * card (margins); `contentStyle` pads its inner content.
 */
export function GlassCard({
  style,
  contentStyle,
  colors = Gradients.glass,
  radius = Radius.xl,
  borderColor = C.cardBorder,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  colors?: readonly [string, string, ...string[]];
  radius?: number;
  borderColor?: string;
  children?: ReactNode;
}) {
  return (
    <View style={[{ borderRadius: radius }, Shadow.md, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[{ borderRadius: radius, borderWidth: 1, borderColor, overflow: 'hidden' }, contentStyle]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
