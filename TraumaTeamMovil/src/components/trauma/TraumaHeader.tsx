import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, Menu } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { useI18n } from '@/i18n/I18nProvider';
import { ThemeToggle } from '@/settings/ThemeToggle';
import { useAppTheme } from '@/theme';
import { useVoice } from '@/voice/voice-context';

import { useDrawer } from './drawer-context';
import { useMission } from './mission-context';
import { MobileNotificationsInbox } from './MobileNotificationsInbox';
import { TRAUMATEAM_WORDMARK_PATHS } from './StartupSplashAnimation';

export function TraumaHeader() {
  const { open } = useDrawer();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const { alerts, unreadAlertCount, acknowledgeAllAlerts, alertsError, refreshAlerts } = useMission();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alertsIntent, consumeAlertsIntent } = useVoice();
  const [handledVoiceNonce, setHandledVoiceNonce] = useState(0);
  if (alertsIntent && alertsIntent.nonce !== handledVoiceNonce) {
    setHandledVoiceNonce(alertsIntent.nonce);
    setAlertsOpen(true);
  }
  useEffect(() => {
    if (alertsIntent) consumeAlertsIntent(alertsIntent.nonce);
  }, [alertsIntent, consumeAlertsIntent]);

  return (
    <>
      <View className="flex-row items-center justify-between border-b border-trauma-line bg-trauma-bg px-5 dark:border-trauma-nightLine dark:bg-trauma-nightBg pb-3 pt-2">
        <Pressable
          onPress={open}
          accessibilityLabel={t('nav.openMenu')}
          className="h-10 w-10 items-center justify-center rounded-xl border border-trauma-ink bg-white active:opacity-60 dark:border-trauma-nightLine dark:bg-trauma-night">
          <Menu size={20} color={colors.text} />
        </Pressable>

        <View className="items-center justify-center" accessibilityLabel="TraumaTeam">
          <Svg width={186} height={15} viewBox="0 0 342.6 27.64">
            {TRAUMATEAM_WORDMARK_PATHS.map((item, idx) => (
              <Path
                key={idx}
                fill={
                  scheme === 'dark'
                    ? item.fill === '#313643'
                      ? colors.text
                      : colors.textMuted
                    : item.fill
                }
                d={item.d}
              />
            ))}
          </Svg>
        </View>

        <View className="flex-row items-center gap-2">
          <ThemeToggle />
          <Pressable
            onPress={() => setAlertsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('alerts.bellLabel', { count: unreadAlertCount })}
            accessibilityState={{ expanded: alertsOpen }}
            style={{ width: 44, height: 44, borderWidth: 1, borderRadius: 10, borderColor: colors.border, backgroundColor: colors.surface }}
            className="items-center justify-center active:opacity-60">
            <Bell size={20} color={colors.text} />
            {unreadAlertCount > 0 && (
              <View className="absolute -right-1 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1">
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                  {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <MobileNotificationsInbox visible={alertsOpen} onClose={() => setAlertsOpen(false)}
        alerts={alerts} unreadCount={unreadAlertCount} error={alertsError}
        onRetry={() => void refreshAlerts()} onMarkRead={acknowledgeAllAlerts} />
    </>
  );
}

// Safe area y barra superior común a todas las pantallas
export function TraumaScreen({ children }: { children: ReactNode }) {
  const { colors, scheme } = useAppTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <TraumaHeader />
      {children}
    </SafeAreaView>
  );
}
