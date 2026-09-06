// Country default detection for onboarding.
//
// Use the device REGION (Settings → Language & Region → Region), NEVER the
// language. expo-localization's `Locale.regionCode` is that region setting;
// `Locale.languageRegionCode` is the language's region (`en-GB` → `GB`) and is
// deliberately ignored — reading it is what made an Indian phone whose system
// language is English (UK) preselect the United Kingdom.
//
// Scan every preferred locale for a supported region, then fall back to India
// (we're India-first). The fallback is never a language-derived region: if the
// only signal available is a language's region, we drop it and use India.

export interface RegionLocale {
  regionCode?: string | null;
  // `languageRegionCode` is intentionally NOT part of this shape — do not read it.
}

export function pickCountry(
  locales: ReadonlyArray<RegionLocale> | null | undefined,
  supported: ReadonlySet<string>,
  fallback = 'IN',
): string {
  for (const locale of locales ?? []) {
    const region = locale?.regionCode?.toUpperCase?.();
    if (region && supported.has(region)) return region;
  }
  return fallback;
}
