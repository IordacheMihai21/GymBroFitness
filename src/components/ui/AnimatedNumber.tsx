import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { durations } from './motion';

type AnimatedNumberProps = {
  /** Display string such as "3.7t", "0/4", "60 min" or "1,250 kg". The first number in it counts up. */
  value: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const NUMBER = /-?\d[\d,]*(?:\.\d+)?/;

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function parse(value: string) {
  const match = NUMBER.exec(value);
  if (!match) return null;
  const raw = match[0];
  const target = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  return {
    prefix: value.slice(0, match.index),
    suffix: value.slice(match.index + raw.length),
    target,
    decimals,
    grouped: raw.includes(','),
  };
}

function format(n: number, decimals: number, grouped: boolean): string {
  return grouped
    ? n.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : n.toFixed(decimals);
}

/**
 * Number ticker (anime.js-style tween on easeOutExpo). Counts the first number
 * in the string up from its previous value; everything around it stays put.
 * Paired with the mono face, the digits do not jitter while they change.
 */
export function AnimatedNumber({ value, style, numberOfLines = 1 }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const parsed = parse(value);
  const [shown, setShown] = useState(() =>
    reduceMotion || !parsed
      ? value
      : `${parsed.prefix}${format(0, parsed.decimals, parsed.grouped)}${parsed.suffix}`,
  );
  const from = useRef(0);

  useEffect(() => {
    const next = parse(value);
    if (reduceMotion || !next || next.target === from.current) {
      setShown(value);
      if (next) from.current = next.target;
      return;
    }
    const start = from.current;
    const startedAt = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / durations.count);
      const current = start + (next.target - start) * easeOutExpo(t);
      setShown(`${next.prefix}${format(current, next.decimals, next.grouped)}${next.suffix}`);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = next.target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = next.target;
    };
  }, [reduceMotion, value]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {shown}
    </Text>
  );
}
