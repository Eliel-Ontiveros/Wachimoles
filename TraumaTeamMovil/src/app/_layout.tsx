import '../utils/web-interop-init';
import '../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';

import { CriticalAlertToaster } from '@/components/trauma/CriticalAlertToaster';
import { DrawerProvider } from '@/components/trauma/DrawerProvider';
import { MissionOnboardingModal } from '@/components/trauma/MissionOnboardingModal';
import { MissionProvider } from '@/components/trauma/MissionProvider';
import { StartupSplashAnimation } from '@/components/trauma/StartupSplashAnimation';

LogBox.ignoreLogs(['ImageBackground is deprecated', 'useNativeDriver']);

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ImageBackground is deprecated') ||
      (Platform.OS === 'web' && args[0].includes('useNativeDriver')))
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <MissionProvider>
      <DrawerProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
        {splashDone ? (
          <>
            <MissionOnboardingModal />
            <CriticalAlertToaster />
          </>
        ) : (
          <StartupSplashAnimation onComplete={() => setSplashDone(true)} />
        )}
      </DrawerProvider>
    </MissionProvider>
  );
}
