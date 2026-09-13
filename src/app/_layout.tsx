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
import { darkColors } from '@/theme/tokens';

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release.",
]);

export default function RootLayout() {
  const paperTheme = usePaperTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: darkColors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: true,
                  presentation: 'modal',
                  title: 'Settings',
                  headerStyle: { backgroundColor: darkColors.surface },
                  headerTintColor: darkColors.textPrimary,
                }}
              />
            </Stack>
          </BottomSheetModalProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
