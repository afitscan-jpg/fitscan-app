// src/components/scanner/diag-line.tsx
// C1 — the one-line truth about a scan, for field reports.
//
// A bug report that says "the scanner isn't working" costs a day to chase. One
// that says "EAN 8901764012273 · unavailable · OFF 503 · 2.1s" is diagnosed on
// sight: OFF was down, the barcode read fine, the request took 2.1 s. This puts
// that line where a screenshot will capture it.
//
// GATED TO NON-PRODUCTION BUILDS. __DEV__ covers Expo Go and dev clients;
// EXPO_PUBLIC_SHOW_DIAG=1 opts a preview/internal build in. A shipped store
// build shows nothing — end users should never see a status line.

import { StyleSheet, Text } from 'react-native';

import { C, Fonts } from '@/constants/theme';
import { formatDiag } from '@/lib/scan';
import type { ScanDiag } from '@/types/scan';

export const DIAG_VISIBLE =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_DIAG === '1';

export function DiagLine({ diag }: { diag: ScanDiag | null | undefined }) {
  if (!DIAG_VISIBLE || !diag) return null;
  return (
    <Text style={s.line} selectable numberOfLines={2}>
      {formatDiag(diag)}
    </Text>
  );
}

const s = StyleSheet.create({
  line: {
    fontFamily: 'monospace',
    fontSize: 10.5,
    lineHeight: 15,
    color: C.inkSoft,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
});
