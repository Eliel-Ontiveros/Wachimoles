import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, X } from 'lucide-react-native';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';
import { useMission } from './mission-context';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Pop-up flotante en pantalla exclusivo para anomalías médicas graves
export function CriticalAlertToaster() {
  const { activeToasterAlert, dismissToaster, markToasterDelivered } = useMission();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(-140));

  const alertId = activeToasterAlert?.id;
  useEffect(() => {
    if (!alertId) {
      slideAnim.setValue(-140);
      return;
    }

    markToasterDelivered();
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -140,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished) dismissToaster();
      });
    }, 8000);

    return () => clearTimeout(timer);
  }, [alertId, slideAnim, dismissToaster, markToasterDelivered]);

  if (!activeToasterAlert) return null;

  const isCritical = activeToasterAlert.severity === 'critical';
  const accentColor = isCritical ? colors.danger : scheme === 'dark' ? colors.warning : '#92400e';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 100,
        transform: [{ translateY: slideAnim }],
      }}>
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14,
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          shadowColor: colors.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }}>
        <AlertTriangle size={18} color={accentColor} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: accentColor, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
            {t(isCritical ? 'alerts.critical' : 'alerts.warning')} · {activeToasterAlert.valueLabel}
          </Text>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{activeToasterAlert.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{activeToasterAlert.message}</Text>
        </View>
        <Pressable onPress={dismissToaster} accessibilityRole="button" accessibilityLabel={t('vital.toaster.close')}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
          <X size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
