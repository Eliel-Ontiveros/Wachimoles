import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';
import { Moon, Sun } from 'lucide-react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';

const W = 52;
const H = 28;
const KNOB = 22;
const PAD = (H - KNOB) / 2;
const NATIVE = Platform.OS !== 'web';

/**
 * Interruptor rápido claro/oscuro. Fija una preferencia explícita; "Sistema"
 * sigue disponible en Ajustes del menú lateral.
 */
export function ThemeToggle() {
  const { scheme, setPreference } = useAppTheme();
  const { t } = useI18n();
  const dark = scheme === 'dark';
  const [pos] = useState(() => new Animated.Value(dark ? 1 : 0));

  useEffect(() => {
    Animated.timing(pos, {
      toValue: dark ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start();
  }, [dark, pos]);

  const translateX = pos.interpolate({ inputRange: [0, 1], outputRange: [PAD, W - KNOB - PAD] });
  const rotate = pos.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={() => setPreference(dark ? 'light' : 'dark')}
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel={dark ? t('settings.switchToLight') : t('settings.switchToDark')}
      hitSlop={6}
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: dark ? '#1e293b' : '#111827',
        backgroundColor: dark ? '#0a0f1d' : '#bbf2fd',
      }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? '#58d5f7' : '#ffffff',
          shadowColor: dark ? '#58d5f7' : '#0f172a',
          shadowOpacity: dark ? 0.7 : 0.15,
          shadowRadius: dark ? 6 : 2,
          elevation: 2,
          transform: [{ translateX }, { rotate }],
        }}>
        {dark ? <Moon size={13} color="#05070f" /> : <Sun size={13} color="#d97706" />}
      </Animated.View>
    </Pressable>
  );
}
