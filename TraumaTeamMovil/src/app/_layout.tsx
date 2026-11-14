import '../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { CriticalAlertToaster } from '@/components/trauma/CriticalAlertToaster';
import { DrawerProvider } from '@/components/trauma/DrawerProvider';
import { MissionOnboardingModal } from '@/components/trauma/MissionOnboardingModal';
import { MissionProvider } from '@/components/trauma/MissionProvider';

LogBox.ignoreLogs(['ImageBackground is deprecated']);

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('ImageBackground is deprecated')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <MissionProvider>
      <DrawerProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
        <MissionOnboardingModal />
        <CriticalAlertToaster />
      </DrawerProvider>
    </MissionProvider>
  );
}
