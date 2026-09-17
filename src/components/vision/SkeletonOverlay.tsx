import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import type { PoseLandmarks } from '@/domain/vision/landmarks';
import { SKELETON_CONNECTIONS } from '@/domain/vision/skeletonConnections';

const MIN_VISIBILITY = 0.3;

type SkeletonOverlayProps = {
  landmarks: PoseLandmarks | null;
  /** VisionCamera mirrors the front-camera preview horizontally (selfie view); the raw landmark coordinates aren't, so the overlay must mirror to match. */
  mirror?: boolean;
};

/**
 * Draws the pose skeleton as a plain SVG layer over the camera preview,
 * driven by the landmarks already bridged to JS for scoring — rather than
 * inside the frame processor itself (see useFormAnalysis.ts for why: Skia
 * frame processors can't reliably wrap every device's camera buffer).
 */
export function SkeletonOverlay({ landmarks, mirror = true }: SkeletonOverlayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const toX = (normalizedX: number) => (mirror ? 1 - normalizedX : normalizedX) * size.width;
  const toY = (normalizedY: number) => normalizedY * size.height;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {landmarks && size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          {SKELETON_CONNECTIONS.map(([a, b]) => {
            const from = landmarks[a];
            const to = landmarks[b];
            if (from.visibility < MIN_VISIBILITY || to.visibility < MIN_VISIBILITY) return null;
            return (
              <Line
                key={`${a}-${b}`}
                x1={toX(from.x)}
                y1={toY(from.y)}
                x2={toX(to.x)}
                y2={toY(to.y)}
                stroke="#4A95FF"
                strokeWidth={4}
              />
            );
          })}
          {landmarks.map(
            (point, index) =>
              point.visibility >= MIN_VISIBILITY && (
                <Circle key={index} cx={toX(point.x)} cy={toY(point.y)} r={5} fill="#FFFFFF" />
              ),
          )}
        </Svg>
      )}
    </View>
  );
}
