// src/lib/widget.ts
// Keeps the home-screen widget's numbers current.
//
// Two paths render the widget, both through TodayWidget with the SAME data:
//   1. the app, right after anything changes today's totals (a log, an edit, a
//      delete, a Home load) — refreshTodayWidget()
//   2. the headless task handler, when Android asks (widget added, periodic
//      update, resize) — widgetTaskHandler(), registered in index.js
// The handler runs without the app UI, possibly without a session, so it reads
// the last numbers the app wrote to AsyncStorage rather than querying. The
// widget itself shows "open to refresh" if that snapshot is from another day.
//
// Everything here is best-effort and Android-only: a widget that cannot update
// must never surface as an error in the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { TodayWidget, WIDGET_NAME, type TodayWidgetData } from '@/widgets/today-widget';

const KEY = 'calibreta:widget:today:v1';

export async function readWidgetSnapshot(): Promise<TodayWidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as TodayWidgetData;
    return typeof d?.date === 'string' && typeof d?.eatenKcal === 'number' ? d : null;
  } catch {
    return null;
  }
}

/** Store today's numbers and redraw every placed widget. Safe to call often. */
export async function refreshTodayWidget(data: TodayWidgetData): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // the redraw below still has the live data
  }
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => TodayWidget({ data }),
      widgetNotFound: () => undefined,   // none placed — nothing to draw
    });
  } catch {
    // no native module (iOS, web, old build) — nothing to do
  }
}

/** Clear the snapshot (account deleted / signed out) and redraw as empty. */
export async function clearTodayWidget(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => TodayWidget({ data: null }),
      widgetNotFound: () => undefined,
    });
  } catch {
    // ignore
  }
}

/** The headless handler Android calls. Registered once in index.js. */
export async function widgetTaskHandler(props: {
  widgetInfo: { widgetName: string };
  widgetAction: string;
  renderWidget: (w: ReturnType<typeof TodayWidget>) => void;
}): Promise<void> {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(TodayWidget({ data: await readWidgetSnapshot() }));
      return;
    default:
      // WIDGET_DELETED / WIDGET_CLICK: clicks are OPEN_APP / OPEN_URI and are
      // handled natively; nothing to draw.
      return;
  }
}
