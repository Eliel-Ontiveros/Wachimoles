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
  const { activeToasterAlert, dismissToaster } = useMission();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(-140));

  useEffect(() => {
    if (!activeToasterAlert) {
      slideAnim.setValue(-140);
      return;
    }

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
  }, [activeToasterAlert, slideAnim, dismissToaster]);

  if (!activeToasterAlert) return null;

  const isCritical = activeToasterAlert.severity === 'critical';
  const accentColor = isCritical ? colors.danger : colors.warning;

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
      <View
        style={{
          borderColor: accentColor,
          borderLeftWidth: 5,
        }}
        className="flex-row items-start rounded-2xl border bg-white p-3.5 shadow-xl dark:bg-trauma-night">
        <View
          style={{ backgroundColor: isCritical ? colors.dangerSoft : colors.warningSoft }}
          className="mr-3 h-9 w-9 items-center justify-center rounded-xl">
          <AlertTriangle size={18} color={accentColor} />
        </View>

        <View className="flex-1 pr-2">
          <View className="flex-row items-center justify-between">
            <Text
              style={{ color: accentColor }}
              className="font-mono text-[10px] font-bold uppercase tracking-wider">
              {isCritical ? t('vital.toaster.critical') : t('vital.toaster.anomaly')}
            </Text>
            <Text className="font-mono text-xs font-extrabold text-slate-900 dark:text-trauma-nightInk">
              {activeToasterAlert.valueLabel}
            </Text>
          </View>
          <Text className="mt-0.5 font-mono text-xs font-bold text-slate-900 dark:text-trauma-nightInk">
            {activeToasterAlert.title}
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-trauma-nightMuted">
            {activeToasterAlert.message}
          </Text>
        </View>

        <Pressable
          onPress={dismissToaster}
          accessibilityLabel={t('vital.toaster.close')}
          className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 dark:bg-trauma-nightAlt dark:active:bg-trauma-nightLine">
          <X size={14} color={scheme === 'dark' ? colors.textMuted : '#475569'} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
