import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow } from '@/constants/theme';

const BENEFITS: Array<{ title: string; sub: string }> = [
  { title: 'Unlimited AI logging', sub: 'Log by text, voice or photo with no daily cap' },
  { title: 'Weekly insights', sub: 'An honest, anti-guilt readout of your week' },
  { title: 'Diet planner', sub: "Tomorrow's meals built around your goals and history" },
  { title: 'Everything in Free', sub: 'Barcode scanning, exercises and weight tracking stay free' },
];

export default function PremiumScreen() {
  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Icon name="chevL" color={C.ink} size={20} strokeWidth={2} />
          </Pressable>
          <Text style={s.headerTitle}>Premium</Text>
          <View style={s.backBtn} />
        </View>

        <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.heroIcon}>
            <Icon name="spark" color="#fff" size={26} strokeWidth={1.8} />
          </View>
          <Text style={s.hero}>Go unlimited with{'\n'}Calibreta Premium</Text>
          <Text style={s.heroSub}>
            Keep the AI logging, insights and planner working without limits — same honest,
            no-guilt app, just more of it.
          </Text>

          <View style={s.card}>
            {BENEFITS.map((b, i) => (
              <View key={b.title} style={[s.benefit, i === 0 && s.benefitFirst]}>
                <View style={s.check}>
                  <Icon name="check" color={C.greenInk} size={15} strokeWidth={2.6} />
                </View>
                <View style={s.benefitText}>
                  <Text style={s.benefitTitle}>{b.title}</Text>
                  <Text style={s.benefitSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.comingBtn}>
            <Text style={s.comingText}>Coming soon: subscribe</Text>
          </View>
          <Text style={s.footnote}>
            Subscriptions aren&apos;t live yet. Your free trial and daily free logs keep working
            in the meantime.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 20,
    color: C.ink,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 22, paddingBottom: 80, alignItems: 'center' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 16,
    ...Shadow.md,
  },
  hero: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 26,
    lineHeight: 31,
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  heroSub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14.5,
    color: C.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  card: {
    alignSelf: 'stretch',
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 18,
    ...Shadow.sm,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  benefitFirst: { paddingTop: 0, borderTopWidth: 0 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitText: { flex: 1, gap: 2, paddingBottom: 14 },
  benefitTitle: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.ink },
  benefitSub: { fontFamily: Fonts?.body ?? 'system', fontSize: 13, color: C.inkFaint, lineHeight: 19 },

  comingBtn: {
    alignSelf: 'stretch',
    backgroundColor: C.greenSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(76,124,99,0.22)',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  comingText: { fontFamily: Fonts?.bodySemi ?? 'system', fontSize: 15, fontWeight: '600', color: C.greenInk },
  footnote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkFaint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
