import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
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
} from './BodyModelViewer';
import {
  RegisterObservationModal,
  RegionCategoryIcon,
  MinimalPainScaleBar,
} from './RegisterObservationModal';
import { InjuryTimelapseModal } from './InjuryTimelapseModal';
import { HealthQuestionnaireSection } from './HealthQuestionnaireSection';
import { useMission } from './mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { useAppTheme } from '@/theme';
import type { ObservationPrefill } from '@/voice/parser';
import { reportBodyTab, useVoice } from '@/voice/voice-context';
import {
  getBodyConditionsFromBackend,
  syncObservationToBackend,
} from '../../services/mission-api';

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

// Modal de detalle con notas clínicas, indicadores y opciones de edición/borrado
function ProblemDetailModal({
  visible,
  muscle,
  photoCount,
  onClose,
  onEdit,
  onDelete,
  onOpenTimelapse,
}: {
  visible: boolean;
  muscle: MuscleData | null;
  photoCount: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenTimelapse: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const iconInk = isDark ? colors.text : '#0f172a';
  const iconSlate = isDark ? colors.textMuted : '#475569';
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const confirmingDelete = Boolean(visible && muscle && confirmingDeleteId === muscle.id);

  // Animaciones de entrada del modal y barra de dolor
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const [barAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible && muscle?.observation) {
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
          toValue: (muscle.observation.painIntensity || 0) / 10,
          duration: 420,
          delay: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [visible, muscle, sheetAnim, barAnim]);

  if (!visible || !muscle || !muscle.observation) return null;

  const observation = muscle.observation;
  const intensity = observation.painIntensity;
  const painColor = getPainColorHex(intensity);
  const severityLabel = t(getPainSeverityKey(intensity));

  const handleClose = () => {
    setConfirmingDeleteId(null);
    onClose();
  };

  const handleConfirmDelete = () => {
    setConfirmingDeleteId(null);
    onDelete();
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
      onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '78%' }}>
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
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}>
              {/* Encabezado: icono + nombre + badge de dolor + botón cerrar */}
              <View className="flex-row items-start justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    style={{
                      backgroundColor: `${painColor}1A`,
                      borderColor: `${painColor}44`,
                      borderWidth: 1,
                    }}
                    className="mr-3 h-11 w-11 items-center justify-center rounded-2xl">
                    <RegionCategoryIcon category={muscle.category} color={painColor} size={20} />
                  </View>

                  <View className="flex-1">
                    <Text className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
                      {t('body.detail.title')}
                    </Text>
                    <Text className="mt-0.5 font-mono text-base font-extrabold text-slate-900 dark:text-trauma-nightInk">
                      {t(muscleNameKey(muscle.id))}
                    </Text>
                    <View className="mt-0.5 flex-row items-center">
                      <Text className="font-mono text-[10px] text-slate-500 dark:text-trauma-nightMuted">
                        {t(categoryNameKey(muscle.category))}
                      </Text>
                      {!!observation.updatedAt && (
                        <View className="ml-2 flex-row items-center">
                          <Clock size={10} color={colors.textSubtle} />
                          <Text className="ml-1 font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                            {formatObservationUpdatedAt(observation.updatedAt, locale, t)}
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
                      <Zap size={11} color={painColor} strokeWidth={2.4} />
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
                  className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${observation.swelling
                    ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950'
                    : 'border-slate-100 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt'
                    }`}>
                  <Layers
                    size={14}
                    color={observation.swelling ? colors.accentDeep : colors.textMuted}
                    strokeWidth={2}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.detail.swelling')}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                      {observation.swelling ? t('common.yes') : t('common.no')}
                    </Text>
                  </View>
                </View>

                <View
                  className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${observation.functionalLimitation
                    ? 'border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950'
                    : 'border-slate-100 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt'
                    }`}>
                  <MotionStatusIcon
                    size={14}
                    color={observation.functionalLimitation ? colors.accentDeep : colors.textMuted}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.detail.limitation')}</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                      {observation.functionalLimitation ? t('common.yes') : t('common.no')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cuadro de Detalles Escritos */}
              <View className="mt-3.5 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-3.5">
                <View className="mb-1.5 flex-row items-center">
                  <FileText size={13} color={iconSlate} strokeWidth={2} />
                  <Text className="ml-1.5 font-mono text-[10px] font-bold text-slate-700 dark:text-trauma-nightInk">
                    {t('body.detail.written')}
                  </Text>
                </View>
                <Text className="font-mono text-xs leading-5 text-slate-600 dark:text-trauma-nightMuted">
                  {observation.notes || t('body.detail.noNotes')}
                </Text>
              </View>

              {/* Botón de seguimiento fotográfico / Timelapse */}
              <Pressable
                onPress={onOpenTimelapse}
                className="mt-3.5 flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt py-2.5 active:opacity-75">
                <Camera size={14} color={colors.accentDeep} strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                  {t('body.detail.timelapse', { count: photoCount })}
                </Text>
              </Pressable>

              {/* Botones de Acción: Editar / Borrar */}
              {!confirmingDelete ? (
                <View className="mt-4 flex-row items-center justify-between gap-2.5">
                  <Pressable
                    onPress={onEdit}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt py-3 shadow-xs active:opacity-75">
                    <Pencil size={13} color={iconInk} strokeWidth={2.2} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {t('body.detail.edit')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setConfirmingDeleteId(muscle.id)}
                    className="flex-row items-center justify-center rounded-xl border border-red-200 dark:border-red-900 bg-red-50/80 dark:bg-red-950 px-4 py-3 active:opacity-75">
                    <Trash2 size={13} color={colors.danger} strokeWidth={2.1} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-red-600 dark:text-red-300">
                      {t('body.detail.delete')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/90 dark:bg-red-950 p-3">
                  <Text className="flex-1 font-mono text-[10.5px] font-bold text-red-800 dark:text-red-300">
                    {t('body.detail.confirmDelete')}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setConfirmingDeleteId(null)}
                      className="rounded-lg border border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night px-3 py-1.5 active:opacity-75">
                      <Text className="font-mono text-[10.5px] font-bold text-slate-600 dark:text-trauma-nightMuted">
                        {t('common.cancel')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleConfirmDelete}
                      className="rounded-lg bg-red-600 px-3 py-1.5 active:opacity-80">
                      <Text className="font-mono text-[10.5px] font-bold text-white">
                        {t('body.detail.confirmYes')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function BodyView({ onSetScrollEnabled }: BodyViewProps) {
  const { injuryPhotos } = useMission();
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
  const [selectedName, setSelectedName] = useState<string>('Cuello');
  const [zoneSnapshots, setZoneSnapshots] = useState<Record<string, string>>({});
  const [observationModalOpen, setObservationModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailMuscle, setDetailMuscle] = useState<MuscleData | null>(null);
  const [timelapseOpen, setTimelapseOpen] = useState(false);
  const [timelapseMuscle, setTimelapseMuscle] = useState<MuscleData | null>(null);
  const locallyEditedMuscleIds = useRef(new Set<string>());

  useEffect(() => {
    let isMounted = true;
    void getBodyConditionsFromBackend()
      .then((records) => {
        if (!isMounted) return;
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
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.warn('No se pudieron cargar los padecimientos del cuerpo 3D.', error);
        Alert.alert(tRef.current('body.alert.loadTitle'), tRef.current('body.alert.loadMsg'));
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleSaveObservation = (muscleId: string, observation: MuscleObservation | null) => {
    locallyEditedMuscleIds.current.add(muscleId);
    const muscle = muscles.find((item) => item.id === muscleId);
    setMuscles((prev) =>
      prev.map((m) => {
        if (m.id !== muscleId) return m;
        if (!observation || observation.painIntensity === 0) {
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
        `No se encontró la zona muscular ${muscleId} para sincronizar.`
      );
      return;
    }

    void syncObservationToBackend({
      muscleId,
      bodyRegion: muscle.category,
      muscleName: muscle.name,
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

  const openDetailFor = (muscle: MuscleData) => {
    setDetailMuscle(muscle);
    setDetailModalOpen(true);
  };

  const openTimelapseFor = (muscle: MuscleData) => {
    setTimelapseMuscle(muscle);
    setTimelapseOpen(true);
  };

  // Filtra únicamente las zonas que tienen un malestar registrado para la pestaña "Registros Previos"
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
            { id: 'records', label: t('body.tab.records', { count: registeredMuscles.length }) },
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

          {registeredMuscles.length === 0 ? (
            <View className="items-center rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-6">
              <Text className="font-mono text-xs text-trauma-muted dark:text-trauma-nightMuted">
                {t('body.records.empty')}
              </Text>
            </View>
          ) : (
            registeredMuscles.map((m) => {
              const intensity = m.observation?.painIntensity ?? 5;
              const painHex = getPainColorHex(intensity);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => openDetailFor(m)}
                  className="mb-3 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs active:opacity-80">
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
                          {t(categoryNameKey(m.category))}
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
                  <Text className="flex-1 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk" numberOfLines={1}>
                    {t(muscleNameKey(selectedMuscle.id))}
                  </Text>
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
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt py-2 active:opacity-75">
                  <FileText size={13} color={iconInk} strokeWidth={2.2} />
                  <Text className="ml-1.5 font-mono text-[11px] font-bold text-trauma-ink dark:text-trauma-nightInk">
                    {t('body.card.details')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openTimelapseFor(selectedMuscle)}
                  className="flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt px-3 py-2 active:opacity-75">
                  <Camera size={13} color={colors.accentDeep} strokeWidth={2.2} />
                  <Text className="ml-1.5 font-mono text-[11px] font-bold text-slate-800 dark:text-trauma-nightInk">
                    {t('body.card.photos', { count: (injuryPhotos[selectedMuscle.id] ?? []).length })}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Botón para registrar observación si no hay malestar
            <View className="mt-4 items-center rounded-2xl border border-slate-200/80 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
              <View className="mb-2.5 flex-row items-center">
                <RegionCategoryIcon
                  category={selectedMuscle.category}
                  color={colors.accentDeep}
                  size={15}
                />
                <Text className="ml-2 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                  {t(muscleNameKey(selectedMuscle.id))}
                </Text>
                <View className="ml-2 rounded-full bg-slate-100 dark:bg-trauma-nightAlt px-2 py-0.5">
                  <Text className="font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">{t('body.card.noRecord')}</Text>
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
            </View>
          )}
        </>
      )}

      {/* MODAL CORTO: Detalles completos del problema registrado (con editar y borrar) */}
      <ProblemDetailModal
        visible={detailModalOpen}
        muscle={detailMuscle}
        photoCount={detailMuscle ? (injuryPhotos[detailMuscle.id] ?? []).length : 0}
        onClose={() => setDetailModalOpen(false)}
        onEdit={() => {
          if (detailMuscle) {
            setSelectedName(detailMuscle.name);
            setDetailModalOpen(false);
            setObservationModalOpen(true);
          }
        }}
        onDelete={() => {
          if (detailMuscle) {
            handleSaveObservation(detailMuscle.id, null);
            setDetailModalOpen(false);
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

      {/* Modal de formulario para Registrar o Editar Observación */}
      <RegisterObservationModal
        visible={observationModalOpen}
        muscle={selectedMuscle}
        snapshotUri={zoneSnapshots[selectedMuscle.id]}
        prefill={observationPrefill}
        onClose={() => {
          setObservationModalOpen(false);
          setObservationPrefill(undefined);
        }}
        onSave={handleSaveObservation}
      />
    </View>
  );
}
