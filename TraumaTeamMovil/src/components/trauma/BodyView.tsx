import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Camera,
  CheckCircle2,
  History,
  Zap,
  Layers,
  FileText,
  Pencil,
  Trash2,
  X,
  Clock,
  PlusCircle,
  ArrowRight,
} from 'lucide-react-native';
import {
  BodyModelViewer,
  INITIAL_MUSCLES,
  MuscleData,
  MuscleObservation,
  MuscleStatus,
  categoryNameKey,
  formatObservationUpdatedAt,
  getPainColorHex,
  muscleNameKey,
  normalizeBodyRegion,
  UPDATED_NOW,
} from './BodyModelViewer';
import {
  RegisterObservationModal,
  RegionCategoryIcon,
  MinimalPainScaleBar,
} from './RegisterObservationModal';
import { CureConfirmDialog, CureConfirmModal } from './CureConfirmModal';
import { InjuryTimelapseModal } from './InjuryTimelapseModal';
import { HealthQuestionnaireSection } from './HealthQuestionnaireSection';
import { useMission } from './mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { useAppTheme } from '@/theme';
import type { ObservationPrefill } from '@/voice/parser';
import { reportBodyTab, useVoice } from '@/voice/voice-context';
import type { InjuryPhoto } from '../../types/mission';
import {
  BodyConditionRecord,
  getBodyConditionsFromBackend,
  syncObservationToBackend,
} from '../../services/mission-api';
import {
  appendConditionUpdate,
  formatShortUpdateDate,
  parseConditionUpdates,
} from '../../utils/condition-updates';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Vista de exploración anatómica y registro de malestares
interface BodyViewProps {
  onSetScrollEnabled?: (enabled: boolean) => void;
}

