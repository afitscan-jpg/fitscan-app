import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { AnimatedPressable } from '@/components/animated-pressable';
import { SkeletonPulse } from '@/components/skeleton-pulse';
import { Icon } from '@/components/Icon';
import { C, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────

type CategoryKey = 'all' | 'nutrition' | 'fitness' | 'research' | 'safety' | 'general';

interface Article {
  id: string;
  source: string;
  source_verified: boolean;
  url: string;
  title: string;
  summary: string | null;
  category: Exclude<CategoryKey, 'all'>;
  image_url: string | null;
  published_at: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: 'all',       label: 'All' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'fitness',   label: 'Fitness' },
  { key: 'research',  label: 'Research' },
  { key: 'safety',    label: 'Safety' },
  { key: 'general',   label: 'General' },
];

const TAG_STYLE: Record<Exclude<CategoryKey, 'all'>, { bg: string; color: string }> = {
  nutrition: { bg: C.greenSoft,               color: C.greenInk },
  fitness:   { bg: '#E9EFF3',                 color: '#3C6B8C' },
  safety:    { bg: C.amberSoft,               color: C.amberInk },
  research:  { bg: '#ECEAF2',                 color: '#5B4B86' },
  general:   { bg: 'rgba(74,58,34,0.06)',     color: C.inkSoft },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <SkeletonPulse style={sk.card}>
      <View style={sk.row}>
        <View style={sk.chip} />
        <View style={sk.timeChip} />
      </View>
      <View style={sk.lineL} />
      <View style={sk.lineM} />
      <View style={sk.lineS} />
    </SkeletonPulse>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    padding: 15,
    gap: 10,
    ...Shadow.sm,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between' },
  chip:     { height: 11, width: 80,    borderRadius: 6, backgroundColor: C.line },
  timeChip: { height: 11, width: 30,    borderRadius: 6, backgroundColor: C.line },
  lineL:    { height: 13, width: '90%', borderRadius: 6, backgroundColor: C.line },
  lineM:    { height: 13, width: '70%', borderRadius: 6, backgroundColor: C.line },
  lineS:    { height: 11, width: '55%', borderRadius: 6, backgroundColor: C.line },
});

// ─── Article card ──────────────────────────────────────────────────────────────

function NewsCard({ article }: { article: Article }) {
  const tag = TAG_STYLE[article.category] ?? TAG_STYLE.general;

  return (
    <AnimatedPressable style={nc.card} onPress={() => Linking.openURL(article.url)}>
      {article.image_url ? (
        <View style={nc.imageWrap}>
          <Image source={{ uri: article.image_url }} style={nc.image} resizeMode="cover" />
        </View>
      ) : null}
      <View style={nc.content}>
        <View style={nc.top}>
          <View style={nc.source}>
            <Text style={nc.sourceName}>{article.source}</Text>
            {article.source_verified && (
              <Icon name="verified" color={C.green} size={12} strokeWidth={2} />
            )}
          </View>
          <Text style={nc.time}>{relativeTime(article.published_at)}</Text>
        </View>
        <Text style={nc.headline}>{article.title}</Text>
        {article.summary ? (
          <Text style={nc.summary} numberOfLines={3}>{article.summary}</Text>
        ) : null}
        <View style={nc.foot}>
          <View style={[nc.tag, { backgroundColor: tag.bg }]}>
            <Text style={[nc.tagText, { color: tag.color }]}>
              {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const nc = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: Radius.xl,
    ...Shadow.md,
  },
  imageWrap: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 15,
    paddingTop: 14,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sourceName: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 12,
    fontWeight: '600',
    color: C.greenInk,
    letterSpacing: 0.2,
  },
  time: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkSoft,
  },
  headline: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    lineHeight: 21,
  },
  summary: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 13.5,
    color: C.inkSoft,
    marginTop: 5,
    lineHeight: 20,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function NewsScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const fetchNews = useCallback(async (category: CategoryKey, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(false);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error('No API URL configured');
      let url = `${apiUrl}/news?limit=30`;
      if (category !== 'all') url += `&category=${category}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data: { articles: Article[] } = await res.json();
      setArticles(data.articles ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  function handleRefresh() {
    setRefreshing(true);
    fetchNews(activeCategory, true);
  }

  return (
    <View style={s.root}>
      <AmbientBackground />
      <SafeAreaView style={s.flex} edges={['top']}>
        <View style={s.header}>
          <Text style={s.eyebrow}>Worldwide · updated hourly</Text>
          <Text style={s.title}>Health news</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
          style={s.catScroll}
        >
          {CATEGORIES.map((cat) => (
            <AnimatedPressable
              key={cat.key}
              style={[s.catPill, activeCategory === cat.key && s.catPillOn]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <Text style={[s.catLabel, activeCategory === cat.key && s.catLabelOn]}>
                {cat.label}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.articles}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.green}
              colors={[C.green]}
            />
          }
        >
          {loading && !refreshing ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.emptyTitle}>Couldn't load news</Text>
              <Text style={s.emptySub}>Pull down to refresh.</Text>
            </View>
          ) : articles.length === 0 ? (
            <View style={s.center}>
              <Text style={s.emptyTitle}>No articles yet</Text>
              <Text style={s.emptySub}>Check back soon — feeds update every few hours.</Text>
            </View>
          ) : (
            <>
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
              <Text style={s.footnote}>
                Curated from credible sources — WHO, FSSAI, peer-reviewed journals.{'\n'}No
                clickbait, no fear-mongering.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: C.inkSoft,
  },
  title: {
    fontFamily: Fonts?.display ?? 'system',
    fontSize: 22,
    color: C.ink,
    marginTop: 2,
  },

  catScroll: { flexGrow: 0 },
  catRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 7,
    flexDirection: 'row',
  },
  catPill: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    ...Shadow.sm,
  },
  catPillOn: { backgroundColor: C.accent, borderColor: C.accent },
  catLabel: {
    fontFamily: Fonts?.bodyMed ?? 'system',
    fontSize: 13,
    fontWeight: '500',
    color: C.inkSoft,
  },
  catLabelOn: { color: '#FFFFFF', fontWeight: '600' },

  articles: {
    paddingHorizontal: 22,
    paddingBottom: 60,
    gap: 11,
  },

  center: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: Fonts?.bodySemi ?? 'system',
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 14,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 6,
  },

  footnote: {
    fontFamily: Fonts?.body ?? 'system',
    fontSize: 12,
    color: C.inkSoft,
    textAlign: 'center',
    paddingTop: 4,
    lineHeight: 18,
  },
});
