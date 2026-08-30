// src/components/insights/DailyBars.tsx
// A 7-day bar chart of one daily metric against a soft target. Anti-guilt by
// construction: one calm sage hue, target as a dashed NEUTRAL reference (never a
// red ceiling), over-target shown as a lighter tint of the same hue, estimated
// days hatched (a texture, not a warning), unlogged days drawn as a faint dotted
// absence (never a broken streak), y-axis always from 0.

import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { CHART, niceMax } from './chart-theme';

export interface BarDatum {
  value: number;
  hasData: boolean;
  est: boolean;
  label: string;
  isToday: boolean;
}

const H = 188;
const PAD = { l: 34, r: 12, t: 26, b: 26 };

export function DailyBars({
  data,
  target,
  avg,
  yStep,
}: {
  data: BarDatum[];
  target: number | null;
  avg: number | null;
  yStep: number;
}) {
  const [w, setW] = useState(0);

  const max = niceMax(data.map((d) => d.value), target, yStep);
  const x0 = PAD.l;
  const y0 = PAD.t;
  const y1 = H - PAD.b;
  const plotW = Math.max(0, w - x0 - PAD.r);
  const yFor = (v: number) => y1 - (Math.min(v, max) / max) * (y1 - y0);
  const slot = data.length > 0 ? plotW / data.length : 0;
  const barW = Math.min(slot * 0.56, 30);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Defs>
            <Pattern id="db-hatch" patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
              <Rect width={6} height={6} fill={CHART.sageSoft} />
              <Line x1={0} y1={0} x2={0} y2={6} stroke={CHART.sage} strokeWidth={2} />
            </Pattern>
          </Defs>

          {/* baseline + a faint mid gridline */}
          <Line x1={x0} y1={y1} x2={w - PAD.r} y2={y1} stroke={CHART.grid} strokeWidth={1} />
          <Line x1={x0} y1={yFor(max / 2)} x2={w - PAD.r} y2={yFor(max / 2)} stroke={CHART.grid} strokeWidth={1} />
          {/* y labels: 0 and max */}
          <SvgText x={x0 - 6} y={y1 + 3} fontSize={9} fill={CHART.inkFaint} textAnchor="end" fontFamily="monospace">0</SvgText>
          <SvgText x={x0 - 6} y={y0 + 3} fontSize={9} fill={CHART.inkFaint} textAnchor="end" fontFamily="monospace">
            {max >= 1000 ? `${(max / 1000).toFixed(max % 1000 === 0 ? 0 : 1)}k` : String(max)}
          </SvgText>

          {/* weekly average — faint dotted */}
          {avg != null && avg > 0 ? (
            <Line x1={x0} y1={yFor(avg)} x2={w - PAD.r} y2={yFor(avg)} stroke={CHART.avg} strokeWidth={1} strokeDasharray="1 4" />
          ) : null}

          {/* target — soft dashed NEUTRAL reference */}
          {target != null && target > 0 ? (
            <G>
              <Line x1={x0} y1={yFor(target)} x2={w - PAD.r} y2={yFor(target)} stroke={CHART.target} strokeWidth={1.5} strokeDasharray="5 4" />
              <SvgText x={w - PAD.r} y={yFor(target) - 5} fontSize={9} fill={CHART.target} textAnchor="end" fontFamily="monospace">
                target {target.toLocaleString()}
              </SvgText>
            </G>
          ) : null}

          {/* bars */}
          {data.map((d, i) => {
            const cx = x0 + slot * i + (slot - barW) / 2;
            const mid = x0 + slot * i + slot / 2;
            if (!d.hasData || d.value <= 0) {
              // unlogged day: a faint dotted absence at the baseline
              return (
                <G key={d.label + i}>
                  <Line x1={cx} y1={y1} x2={cx + barW} y2={y1} stroke={CHART.inkFaint} strokeWidth={1.5} strokeDasharray="1 3" opacity={0.6} />
                  <SvgText x={mid} y={y1 + 15} fontSize={10} fill={d.isToday ? CHART.todayRing : CHART.inkFaint} textAnchor="middle" fontWeight={d.isToday ? '600' : '400'}>{d.label}</SvgText>
                </G>
              );
            }
            const by = yFor(d.value);
            const bh = y1 - by;
            const over = target != null && d.value > target ? yFor(target) - by : 0; // height of the above-target sliver
            return (
              <G key={d.label + i}>
                <Rect x={cx} y={by} width={barW} height={bh} rx={4} fill={d.est ? 'url(#db-hatch)' : CHART.sage} stroke={d.est ? CHART.sage : 'none'} strokeWidth={d.est ? 1 : 0} />
                {over > 0 ? <Rect x={cx} y={by} width={barW} height={Math.max(2, over)} rx={4} fill={CHART.sageSoft} /> : null}
                {d.isToday ? (
                  <>
                    <Rect x={cx} y={by} width={barW} height={bh} rx={4} fill="none" stroke={CHART.todayRing} strokeWidth={2} />
                    <SvgText x={mid} y={by - 6} fontSize={10.5} fill={CHART.ink} textAnchor="middle" fontFamily="monospace" fontWeight="500">{d.value.toLocaleString()}</SvgText>
                  </>
                ) : null}
                {d.est ? <SvgText x={mid} y={y1 - 5} fontSize={8.5} fill={CHART.sage} textAnchor="middle" fontFamily="monospace">est</SvgText> : null}
                <SvgText x={mid} y={y1 + 15} fontSize={10} fill={d.isToday ? CHART.todayRing : CHART.inkDim} textAnchor="middle" fontWeight={d.isToday ? '600' : '400'}>{d.label}</SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
