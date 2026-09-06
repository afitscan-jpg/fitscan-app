// Country default detection for onboarding.
//
// Use the device REGION (Settings → Language & Region → Region), NEVER the
// language. expo-localization's `Locale.regionCode` is that region setting;
// `Locale.languageRegionCode` is the language's region (`en-GB` → `GB`) and is
// deliberately ignored — reading it is what made an Indian phone whose system
// language is English (UK) preselect the United Kingdom.
//
// `regionIsTrustworthy` says whether the region signal is actually independent of
// language on this platform. It is on iOS and Android 13+ (Regional preferences);
// on Android < 13 there is no separate region — `regionCode` is derived from the
// locale, so `en-GB` yields `GB` regardless of where the user is. There we do NOT
// trust it at all: default straight to India (we're India-first; the user can
// change it). When trusted, scan every preferred locale for a supported region,
// then fall back to India — never to a language-derived region.

export interface RegionLocale {
  regionCode?: string | null;
  // `languageRegionCode` is intentionally NOT part of this shape — do not read it.
}

export function pickCountry(
  locales: ReadonlyArray<RegionLocale> | null | undefined,
  supported: ReadonlySet<string>,
  regionIsTrustworthy: boolean,
  fallback = 'IN',
): string {
  if (!regionIsTrustworthy) return fallback;
  for (const locale of locales ?? []) {
    const region = locale?.regionCode?.toUpperCase?.();
    if (region && supported.has(region)) return region;
  }
  return fallback;
}
