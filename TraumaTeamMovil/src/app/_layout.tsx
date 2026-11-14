import '../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { CriticalAlertToaster } from '@/components/trauma/CriticalAlertToaster';
import { DrawerProvider } from '@/components/trauma/DrawerProvider';
import { MissionOnboardingModal } from '@/components/trauma/MissionOnboardingModal';
import { MissionProvider } from '@/components/trauma/MissionProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { VoiceFab } from '@/voice/VoiceButton';
import { VoiceProvider } from '@/voice/VoiceProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <I18nProvider>
      <MissionProvider>
        <DrawerProvider>
          <VoiceProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                gestureEnabled: false,
              }}
            />
            <MissionOnboardingModal />
            <CriticalAlertToaster />
            <VoiceFab />
          </VoiceProvider>
        </DrawerProvider>
      </MissionProvider>
    </I18nProvider>
  );
}
