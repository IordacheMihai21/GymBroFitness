import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';

/** Keeps a deeply nested search field visible when the software keyboard opens. */
export function useKeyboardAwareScroll(topInset: number) {
  const scrollRef = useRef<ScrollView>(null);
  const inputAnchorRef = useRef<View>(null);
  const scrollOffset = useRef(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const revealInput = useCallback(() => {
    const reveal = () => {
      inputAnchorRef.current?.measureInWindow((_x, y) => {
        const desiredTop = topInset + 12;
        const nextOffset = Math.max(0, scrollOffset.current + y - desiredTop);
        scrollRef.current?.scrollTo({ y: nextOffset, animated: true });
      });
    };

    requestAnimationFrame(reveal);
    setTimeout(reveal, 280);
  }, [topInset]);

  return { scrollRef, inputAnchorRef, onScroll, revealInput };
}
