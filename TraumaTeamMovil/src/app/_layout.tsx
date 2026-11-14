import '../utils/web-interop-init';
import '../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

import { CriticalAlertToaster } from '@/components/trauma/CriticalAlertToaster';
import { DrawerProvider } from '@/components/trauma/DrawerProvider';
import { MissionOnboardingModal } from '@/components/trauma/MissionOnboardingModal';
import { MissionProvider } from '@/components/trauma/MissionProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { useAppTheme } from '@/theme';
import { VoiceFab } from '@/voice/VoiceButton';
import { VoiceProvider } from '@/voice/VoiceProvider';
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

/** Fondo raíz y barra de estado según el tema efectivo. */
function ThemedRoot({ children }: { children: ReactNode }) {
  const { colors, scheme } = useAppTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SettingsProvider>
    <I18nProvider>
      <ThemedRoot>
      <MissionProvider>
        <DrawerProvider>
          <VoiceProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
            {splashDone ? (
              <>
                <MissionOnboardingModal />
                <CriticalAlertToaster />
                <VoiceFab />
              </>
            ) : (
              <StartupSplashAnimation onComplete={() => setSplashDone(true)} />
            )}
          </VoiceProvider>
        </DrawerProvider>
      </MissionProvider>
      </ThemedRoot>
    </I18nProvider>
    </SettingsProvider>
  );
}
