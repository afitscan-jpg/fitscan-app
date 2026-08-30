import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';
import type { PaywallError } from '@/lib/api';

// Friendly name for the premium feature that was gated.
function featureLabel(feature?: string): string {
  if (feature === 'insights') return 'Weekly insights';
  if (feature === 'planner') return 'The diet planner';
  return 'This feature';
}

/**
 * Bottom sheet shown when a PaywallError is caught. Controlled by the parent:
 * pass the caught error (or null to hide). "Go Premium" routes to the premium
 * screen; no purchase is faked here (real billing is Phase 3).
 */
export function PaywallSheet({
  error,
  onClose,
}: {
  error: PaywallError | null;
  onClose: () => void;
}) {
  const visible = error != null;
  const mode = error?.kind ?? 'limit';

  const title =
    mode === 'limit' ? "You've used today's 3 free AI logs" : 'Premium feature';
  const body =
    mode === 'limit'
      ? 'Resets tomorrow — or go unlimited with Premium.'
      : `${featureLabel(error?.info.feature)} is part of Premium — unlimited AI logging, weekly insights, and your diet planner.`;

  function goPremium() {
    onClose();
    router.push('/premium' as never);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => undefined}>
          <View style={s.handle} />

          <View style={s.iconWrap}>
            <Icon name="spark" color={C.greenInk} size={22} strokeWidth={1.8} />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>

          <Pressable style={s.primary} onPress={goPremium}>
            <Text style={s.primaryText}>Go Premium →</Text>
          </Pressable>
          <Pressable style={s.secondary} onPress={onClose} hitSlop={8}>
            <Text style={s.secondaryText}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    alignItems: 'center',
    ...Shadow.lg,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 18 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.greenSoft,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 20,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  body: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14.5,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: C.green,
    borderRadius: Radius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  primaryText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: '#fff' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 14, fontWeight: '600', color: C.inkSoft },
});
