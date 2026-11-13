import '../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { CriticalAlertToaster } from '@/components/trauma/CriticalAlertToaster';
import { DrawerProvider } from '@/components/trauma/DrawerProvider';
import { MissionOnboardingModal } from '@/components/trauma/MissionOnboardingModal';
import { MissionProvider } from '@/components/trauma/MissionProvider';

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
