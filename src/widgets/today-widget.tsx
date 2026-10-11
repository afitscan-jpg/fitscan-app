// src/widgets/today-widget.tsx
// The home-screen widget (Android, react-native-android-widget). Pure: it takes
// today's numbers and returns widget JSX — no data access, no hooks — so the
// same tree renders from the app (after a log) and from the headless task
// handler (periodic update), and can be eyeballed with WidgetPreview.
//
// What it shows: eaten / target kcal and what's left, plus two taps: Log and
// Scan, each a deep link into the app (scheme `fitscan`, see app.json).
// Honesty rules carry over: if any logged item today was an estimate the kcal
// gets the same "≈" the diary shows, and when there is no target we say so
// instead of inventing one.

import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface TodayWidgetData {
  eatenKcal: number;
  targetKcal: number | null;
  items: number;
  /** Any of today's items is an estimate → "≈" on the number. */
  hasEstimate: boolean;
  /** ISO date the numbers are for; a stale date renders as "open to refresh". */
  date: string;
}

export const WIDGET_NAME = 'CalibretaToday';

const BG = '#FAF8F4';
const INK = '#2B2822';
const SOFT = '#78716A';
const GREEN = '#4C7C63';
const GREEN_SOFT = '#E6EFE9';

function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function TodayWidget({ data, now = new Date() }: { data: TodayWidgetData | null; now?: Date }) {
  const stale = !data || data.date !== todayISO(now);
  const eaten = stale ? 0 : Math.round(data.eatenKcal);
  const target = stale ? null : data.targetKcal;
  const approx = !stale && data.hasEstimate ? '≈' : '';
  const headline = target != null
    ? `${approx}${eaten} / ${target}`
    : `${approx}${eaten}`;
  const sub = stale
    ? 'Open Calibreta to refresh'
    : target != null
      ? (target - eaten >= 0 ? `${target - eaten} kcal left today` : `${eaten - target} kcal over today`)
      : data.items === 0 ? 'Nothing logged yet' : `${data.items} item${data.items === 1 ? '' : 's'} logged · no target set`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent', width: 'match_parent',
        backgroundColor: BG, borderRadius: 24, padding: 16,
        flexDirection: 'column', justifyContent: 'space-between',
      }}
      clickAction="OPEN_APP"
      accessibilityLabel="Calibreta today"
    >
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <TextWidget text="TODAY" style={{ fontSize: 11, color: SOFT, letterSpacing: 0.6, fontWeight: '600' }} />
        <TextWidget
          text={headline}
          style={{ fontSize: 26, color: INK, fontWeight: 'bold', marginTop: 2, adjustsFontSizeToFit: true }}
          maxLines={1}
        />
        <TextWidget text={sub} style={{ fontSize: 12.5, color: SOFT, marginTop: 2 }} maxLines={1} />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', flexGap: 8 }}>
        <FlexWidget
          style={{ flex: 1, height: 40, borderRadius: 14, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'fitscan://add' }}
          accessibilityLabel="Log food"
        >
          <TextWidget text="Log" style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }} />
        </FlexWidget>
        <FlexWidget
          style={{ flex: 1, height: 40, borderRadius: 14, backgroundColor: GREEN_SOFT, justifyContent: 'center', alignItems: 'center' }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'fitscan://scanner' }}
          accessibilityLabel="Scan a barcode"
        >
          <TextWidget text="Scan" style={{ fontSize: 14, color: GREEN, fontWeight: '600' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
