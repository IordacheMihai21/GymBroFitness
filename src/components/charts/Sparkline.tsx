import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { durations, easeOutExpo } from '@/components/ui/motion';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type SparklineProps = {
  values: number[];
  width: number;
  height: number;
  color?: string;
  /** Shade the area under the line. */
  fill?: boolean;
};

/**
 * Small trend line that draws itself in (the SVG line-drawing pattern) with
 * an end dot on the latest value. Flat or single-point data renders a level
 * line rather than nothing, so a new lifter still sees the shape of the tile.
 */
export function Sparkline({ values, width, height, color, fill = true }: SparklineProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const stroke = color ?? colors.accent;
  const pad = 4;

  const geometry = useMemo(() => {
    const data =
      values.length === 0 ? [0, 0] : values.length === 1 ? [values[0], values[0]] : values;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((value, index) => ({
      x: pad + (index / (data.length - 1)) * (width - pad * 2),
      y: max === min ? height / 2 : pad + (1 - (value - min) / range) * (height - pad * 2),
    }));
    let length = 0;
    let line = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const point = points[i];
      const midX = (prev.x + point.x) / 2;
      line += ` C${midX},${prev.y} ${midX},${point.y} ${point.x},${point.y}`;
      length += Math.hypot(point.x - prev.x, point.y - prev.y) * 1.15;
    }
    const last = points[points.length - 1];
    const area = `${line} L${last.x},${height} L${points[0].x},${height} Z`;
    return { line, area, last, length: Math.max(1, length) };
  }, [height, values, width]);

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: durations.slow * 2, easing: easeOutExpo });
  }, [geometry.line, progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: geometry.length * (1 - progress.value),
  }));

  if (width <= 0) return <View style={{ height }} />;

  const gradientId = `spark-${stroke.replace('#', '')}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity={0.28} />
          <Stop offset="1" stopColor={stroke} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fill ? <Path d={geometry.area} fill={`url(#${gradientId})`} /> : null}
      <AnimatedPath
        d={geometry.line}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={geometry.length}
        animatedProps={animatedProps}
      />
      <Circle cx={geometry.last.x} cy={geometry.last.y} r={3.5} fill={stroke} />
    </Svg>
  );
}
