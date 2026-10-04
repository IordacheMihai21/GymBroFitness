import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  useFonts,
} from '@expo-google-fonts/geist';
import { GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { usePaperTheme } from '@/theme/paperTheme';
import { darkColors, fonts } from '@/theme/tokens';

LogBox.ignoreLogs(['SafeAreaView has been deprecated and will be removed in a future release.']);

SplashScreen.preventAutoHideAsync();

const modalHeader = {
  headerShown: true,
  presentation: 'modal' as const,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: darkColors.background },
  headerTintColor: darkColors.textPrimary,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
};

export default function RootLayout() {
  const paperTheme = usePaperTheme();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });
  const ready = fontsLoaded || fontError != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                navigationBarHidden: true,
                contentStyle: { backgroundColor: darkColors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="custom-workout" />
              <Stack.Screen name="form-check/[exerciseId]" />
              <Stack.Screen name="program-builder" />
              <Stack.Screen name="program-library" />
              <Stack.Screen name="program-day/[day]" />
              <Stack.Screen name="body-log" options={{ ...modalHeader, title: 'Body tracking' }} />
              <Stack.Screen name="settings" options={{ ...modalHeader, title: 'Settings' }} />
            </Stack>
          </BottomSheetModalProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
