import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n/I18nProvider';

interface CureConfirmDialogProps {
  zoneName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Diálogo reutilizable para confirmar que el síntoma ya desapareció antes de moverlo al historial. */
export function CureConfirmDialog({
  zoneName,
  onCancel,
  onConfirm,
}: CureConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 60,
        backgroundColor: 'rgba(2, 6, 23, 0.58)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}>
      <Pressable
        onPress={onCancel}
        accessibilityLabel={t('common.cancel')}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <Pressable
        onPress={(e) => e.stopPropagation?.()}
        className="w-full max-w-[340px] rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-trauma-nightLine dark:bg-trauma-night">
        <Text className="font-mono text-sm font-extrabold text-slate-900 dark:text-trauma-nightInk">
          {t('body.detail.cureAsk', { zone: zoneName })}
        </Text>
        <Text className="mt-2 font-mono text-[11px] leading-4 text-slate-500 dark:text-trauma-nightMuted">
          {t('body.detail.cureNote')}
        </Text>

        <View className="mt-5 flex-row items-center gap-2.5">
          <Pressable
            onPress={onCancel}
            className="flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-3 active:opacity-75 dark:border-trauma-nightLine dark:bg-trauma-nightAlt">
            <Text className="font-mono text-xs font-bold text-slate-700 dark:text-trauma-nightMuted">
              {t('common.cancel')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            className="flex-1 items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 shadow-xs active:opacity-75 dark:bg-cyan-950">
            <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
              {t('body.detail.cureYes')}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

/** Modal nativo de confirmación para pantallas sin un Modal padre abierto. */
export function CureConfirmModal({
  visible,
  zoneName,
  onCancel,
  onConfirm,
}: CureConfirmDialogProps & { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <CureConfirmDialog zoneName={zoneName} onCancel={onCancel} onConfirm={onConfirm} />
    </Modal>
  );
}
