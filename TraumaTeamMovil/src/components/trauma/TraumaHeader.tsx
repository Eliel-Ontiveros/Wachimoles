import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Bell, CheckCheck, Menu, X } from 'lucide-react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { ThemeToggle } from '@/settings/ThemeToggle';
import { useAppTheme } from '@/theme';
import { useVoice } from '@/voice/voice-context';

import { useDrawer } from './drawer-context';
import { useMission } from './mission-context';

export function TraumaHeader() {
  const { open } = useDrawer();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const { alerts, unreadAlertCount, acknowledgeAllAlerts } = useMission();
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

        <Text className="font-mono text-2xl text-trauma-ink dark:text-trauma-nightInk">
          <Text className="font-bold">Trauma</Text>Team
        </Text>

        <View className="flex-row items-center gap-2">
          <ThemeToggle />
          <Pressable
            onPress={() => setAlertsOpen(true)}
            accessibilityLabel={t('alerts.title')}
            className="h-10 w-10 items-center justify-center rounded-xl border border-trauma-ink bg-white active:opacity-60 dark:border-trauma-nightLine dark:bg-trauma-night">
            <Bell size={18} color={unreadAlertCount > 0 ? colors.danger : colors.text} />
            {unreadAlertCount > 0 && (
              <View className="absolute -right-1 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1">
                <Text className="font-mono text-[9px] font-bold text-white">
                  {unreadAlertCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Tarjeta compacta de notificaciones */}
      <Modal
        visible={alertsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertsOpen(false)}>
        <Pressable
          onPress={() => setAlertsOpen(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ maxHeight: '70%' }}
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl dark:border-trauma-nightLine dark:bg-trauma-night">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-[#f7f7f7] dark:border-trauma-nightLine dark:bg-trauma-nightAlt">
                  <Bell size={15} color={colors.text} />
                </View>
                <Text className="font-mono text-sm font-extrabold text-trauma-ink dark:text-trauma-nightInk">
                  {t('alerts.title')}
                </Text>
              </View>
              <Pressable
                onPress={() => setAlertsOpen(false)}
                className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 dark:bg-trauma-nightAlt dark:active:bg-trauma-nightLine"
                accessibilityLabel={t('common.close')}>
                <X size={15} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              {alerts.length === 0 ? (
                <View className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-[#f7f7f7] px-4 py-5 dark:border-trauma-nightLine dark:bg-trauma-nightAlt">
                  <CheckCheck size={15} color={colors.textMuted} />
                  <Text className="ml-2 font-mono text-xs font-bold text-slate-600 dark:text-trauma-nightMuted">
                    {t('alerts.empty')}
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {alerts.map((a) => {
                    const isCrit = a.severity === 'critical';
                    return (
                      <View
                        key={a.id}
                        className={`flex-row items-center rounded-2xl border px-3 py-2.5 ${
                          isCrit
                            ? 'border-red-200 bg-red-50/50 dark:border-red-400/40 dark:bg-red-950/60'
                            : 'border-amber-200 bg-amber-50/50 dark:border-amber-400/40 dark:bg-amber-950/60'
                        }`}>
                        <AlertTriangle
                          size={15}
                          color={isCrit ? colors.danger : colors.warning}
                          style={{ marginRight: 10 }}
                        />
                        <View className="flex-1 pr-2">
                          <Text
                            className="font-mono text-xs font-bold text-slate-900 dark:text-trauma-nightInk"
                            numberOfLines={1}>
                            {a.title}
                          </Text>
                          <Text
                            className="mt-0.5 font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted"
                            numberOfLines={1}>
                            {a.timestamp}
                          </Text>
                        </View>
                        <View className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-trauma-nightLine dark:bg-trauma-night">
                          <Text className="font-mono text-[11px] font-extrabold text-slate-900 dark:text-trauma-nightInk">
                            {a.valueLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {alerts.length > 0 && (
              <Pressable
                onPress={acknowledgeAllAlerts}
                className="mt-3 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-2.5 active:opacity-75 dark:border-trauma-cyanEdge/50 dark:bg-[#0e3a4d]">
                <CheckCheck size={14} color={colors.text} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                  {t('alerts.markRead')}
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
