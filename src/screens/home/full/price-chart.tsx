import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import type { PriceDays, Prices } from '@/offchain/home';
import { colors } from '@/theme';

import { formatPrice, niceTicks, priceScale, timeTicks } from '../format';

const AXIS_W = 46; // the price labels on the right
const TIME_H = 18; // the time labels at the bottom
const TOP = 8;
const VOL_SHARE = 0.2; // volume bars take the bottom fifth, under the line (the site leaves the line 26% above them)

const axisLabel = (p: number) => formatPrice(p).slice(1);

/** The full-screen price chart: line and area, price axis right, time axis below, volume bars at the bottom. */
export function PriceChart({ data, days, color }: { data: Prices; days: PriceDays; color: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drawn = useMemo(() => {
    const { width, height } = size;
    if (!width || !height || data.series.length < 2) return null;
    const right = width - AXIS_W;
    const bottom = height - TIME_H;
    const volH = (bottom - TOP) * VOL_SHARE;
    const scale = priceScale(data.series, { left: 0, right, top: TOP, bottom: bottom - volH - 4 });
    const line = data.series.map(([t, p], i) => `${i ? 'L' : 'M'}${scale.x(t).toFixed(1)} ${scale.y(p).toFixed(1)}`).join('');
    const base = bottom - volH - 4;
    const area = `${line}L${right} ${base}L0 ${base}Z`;
    const maxVol = Math.max(0, ...data.volumes.map(([, v]) => v));
    const bars = maxVol
      ? data.volumes
          .filter(([, v]) => v > 0)
          .map(([t, v]) => `M${scale.x(t).toFixed(1)} ${bottom}V${(bottom - (v / maxVol) * volH).toFixed(1)}`)
          .join('')
      : '';
    const barW = Math.max(1, (right / Math.max(1, data.volumes.length)) * 0.7);
    const prices = niceTicks(scale.min, scale.max, 8);
    const times = timeTicks(data.series[0][0], data.series[data.series.length - 1][0], days);
    return { scale, line, area, bars, barW, prices, times, right, bottom };
  }, [size, data, days]);

  return (
    <View testID="full-chart" style={styles.box} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {drawn && (
        <Svg width={size.width} height={size.height}>
          {drawn.prices.map((p) => (
            <Line key={`g${p}`} x1={0} x2={drawn.right} y1={drawn.scale.y(p)} y2={drawn.scale.y(p)} stroke="#ffffff10" />
          ))}
          {drawn.prices.map((p) => (
            <SvgText key={`p${p}`} x={drawn.right + 4} y={drawn.scale.y(p) + 3} fill={colors.muted} fontSize={10}>{axisLabel(p)}</SvgText>
          ))}
          {drawn.times.map(({ t, label }) => (
            <SvgText key={`t${t}`} x={drawn.scale.x(t)} y={size.height - 4} fill={colors.muted} fontSize={10} textAnchor="middle">{label}</SvgText>
          ))}
          <Path testID="vol-bars" d={drawn.bars} stroke={color} strokeOpacity={0.35} strokeWidth={drawn.barW} />
          <Path d={drawn.area} fill={color} fillOpacity={0.08} />
          <Path d={drawn.line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
});
