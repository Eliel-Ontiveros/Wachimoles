import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';
import type { CriticalAlert } from '@/types/mission';

export function MobileNotificationsInbox({ visible, onClose, alerts, unreadCount, error, onRetry, onMarkRead }: {
  visible: boolean;
  onClose: () => void;
  alerts: CriticalAlert[];
  unreadCount: number;
  error: string | null;
  onRetry: () => void;
  onMarkRead: () => void;
}) {
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const availableHeight = Math.max(180, height - insets.top - insets.bottom - 88);
  const active = alerts.filter(alert => !alert.resolved);
  const history = alerts.filter(alert => alert.resolved);
  const rows = (tab === 'active' ? active : history).slice().sort((a, b) =>
    Number(a.acknowledged) - Number(b.acknowledged) || Number(b.severity === 'critical') - Number(a.severity === 'critical'));

  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'flex-end', paddingHorizontal: 16,
      paddingTop: insets.top + 72, paddingBottom: insets.bottom + 16 }}>
      <Pressable onPress={event => event.stopPropagation()} accessibilityViewIsModal
        style={{ width: '100%', maxWidth: 440, maxHeight: availableHeight, padding: 18, borderRadius: 14,
          backgroundColor: colors.surfaceAlt, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: scheme === 'dark' ? 0.35 : 0.14, shadowRadius: 20, elevation: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t('alerts.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['active', 'history'] as const).map(key => <Pressable key={key} accessibilityRole="button"
            accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)}
            style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderRadius: 8,
              borderColor: tab === key ? colors.accentDeep : colors.border,
              backgroundColor: tab === key ? colors.accentSoft : colors.surfaceAlt }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{t(key === 'active' ? 'alerts.activeTab' : 'alerts.historyTab', {
              count: key === 'active' ? active.length : history.length,
            })}</Text>
          </Pressable>)}
        </View>
        <ScrollView showsVerticalScrollIndicator style={{ maxHeight: Math.max(90, availableHeight - 164), flexGrow: 0 }}>
          {error && <View style={{ paddingVertical: 12 }}>
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 20 }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 13 }}>{t('alerts.retry')}</Text>
            </Pressable>
          </View>}
          {rows.length === 0 && <Text style={{ paddingVertical: 24, color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
            {t(tab === 'active' ? 'alerts.emptyActive' : 'alerts.emptyHistory')}
          </Text>}
          {rows.map(alert => {
            const severityColor = alert.severity === 'critical' ? colors.danger : scheme === 'dark' ? colors.warning : '#92400e';
            return <View key={alert.id} style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, color: severityColor, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{alert.title}</Text>
                <Text style={{ color: severityColor, fontSize: 14, fontWeight: '700', lineHeight: 20, fontVariant: ['tabular-nums'] }}>{alert.valueLabel}</Text>
              </View>
              <Text style={{ marginTop: 7, color: colors.text, fontSize: 13, lineHeight: 20 }}>{alert.message}</Text>
              <Text style={{ marginTop: 7, color: colors.textMuted, fontSize: 11, lineHeight: 17 }}>
                {alert.resolved ? t('alerts.resolved') : t(alert.severity === 'critical' ? 'alerts.critical' : 'alerts.warning')}
                {' · '}{t(alert.acknowledged ? 'alerts.read' : 'alerts.unread')}{' · '}{alert.timestamp}
              </Text>
            </View>;
          })}
        </ScrollView>
        {unreadCount > 0 && <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable accessibilityRole="button" onPress={onMarkRead}
            style={{ alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center',
              borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{t('alerts.markRead')}</Text>
          </Pressable>
        </View>}
      </Pressable>
    </Pressable>
  </Modal>;
}
