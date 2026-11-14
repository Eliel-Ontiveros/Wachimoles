import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Bell, CheckCheck, Menu, X } from 'lucide-react-native';

import { useVoice } from '@/voice/voice-context';

import { useDrawer } from './drawer-context';
import { useMission } from './mission-context';

export function TraumaHeader() {
  const { open } = useDrawer();
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
      <View className="flex-row items-center justify-between border-b border-trauma-line bg-trauma-bg px-5 pb-3 pt-2">
        <Pressable
          onPress={open}
          accessibilityLabel="Abrir menú"
          className="h-10 w-10 items-center justify-center rounded-xl border border-trauma-ink bg-white active:opacity-60">
          <Menu size={20} color="#111827" />
        </Pressable>

        <Text className="font-mono text-2xl text-trauma-ink">
          <Text className="font-bold">Trauma</Text>Team
        </Text>

        <Pressable
          onPress={() => setAlertsOpen(true)}
          accessibilityLabel="Notificaciones"
          className="h-10 w-10 items-center justify-center rounded-xl border border-trauma-ink bg-white active:opacity-60">
          <Bell size={18} color={unreadAlertCount > 0 ? '#dc2626' : '#111827'} />
          {unreadAlertCount > 0 && (
            <View className="absolute -right-1 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1">
              <Text className="font-mono text-[9px] font-bold text-white">
                {unreadAlertCount}
              </Text>
            </View>
          )}
        </Pressable>
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
            backgroundColor: 'rgba(15,23,42,0.4)',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ maxHeight: '70%' }}
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-[#f7f7f7]">
                  <Bell size={15} color="#0f172a" />
                </View>
                <Text className="font-mono text-sm font-extrabold text-trauma-ink">
                  Notificaciones
                </Text>
              </View>
              <Pressable
                onPress={() => setAlertsOpen(false)}
                className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <X size={15} color="#475569" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              {alerts.length === 0 ? (
                <View className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-[#f7f7f7] px-4 py-5">
                  <CheckCheck size={15} color="#64748b" />
                  <Text className="ml-2 font-mono text-xs font-bold text-slate-600">
                    Sin alertas nuevas
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
                            ? 'border-red-200 bg-red-50/50'
                            : 'border-amber-200 bg-amber-50/50'
                        }`}>
                        <AlertTriangle
                          size={15}
                          color={isCrit ? '#dc2626' : '#d97706'}
                          style={{ marginRight: 10 }}
                        />
                        <View className="flex-1 pr-2">
                          <Text className="font-mono text-xs font-bold text-slate-900" numberOfLines={1}>
                            {a.title}
                          </Text>
                          <Text className="mt-0.5 font-mono text-[9.5px] text-slate-500" numberOfLines={1}>
                            {a.timestamp}
                          </Text>
                        </View>
                        <View className="rounded-lg bg-white px-2 py-1 border border-slate-200">
                          <Text className="font-mono text-[11px] font-extrabold text-slate-900">
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
                className="mt-3 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-2.5 active:opacity-75">
                <CheckCheck size={14} color="#0f172a" />
                <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink">
                  Marcar como leídas
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
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
      <StatusBar style="dark" />
      <TraumaHeader />
      {children}
    </SafeAreaView>
  );
}
