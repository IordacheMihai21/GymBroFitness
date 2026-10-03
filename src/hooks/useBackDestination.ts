import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

/**
 * Keeps Android's system Back action aligned with an explicit parent screen.
 * This is useful when a nested screen sits above a tab navigator: popping the
 * root stack can otherwise remount the navigator on its initial tab.
 */
export function useBackDestination(destination: Href) {
  const router = useRouter();
  const goBack = useCallback(() => router.replace(destination), [destination, router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]),
  );

  return goBack;
}