// Icono vectorial de limitación funcional
function MotionStatusIcon({ size = 13, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 4.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10.5 9.5L7 12l2.5 3.5L13 13l2 4.5h3.5M6 19l3.5-3.5M4 14h3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Clasificación de severidad según escala de dolor
function getPainSeverityKey(intensity: number): MessageKey {
  if (intensity <= 3) return 'body.severity.mild';
  if (intensity <= 6) return 'body.severity.moderate';
  if (intensity <= 8) return 'body.severity.severe';
  return 'body.severity.critical';
}

// Modal de detalle con historial de actualizaciones (texto + foto), curación e indicadores
function ProblemDetailModal({
  visible,
  muscle,
  resolvedRecord,
  photos,
  onClose,
  onAddUpdate,
  onCure,
  onDelete,
  onReopen,
  onOpenTimelapse,
}: {
  visible: boolean;
  muscle: MuscleData | null;
  resolvedRecord: BodyConditionRecord | null;
  photos: InjuryPhoto[];
  onClose: () => void;
  onAddUpdate: () => void;
  onCure: () => void;
  onDelete: () => void;
  onReopen: () => void;
  onOpenTimelapse: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const iconInk = isDark ? colors.text : '#0f172a';
  const iconSlate = isDark ? colors.textMuted : '#475569';
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingCureId, setConfirmingCureId] = useState<string | null>(null);

  const isResolvedMode = Boolean(resolvedRecord && (!muscle?.observation || resolvedRecord.status === 'resolved'));
  const targetId = resolvedRecord?.muscleId ?? muscle?.id ?? null;
  const confirmingDelete = Boolean(visible && targetId && confirmingDeleteId === targetId);
  const confirmingCure = Boolean(visible && targetId && confirmingCureId === targetId);

  // Animaciones de entrada del modal y barra de dolor
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const [barAnim] = useState(() => new Animated.Value(0));

  const effectivePain = isResolvedMode
    ? 0
    : (muscle?.observation?.painIntensity ?? 0);

  useEffect(() => {
    if (visible && (muscle?.observation || resolvedRecord)) {
      sheetAnim.setValue(0);
      barAnim.setValue(0);

      Animated.parallel([
        Animated.spring(sheetAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(barAnim, {
          toValue: effectivePain / 10,
          duration: 420,
          delay: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [visible, muscle, resolvedRecord, effectivePain, sheetAnim, barAnim]);

  const parsedUpdates = useMemo(() => {
    const rawDescription = isResolvedMode
      ? resolvedRecord?.description ?? ''
      : muscle?.observation?.notes ?? '';
    const fallbackPain = isResolvedMode
      ? resolvedRecord?.painIntensity ?? 0
      : muscle?.observation?.painIntensity;
    const fallbackDateLabel = isResolvedMode
      ? formatShortUpdateDate(resolvedRecord?.resolvedAt ?? resolvedRecord?.updatedAt)
      : muscle?.observation?.updatedAt;

    return parseConditionUpdates({
      description: rawDescription,
      fallbackPain,
      fallbackDateLabel,
      photos,
    });
  }, [isResolvedMode, resolvedRecord, muscle?.observation, photos]);

  if (!visible || !muscle || (!muscle.observation && !resolvedRecord)) return null;

  const observation = muscle.observation;
  const intensity = isResolvedMode ? 0 : (observation?.painIntensity ?? 1);
  const painColor = isResolvedMode ? colors.success : getPainColorHex(intensity);
  const severityLabel = isResolvedMode ? t('body.detail.cured') : t(getPainSeverityKey(intensity));
  const swelling = isResolvedMode
    ? Boolean(resolvedRecord?.swelling)
    : Boolean(observation?.swelling);
  const functionalLimitation = isResolvedMode
    ? Boolean(resolvedRecord?.functionalLimitation)
    : Boolean(observation?.functionalLimitation);
  const headerDate = isResolvedMode
    ? t('body.detail.curedOn', {
        date: formatShortUpdateDate(resolvedRecord?.resolvedAt ?? resolvedRecord?.updatedAt),
      })
    : observation?.updatedAt
      ? formatObservationUpdatedAt(observation.updatedAt, locale, t)
      : '';

  const handleClose = () => {
    setConfirmingDeleteId(null);
    setConfirmingCureId(null);
    onClose();
  };

  const handleConfirmDelete = () => {
    setConfirmingDeleteId(null);
    onDelete();
  };

  const handleConfirmCure = () => {
    setConfirmingCureId(null);
    onCure();
  };

  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });
  const opacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => (confirmingCure ? setConfirmingCureId(null) : handleClose())}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '84%' }}>
          <Animated.View
            style={{
              opacity,
              transform: [{ translateY }],
            }}
            className="overflow-hidden rounded-t-3xl border-t border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night shadow-2xl">
            {/* Tira superior de color gradual */}
            <View style={{ height: 4, width: '100%', backgroundColor: painColor }} />

            {/* Píldora sutil de arrastre / decoración */}
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 dark:bg-trauma-nightLine" />

            <ScrollView
              className="p-5"
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}>
              {/* Encabezado: icono + nombre + badge de dolor/curado + botón cerrar */}
              <View className="flex-row items-start justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    style={{
                      backgroundColor: `${painColor}1A`,
                      borderColor: `${painColor}44`,
                      borderWidth: 1,
                    }}
                    className="mr-3 h-11 w-11 items-center justify-center rounded-2xl">
                    {isResolvedMode ? (
                      <CheckCircle2 size={21} color={colors.success} strokeWidth={2.2} />
                    ) : (
                      <RegionCategoryIcon category={muscle.category} color={painColor} size={20} />
                    )}
                  </View>

                  <View className="flex-1">
                    <Text
                      className={`font-mono text-[9px] font-bold uppercase tracking-wider ${
                        isResolvedMode
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-slate-400 dark:text-trauma-nightSubtle'
                      }`}>
                      {isResolvedMode ? t('body.detail.historyCured') : t('body.detail.title')}
                    </Text>
                    <Text className="mt-0.5 font-mono text-base font-extrabold text-slate-900 dark:text-trauma-nightInk">
                      {t(muscleNameKey(muscle.id))}
                    </Text>
                    <View className="mt-0.5 flex-row flex-wrap items-center">
                      <Text className="font-mono text-[10px] text-slate-500 dark:text-trauma-nightMuted">
                        {t(categoryNameKey(muscle.category))}
                      </Text>
                      {!!headerDate && (
                        <View className="ml-2 flex-row items-center">
                          <Clock size={10} color={colors.textSubtle} />
                          <Text className="ml-1 font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                            {headerDate}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Badge y botón cerrar */}
                <View className="flex-row items-center gap-2">
                  <View
                    style={{
                      backgroundColor: `${painColor}1A`,
                      borderColor: painColor,
                      borderWidth: 1,
                    }}
                    className="items-end rounded-xl px-2.5 py-1">
                    <View className="flex-row items-baseline">
                      {isResolvedMode ? (
                        <CheckCircle2 size={11} color={colors.success} strokeWidth={2.4} />
                      ) : (
                        <Zap size={11} color={painColor} strokeWidth={2.4} />
                      )}
                      <Text className="ml-1 font-mono text-xs font-extrabold text-slate-900 dark:text-trauma-nightInk">
                        {intensity}
                      </Text>
                      <Text className="font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">/10</Text>
                    </View>
                    <Text className="font-mono text-[8.5px] font-bold text-slate-600 dark:text-trauma-nightMuted">
                      {severityLabel}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleClose}
                    accessibilityLabel={t('common.close')}
                    className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt active:bg-slate-200 dark:active:bg-trauma-nightLine">
                    <X size={15} color={iconSlate} strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>

              {/* Barra de progreso de intensidad */}
              <View className="mt-3.5">
                <View className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-trauma-nightAlt">
                  <Animated.View
                    style={{
                      width: barWidth,
                      height: '100%',
                      backgroundColor: painColor,
                      borderRadius: 999,
                    }}
                  />
                </View>
              </View>

              {/* Chips clínicos: Hinchazón & Limitación funcional */}
              <View className="mt-3.5 flex-row gap-2">
                <View
                  className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${
                    swelling
                      ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950'
                      : 'border-slate-100 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt'
                  }`}>
                  <Layers
                    size={14}
                    color={swelling ? colors.accentDeep : colors.textMuted}
                    strokeWidth={2}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.detail.swelling')}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                      {swelling ? t('common.yes') : t('common.no')}
                    </Text>
                  </View>
                </View>

                <View
                  className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${
                    functionalLimitation
                      ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950'
                      : 'border-slate-100 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt'
                  }`}>
                  <MotionStatusIcon
                    size={14}
                    color={functionalLimitation ? colors.accentDeep : colors.textMuted}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.detail.limitation')}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                      {functionalLimitation ? t('common.yes') : t('common.no')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Línea temporal de Update 1, Update 2, ... */}
              <View className="mt-3.5 rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5 dark:bg-trauma-nightBg dark:border-trauma-nightLine">
                <View className="mb-2.5 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <FileText size={13} color={iconSlate} strokeWidth={2} />
                    <Text className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-trauma-nightInk">
                      Actualizaciones registradas ({parsedUpdates.length})
                    </Text>
                  </View>
                </View>

                {parsedUpdates.length === 0 ? (
                  <Text className="font-mono text-xs leading-5 text-slate-500 dark:text-trauma-nightMuted">
                    {t('body.detail.noNotes')}
                  </Text>
                ) : (
                  <View className="gap-2.5">
                    {parsedUpdates.map((item) => {
                      const itemPainColor =
                        item.isResolvedEvent || item.painIntensity === 0
                          ? '#10b981'
                          : item.painIntensity
                            ? getPainColorHex(item.painIntensity)
                            : colors.textMuted;
                      return (
                        <View
                          key={`${item.updateNumber}-${item.dateLabel}`}
                          className={`rounded-xl border p-2.5 ${
                            item.isResolvedEvent
                              ? 'border-emerald-200 bg-emerald-50/70'
                              : 'border-slate-200/80 bg-white'
                          }`}>
                          <View className="flex-row items-center justify-between gap-2">
                            <View className="flex-row items-center gap-1.5">
                              <Text
                                className={`font-mono text-[10.5px] font-extrabold ${
                                  item.isResolvedEvent ? 'text-emerald-800' : 'text-slate-900'
                                }`}>
                                {item.title}
                              </Text>
                              {!!item.dateLabel && (
                                <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                                  · {item.dateLabel}
                                </Text>
                              )}
                            </View>

                            {(item.isResolvedEvent || item.painIntensity !== undefined) && (
                              <View
                                style={{
                                  backgroundColor: `${itemPainColor}18`,
                                  borderColor: `${itemPainColor}55`,
                                  borderWidth: 1,
                                }}
                                className="rounded-md px-1.5 py-0.5">
                                <Text className="font-mono text-[9px] font-bold text-slate-700 dark:text-trauma-nightInk">
                                  {item.isResolvedEvent || item.painIntensity === 0
                                    ? t('body.detail.curedPain')
                                    : `${item.painIntensity}/10`}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text className="mt-1.5 font-mono text-xs leading-5 text-slate-700 dark:text-trauma-nightInk">
                            {item.text}
                          </Text>

                          {!!item.photoUri && (
                            <Pressable
                              onPress={onOpenTimelapse}
                              className="mt-2 flex-row items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-1.5 active:opacity-80 dark:bg-trauma-nightAlt dark:border-trauma-nightLine">
                              <Image
                                source={{ uri: item.photoUri }}
                                className="h-14 w-14 rounded-md bg-slate-200 dark:bg-trauma-nightLine"
                                resizeMode="cover"
                              />
                              <View className="flex-1">
                                <Text className="font-mono text-[10px] font-bold text-slate-700 dark:text-trauma-nightInk">
                                  {t('body.detail.photoOf', { title: item.title })}
                                </Text>
                                <Text className="font-mono text-[9px] text-sky-600 dark:text-sky-300">
                                  {t('body.detail.photoOpen')}
                                </Text>
                              </View>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Botón de seguimiento fotográfico / Timelapse */}
              <Pressable
                onPress={onOpenTimelapse}
                className="mt-3.5 flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt py-2.5 active:opacity-75">
                <Camera size={14} color={colors.accentDeep} strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                  {t('body.detail.timelapse', { count: photos.length })}
                </Text>
              </Pressable>

              {/* Botones de Acción según estado (Activo vs Historial Curado) */}
              {isResolvedMode ? (
                <View className="mt-4">
                  <Pressable
                    onPress={onReopen}
                    className="flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 shadow-xs active:opacity-75">
                    <PlusCircle size={14} color={iconInk} strokeWidth={2.2} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {t('body.detail.reopen')}
                    </Text>
                  </Pressable>
                </View>
              ) : confirmingDelete ? (
                <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-red-200 bg-red-50/90 p-3">
                  <Text className="flex-1 font-mono text-[10.5px] font-bold text-red-800">
                    {t('body.detail.confirmDelete')}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setConfirmingDeleteId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 active:opacity-75 dark:bg-trauma-night dark:border-trauma-nightLine">
                      <Text className="font-mono text-[10px] font-bold text-slate-600 dark:text-trauma-nightMuted">
                        {t('common.cancel')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleConfirmDelete}
                      className="rounded-lg bg-red-600 px-3 py-1.5 active:opacity-80">
                      <Text className="font-mono text-[10px] font-bold text-white">
                        {t('body.detail.confirmYes')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="mt-4 gap-2.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Pressable
                      onPress={onAddUpdate}
                      className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 shadow-xs active:opacity-75">
                      <Pencil size={13} color={iconInk} strokeWidth={2.2} />
                      <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                        {t('body.detail.addUpdate')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setConfirmingDeleteId(muscle.id)}
                      className="flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-3 active:opacity-75">
                      <Trash2 size={13} color={colors.danger} strokeWidth={2.1} />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => setConfirmingCureId(muscle.id)}
                    className="flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft px-4 py-3 shadow-xs active:opacity-75 dark:bg-cyan-950">
                    <CheckCircle2 size={15} color={iconInk} strokeWidth={2.2} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {t('body.detail.cureBtn')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Pressable>

        {confirmingCure && (
          <CureConfirmDialog
            zoneName={t(muscleNameKey(muscle.id))}
            onCancel={() => setConfirmingCureId(null)}
            onConfirm={handleConfirmCure}
          />
        )}
      </Pressable>
    </Modal>
  );
}

export function BodyView({ onSetScrollEnabled }: BodyViewProps) {
  const { injuryPhotos, refreshInjuryPhotos } = useMission();
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const { colors, scheme } = useAppTheme();
  const iconInk = scheme === 'dark' ? colors.text : '#0f172a';
  const { bodyIntent, consumeBodyIntent } = useVoice();
  const [tab, setTabState] = useState<'body' | 'health' | 'records'>('body');
  // La voz necesita saber en qué pestaña está el usuario (S5): se reporta en cada cambio.
  const setTab = (next: 'body' | 'health' | 'records') => {
    reportBodyTab(next);
    setTabState(next);
  };
  useEffect(() => () => reportBodyTab('body'), []);
  const [muscles, setMuscles] = useState<MuscleData[]>(INITIAL_MUSCLES);
  const [resolvedConditions, setResolvedConditions] = useState<BodyConditionRecord[]>([]);
  const [selectedName, setSelectedName] = useState<string>('Neck');
  const [zoneSnapshots, setZoneSnapshots] = useState<Record<string, string>>({});
  const [observationModalOpen, setObservationModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailMuscle, setDetailMuscle] = useState<MuscleData | null>(null);
  const [detailResolvedRecord, setDetailResolvedRecord] =
    useState<BodyConditionRecord | null>(null);
  const [timelapseOpen, setTimelapseOpen] = useState(false);
  const [timelapseMuscle, setTimelapseMuscle] = useState<MuscleData | null>(null);
  const [pendingCureMuscle, setPendingCureMuscle] = useState<MuscleData | null>(null);
  const locallyEditedMuscleIds = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;
    void getBodyConditionsFromBackend()
      .then((records) => {
        if (!isMounted) return;

        const resolvedList = records
          .filter((item) => item.status === 'resolved')
          .sort((a, b) => {
            const ta = Date.parse(a.resolvedAt ?? a.updatedAt ?? a.recordedAt) || 0;
            const tb = Date.parse(b.resolvedAt ?? b.updatedAt ?? b.recordedAt) || 0;
            return tb - ta;
          });
        setResolvedConditions(resolvedList);

        setMuscles((currentMuscles) =>
          currentMuscles.map((muscle) => {
            if (locallyEditedMuscleIds.current.has(muscle.id)) return muscle;
            const record = records.find(
              (item) =>
                item.muscleId.trim().toLowerCase() === muscle.id.toLowerCase() &&
                item.status === 'active'
            );
            if (!record || record.painIntensity <= 0) return muscle;

            // Se guarda en ISO y se localiza al mostrarlo (formatObservationUpdatedAt).
            const normalizedDate = new Date(record.recordedAt.replace(' ', 'T'));
            const updatedAt = Number.isNaN(normalizedDate.getTime())
              ? record.recordedAt
              : normalizedDate.toISOString();

            return {
              ...muscle,
              status: record.painIntensity >= 7 ? 'critical' : 'warning',
              observation: {
                painIntensity: record.painIntensity,
                swelling: record.swelling,
                functionalLimitation: record.functionalLimitation,
                notes: record.description ?? '',
                updatedAt,
              },
            };
          })
        );

        // Pre-carga las fotos de cada condición (activa o historial) desde el backend
        const uniqueZones = new Map<string, string>();
        records.forEach((record) => {
          const normalizedId = record.muscleId.trim();
          if (normalizedId && !uniqueZones.has(normalizedId)) {
            uniqueZones.set(normalizedId, record.muscleName);
          }
        });
        uniqueZones.forEach((mName, mId) => {
          void refreshInjuryPhotos(mId, mName).catch(() => {});
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.warn('Could not load the 3D body conditions.', error);
        Alert.alert(tRef.current('body.alert.loadTitle'), tRef.current('body.alert.loadMsg'));
      });

    return () => {
      isMounted = false;
    };
  }, [refreshInjuryPhotos]);

  // Comandos de voz: se aplican durante el render (sin setState en efectos) y se consumen una sola vez.
  const [handledVoiceNonce, setHandledVoiceNonce] = useState(0);
  const [observationPrefill, setObservationPrefill] = useState<ObservationPrefill | undefined>(undefined);
  if (bodyIntent && bodyIntent.nonce !== handledVoiceNonce) {
    setHandledVoiceNonce(bodyIntent.nonce);
    if (bodyIntent.tab) setTab(bodyIntent.tab);
    const target = bodyIntent.muscleId ? muscles.find((m) => m.id === bodyIntent.muscleId) : undefined;
    if (target) {
      setSelectedName(target.name);
      const hasProblem = target.status !== 'normal' && Boolean(target.observation);
      if (bodyIntent.action === 'register') {
        // Si ya hay un problema guardado, el mismo formulario funciona como edición.
        setObservationPrefill(bodyIntent.prefill);
        setObservationModalOpen(true);
      } else if (bodyIntent.action === 'detail' && hasProblem) {
        setDetailMuscle(target);
        setDetailModalOpen(true);
      } else if (bodyIntent.action === 'photos') {
        setTimelapseMuscle(target);
        setTimelapseOpen(true);
      }
    }
  }
  useEffect(() => {
    if (bodyIntent) consumeBodyIntent(bodyIntent.nonce);
  }, [bodyIntent, consumeBodyIntent]);

  const selectedMuscle =
    muscles.find((m) => m.name.toLowerCase() === selectedName.toLowerCase()) || muscles[0];

  const hasSavedProblem =
    selectedMuscle.status !== 'normal' && Boolean(selectedMuscle.observation);

  const selectedResolvedRecord =
    resolvedConditions.find(
      (item) => item.muscleId.trim().toLowerCase() === selectedMuscle.id.toLowerCase()
    ) ?? null;

  const handleSaveObservation = (
    muscleId: string,
    observation: MuscleObservation | null,
    options?: { isCured?: boolean; latestUpdateNote?: string }
  ) => {
    locallyEditedMuscleIds.current.add(muscleId);
    const muscle = muscles.find((item) => item.id === muscleId);
    const isCured = Boolean(options?.isCured || (observation && observation.painIntensity === 0));

    setMuscles((prev) =>
      prev.map((m) => {
        if (m.id !== muscleId) return m;
        if (!observation || isCured) {
          return { ...m, status: 'normal', observation: undefined };
        }
        const newStatus: MuscleStatus =
          observation.painIntensity >= 7 ? 'critical' : 'warning';
        return {
          ...m,
          status: newStatus,
          observation,
        };
      })
    );
    if (!muscle) {
      console.error(
        `Muscle zone ${muscleId} not found for syncing.`
      );
      return;
    }

    if (isCured && observation) {
      const nowIso = new Date().toISOString();
      const curedEntry: BodyConditionRecord = {
        id: `local-resolved-${muscleId}`,
        muscleId,
        bodyRegion: muscle.category,
        muscleName: muscle.name,
        conditionName: `Pain in ${muscle.name}`,
        description: observation.notes,
        painIntensity: 1,
        swelling: false,
        functionalLimitation: false,
        status: 'resolved',
        recordedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: nowIso,
      };
      setResolvedConditions((prev) => [
        curedEntry,
        ...prev.filter((item) => item.muscleId.trim().toLowerCase() !== muscleId.toLowerCase()),
      ]);
    } else if (observation && !isCured) {
      // Si se reactivó una zona que estaba en historial, se mueve a activos
      setResolvedConditions((prev) =>
        prev.filter((item) => item.muscleId.trim().toLowerCase() !== muscleId.toLowerCase())
      );
    }

    void syncObservationToBackend({
      muscleId,
      bodyRegion: muscle.category,
      muscleName: muscle.name,
      resolveAfterSave: isCured,
      observation: observation
        ? {
          painIntensity: observation.painIntensity,
          swelling: observation.swelling,
          functionalLimitation: observation.functionalLimitation,
          notes: observation.notes,
        }
        : null,
    }).then(({ synced }) => {
      if (!synced) {
        Alert.alert(tRef.current('body.alert.syncTitle'), tRef.current('body.alert.syncMsg'));
      }
    });
  };

  const handleDirectCureMuscle = (muscle: MuscleData) => {
    const existingNotes = muscle.observation?.notes ?? '';
    const { serializedDescription } = appendConditionUpdate({
      existingDescription: existingNotes,
      newText: 'I no longer feel the symptom; discomfort overcome.',
      painIntensity: 0,
      isResolvedEvent: true,
      fallbackPain: muscle.observation?.painIntensity,
      fallbackDateLabel: muscle.observation?.updatedAt,
    });

    handleSaveObservation(
      muscle.id,
      {
        painIntensity: 0,
        swelling: false,
        functionalLimitation: false,
        notes: serializedDescription,
        updatedAt: UPDATED_NOW,
      },
      { isCured: true, latestUpdateNote: 'I no longer feel the symptom; discomfort overcome.' }
    );
  };

  const openDetailFor = (muscle: MuscleData, resolvedRecord: BodyConditionRecord | null = null) => {
    setDetailMuscle(muscle);
    setDetailResolvedRecord(resolvedRecord);
    setDetailModalOpen(true);
  };

  const openTimelapseFor = (muscle: MuscleData) => {
    setTimelapseMuscle(muscle);
    setTimelapseOpen(true);
  };

  // Filtra únicamente las zonas que tienen un malestar activo para la pestaña "Registros"
  const registeredMuscles = muscles.filter((m) => m.status !== 'normal' && m.observation);

  // Color gradual de la zona seleccionada actualmente (si tiene malestar registrado)
  const selectedPainColor = selectedMuscle.observation?.painIntensity
    ? getPainColorHex(selectedMuscle.observation.painIntensity)
    : colors.accentDeep;

  return (
    <View className="px-5 pb-10 pt-5">
      {/* Pestañas superiores: Vista Corporal / Cuestionario / Registros */}
      <View className="mb-5 flex-row gap-2">
        {(
          [
            { id: 'body', label: t('body.tab.view3d') },
            { id: 'health', label: t('body.tab.questionnaire') },
            {
              id: 'records',
              label: t('body.tab.records', {
                count: registeredMuscles.length + resolvedConditions.length,
              }),
            },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            className={`flex-1 items-center rounded-md border px-2 py-1.5 active:opacity-70 ${tab === t.id
                ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                : 'border-trauma-ink dark:border-trauma-nightLine bg-white dark:bg-trauma-night'
              }`}>
            <Text className="font-mono text-[11px] font-bold text-trauma-ink dark:text-trauma-nightInk" numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'health' ? (
        <HealthQuestionnaireSection />
      ) : tab === 'records' ? (
        <View className="mt-1">
          <Text className="mb-4 text-center font-mono text-base font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('body.records.title')}
          </Text>

          {/* Escala minimalista en la pestaña de registros */}
          <View className="mb-4 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3 shadow-xs">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="font-mono text-[10px] font-bold text-slate-700 dark:text-trauma-nightInk">
                {t('body.records.painScale')}
              </Text>
              <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.records.gradual')}</Text>
            </View>
            <MinimalPainScaleBar showLabels />
          </View>

          <Text className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-trauma-nightMuted">
            {t('body.records.active', { count: registeredMuscles.length })}
          </Text>

          {registeredMuscles.length === 0 ? (
            <View className="mb-5 items-center rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-5">
              <Text className="font-mono text-xs text-trauma-muted dark:text-trauma-nightMuted">
                {t('body.records.empty')}
              </Text>
            </View>
          ) : (
            <View className="mb-5">
              {registeredMuscles.map((m) => {
                const intensity = m.observation?.painIntensity ?? 5;
                const painHex = getPainColorHex(intensity);
                const updatesCount = parseConditionUpdates({
                  description: m.observation?.notes ?? '',
                  fallbackPain: intensity,
                  fallbackDateLabel: m.observation?.updatedAt,
                  photos: injuryPhotos[m.id] ?? [],
                }).length;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => openDetailFor(m)}
                    className="mb-3 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs active:opacity-80 dark:bg-trauma-night dark:border-trauma-nightLine">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 flex-row items-center pr-2">
                        <View
                          style={{
                            backgroundColor: `${painHex}1A`,
                            borderColor: `${painHex}44`,
                            borderWidth: 1,
                          }}
                          className="mr-2.5 h-10 w-10 items-center justify-center rounded-xl">
                          <RegionCategoryIcon category={m.category} color={painHex} size={18} />
                        </View>
                        <View className="flex-1">
                          <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                            {t(muscleNameKey(m.id))}
                          </Text>
                          <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                            {t(categoryNameKey(m.category))} · {updatesCount}{' '}
                            {t(updatesCount === 1 ? 'body.records.updatesOne' : 'body.records.updatesMany')}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <View
                          style={{
                            backgroundColor: `${painHex}1A`,
                            borderColor: painHex,
                            borderWidth: 1,
                          }}
                          className="flex-row items-center rounded-lg px-2 py-0.5">
                          <Zap size={10} color={painHex} />
                          <Text className="ml-1 font-mono text-[10px] font-bold text-slate-800 dark:text-trauma-nightInk">
                            {intensity}/10
                          </Text>
                        </View>
                        <ArrowRight size={14} color={colors.textSubtle} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Historial de Malestares (Curados) */}
          <View className="mb-2 flex-row items-center">
            <History size={13} color={colors.success} strokeWidth={2.2} />
            <Text className="ml-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-800">
              {t('body.records.history', { count: resolvedConditions.length })}
            </Text>
          </View>

          {resolvedConditions.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-slate-200 bg-white/80 p-5 dark:border-trauma-nightLine">
              <Text className="text-center font-mono text-[11px] text-slate-400 dark:text-trauma-nightSubtle">
                {t('body.records.historyEmpty')}
              </Text>
            </View>
          ) : (
            resolvedConditions.map((rec) => {
              const targetMuscle =
                muscles.find((item) => item.id.toLowerCase() === rec.muscleId.trim().toLowerCase()) ??
                ({
                  id: rec.muscleId,
                  name: rec.muscleName,
                  category: normalizeBodyRegion(rec.bodyRegion),
                  status: 'normal',
                } as MuscleData);
              const recPhotos = injuryPhotos[targetMuscle.id] ?? [];
              const parsed = parseConditionUpdates({
                description: rec.description ?? '',
                fallbackPain: rec.painIntensity,
                fallbackDateLabel: formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt),
                photos: recPhotos,
              });
              const resolvedDate = formatShortUpdateDate(rec.resolvedAt ?? rec.updatedAt);

              return (
                <Pressable
                  key={rec.id || rec.muscleId}
                  onPress={() => openDetailFor(targetMuscle, rec)}
                  className="mb-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/35 p-3.5 shadow-xs active:opacity-80 dark:border-emerald-400/30 dark:bg-emerald-950/40">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center pr-2">
                      <View className="mr-2.5 h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100/70">
                        <CheckCircle2 size={18} color={colors.success} strokeWidth={2.2} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-mono text-xs font-bold text-slate-900 dark:text-trauma-nightInk">
                          {t(muscleNameKey(targetMuscle.id))}
                        </Text>
                        <Text className="font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted">
                          {parsed.length}{' '}
                          {t(parsed.length === 1 ? 'body.records.updatesOne' : 'body.records.updatesMany')} ·{' '}
                          {recPhotos.length}{' '}
                          {t(recPhotos.length === 1 ? 'body.records.photoOne' : 'body.records.photoMany')}
                        </Text>
                        {!!resolvedDate && (
                          <Text className="font-mono text-[9px] text-emerald-700">
                            {t('body.records.curedOn', { date: resolvedDate })}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                      <View className="rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-0.5 dark:border-emerald-400/40 dark:bg-emerald-950">
                        <Text className="font-mono text-[9px] font-bold text-emerald-900 dark:text-emerald-200">
                          {t('body.detail.cured')}
                        </Text>
                      </View>
                      <ArrowRight size={14} color={colors.success} />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : (
        <>
          <Text className="mb-3 text-center font-mono text-base font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('body.select.title')}
          </Text>

          {/* Cuadro del Visor 3D Interactivo dividido en 34 zonas anatómicas */}
          <View
            className="overflow-hidden rounded-3xl border border-trauma-line dark:border-trauma-nightLine bg-trauma-bg dark:bg-trauma-nightBg shadow-md"
            style={{ minHeight: 375 }}>
            <BodyModelViewer
              muscles={muscles}
              selectedMuscle={selectedName}
              onSelectMuscle={(name) => setSelectedName(name)}
              isLocked={false}
              onTouchStateChange={(touching) => {
                onSetScrollEnabled?.(!touching);
              }}
              onZoneSnapshot={(zoneId, dataUrl) => {
                setZoneSnapshots((prev) => ({ ...prev, [zoneId]: dataUrl }));
              }}
            />
          </View>

          {/* Barra inferior de ayuda y botón Fijar Vista */}
          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="flex-1 font-mono text-[9px] text-trauma-ink dark:text-trauma-nightInk">
              {t('body.select.help')}
            </Text>
          </View>

          {/* Barra de escala de dolor */}
          <View className="mt-3 px-1">
            <MinimalPainScaleBar showLabels />
          </View>

          {/* Tarjeta simplificada de problema registrado */}
          {hasSavedProblem ? (
            <View className="mt-4 rounded-2xl border border-slate-200/90 dark:border-trauma-nightLine bg-white dark:bg-trauma-night px-3.5 py-3 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    style={{ backgroundColor: selectedPainColor }}
                    className="mr-2 h-2.5 w-2.5 rounded-full"
                  />
                  <View className="flex-1">
                    <Text className="font-mono text-xs font-bold text-slate-900 dark:text-trauma-nightInk" numberOfLines={1}>
                      {t(muscleNameKey(selectedMuscle.id))}
                    </Text>
                    <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                      {t('body.card.activeUpdates', {
                        count: parseConditionUpdates({
                          description: selectedMuscle.observation?.notes ?? '',
                          fallbackPain: selectedMuscle.observation?.painIntensity,
                          fallbackDateLabel: selectedMuscle.observation?.updatedAt,
                          photos: injuryPhotos[selectedMuscle.id] ?? [],
                        }).length,
                      })}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: `${selectedPainColor}18`,
                    borderColor: selectedPainColor,
                    borderWidth: 1,
                  }}
                  className="rounded-lg px-2 py-0.5">
                  <Text className="font-mono text-[11px] font-extrabold text-slate-800 dark:text-trauma-nightInk">
                    {selectedMuscle.observation?.painIntensity}/10
                  </Text>
                </View>
              </View>

              <View className="mt-2.5 flex-row gap-2">
                <Pressable
                  onPress={() => openDetailFor(selectedMuscle)}
                  className="flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt px-3 py-2 active:opacity-75">
                  <FileText size={13} color={iconInk} strokeWidth={2.2} />
                  <Text className="ml-1 font-mono text-[10.5px] font-bold text-slate-800 dark:text-trauma-nightInk">
                    {t('body.card.details')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setObservationModalOpen(true)}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-2 active:opacity-75">
                  <Pencil size={13} color={iconInk} strokeWidth={2.2} />
                  <Text className="ml-1 font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
                    {t('body.card.addUpdate')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openTimelapseFor(selectedMuscle)}
                  className="flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt px-2.5 py-2 active:opacity-75">
                  <Camera size={13} color={colors.accentDeep} strokeWidth={2.2} />
                  <Text className="ml-1 font-mono text-[10.5px] font-bold text-slate-800 dark:text-trauma-nightInk">
                    {(injuryPhotos[selectedMuscle.id] ?? []).length}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setPendingCureMuscle(selectedMuscle)}
                className="mt-2.5 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft px-4 py-2.5 shadow-xs active:opacity-75 dark:bg-cyan-950">
                <CheckCircle2 size={14} color={iconInk} strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-[11px] font-bold text-trauma-ink dark:text-trauma-nightInk">
                  {t('body.detail.cureBtn')}
                </Text>
              </Pressable>
            </View>
          ) : (
            // Botón para registrar observación si no hay malestar activo
            <View className="mt-4 items-center rounded-2xl border border-slate-200/80 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
              <View className="mb-2.5 flex-row items-center">
                <RegionCategoryIcon
                  category={selectedMuscle.category}
                  color={selectedResolvedRecord ? colors.success : colors.accentDeep}
                  size={15}
                />
                <Text className="ml-2 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                  {t(muscleNameKey(selectedMuscle.id))}
                </Text>
                <View
                  className={`ml-2 rounded-full px-2 py-0.5 ${
                    selectedResolvedRecord
                      ? 'bg-emerald-100 dark:bg-emerald-950'
                      : 'bg-slate-100 dark:bg-trauma-nightAlt'
                  }`}>
                  <Text
                    className={`font-mono text-[9px] font-bold ${
                      selectedResolvedRecord
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-slate-500 dark:text-trauma-nightMuted'
                    }`}>
                    {selectedResolvedRecord ? t('body.card.curedPrev') : t('body.card.noRecord')}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setObservationModalOpen(true)}
                className="w-full flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt px-5 py-2.5 shadow-xs active:opacity-75">
                <PlusCircle size={14} color={iconInk} strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                  {t('body.card.register')}
                </Text>
              </Pressable>

              {selectedResolvedRecord && (
                <Pressable
                  onPress={() => openDetailFor(selectedMuscle, selectedResolvedRecord)}
                  className="mt-2 w-full flex-row items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 active:opacity-75">
                  <History size={13} color={colors.success} strokeWidth={2.2} />
                  <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-emerald-900">
                    {t('body.card.viewCured')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}

      {/* MODAL CORTO: Detalles completos del problema / historial (actualizaciones, curar, borrar) */}
      <ProblemDetailModal
        visible={detailModalOpen}
        muscle={detailMuscle}
        resolvedRecord={detailResolvedRecord}
        photos={detailMuscle ? (injuryPhotos[detailMuscle.id] ?? []) : []}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailResolvedRecord(null);
        }}
        onAddUpdate={() => {
          if (detailMuscle) {
            setSelectedName(detailMuscle.name);
            setDetailModalOpen(false);
            setDetailResolvedRecord(null);
            setObservationModalOpen(true);
          }
        }}
        onCure={() => {
          if (detailMuscle) {
            handleDirectCureMuscle(detailMuscle);
            setDetailModalOpen(false);
            setDetailResolvedRecord(null);
          }
        }}
        onReopen={() => {
          if (detailMuscle) {
            setSelectedName(detailMuscle.name);
            setDetailModalOpen(false);
            setDetailResolvedRecord(null);
            setObservationModalOpen(true);
          }
        }}
        onDelete={() => {
          if (detailMuscle) {
            handleSaveObservation(detailMuscle.id, null);
            setDetailModalOpen(false);
            setDetailResolvedRecord(null);
          }
        }}
        onOpenTimelapse={() => {
          if (detailMuscle) {
            setDetailModalOpen(false);
            openTimelapseFor(detailMuscle);
          }
        }}
      />

      {/* Modal de seguimiento fotográfico y timelapse */}
      <InjuryTimelapseModal
        visible={timelapseOpen}
        muscle={timelapseMuscle}
        onClose={() => setTimelapseOpen(false)}
      />

      {/* Modal de formulario para Registrar o Agregar Actualización */}
      <RegisterObservationModal
        visible={observationModalOpen}
        muscle={selectedMuscle}
        mode={selectedMuscle.observation ? 'update' : 'create'}
        existingPhotos={injuryPhotos[selectedMuscle.id] ?? []}
        snapshotUri={zoneSnapshots[selectedMuscle.id]}
        prefill={observationPrefill}
        onClose={() => {
          setObservationModalOpen(false);
          setObservationPrefill(undefined);
        }}
        onSave={handleSaveObservation}
      />

      {/* Modal de confirmación antes de marcar el síntoma como resuelto */}
      <CureConfirmModal
        visible={Boolean(pendingCureMuscle)}
        zoneName={pendingCureMuscle ? t(muscleNameKey(pendingCureMuscle.id)) : ''}
        onCancel={() => setPendingCureMuscle(null)}
        onConfirm={() => {
          if (pendingCureMuscle) {
            handleDirectCureMuscle(pendingCureMuscle);
          }
          setPendingCureMuscle(null);
        }}
      />
    </View>
  );
}
