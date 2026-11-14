import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Vibración sutil en móvil; en web no hace nada. */
export const haptic = {
  listen: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  warp: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

function run(fn: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}
