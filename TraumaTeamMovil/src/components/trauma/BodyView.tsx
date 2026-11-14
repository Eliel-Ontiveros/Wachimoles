import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
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
  getPainColorHex,
} from './BodyModelViewer';
import {
  RegisterObservationModal,
  RegionCategoryIcon,
  MinimalPainScaleBar,
} from './RegisterObservationModal';
import { InjuryTimelapseModal } from './InjuryTimelapseModal';
import { HealthQuestionnaireSection } from './HealthQuestionnaireSection';
import { useMission } from './mission-context';
import {
  getBodyConditionsFromBackend,
  syncObservationToBackend,
} from '../../services/mission-api';

// Vista de exploración anatómica y registro de malestares
interface BodyViewProps {
  onSetScrollEnabled?: (enabled: boolean) => void;
}

// Icono vectorial de limitación funcional
function MotionStatusIcon({ size = 13, color = '#475569' }: { size?: number; color?: string }) {
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
function getPainSeverityLabel(intensity: number): string {
  if (intensity <= 3) return 'Leve';
  if (intensity <= 6) return 'Moderado';
  if (intensity <= 8) return 'Severo';
  return 'Crítico';
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
          useNativeDriver: true,
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
  const severityLabel = getPainSeverityLabel(intensity);

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
          backgroundColor: 'rgba(15,23,42,0.45)',
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
            className="overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl">
            {/* Tira superior de color gradual */}
            <View style={{ height: 4, width: '100%', backgroundColor: painColor }} />

            {/* Píldora sutil de arrastre / decoración */}
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" />

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
                    <Text className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      PROBLEMA REGISTRADO
                    </Text>
                    <Text className="mt-0.5 font-mono text-base font-extrabold text-slate-900">
                      {muscle.name}
                    </Text>
                    <View className="mt-0.5 flex-row items-center">
                      <Text className="font-mono text-[10px] text-slate-500">{muscle.category}</Text>
                      {!!observation.updatedAt && (
                        <View className="ml-2 flex-row items-center">
                          <Clock size={10} color="#94a3b8" />
                          <Text className="ml-1 font-mono text-[9.5px] text-slate-400">
                            {observation.updatedAt}
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
                      <Text className="ml-1 font-mono text-xs font-extrabold text-slate-900">
                        {intensity}
                      </Text>
                      <Text className="font-mono text-[9px] text-slate-500">/10</Text>
                    </View>
                    <Text className="font-mono text-[8.5px] font-bold text-slate-600">
                      {severityLabel}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleClose}
                    className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                    <X size={15} color="#475569" strokeWidth={2.2} />
                  </Pressable>
                </View>
              </View>

              {/* Barra de progreso de intensidad */}
              <View className="mt-3.5">
                <View className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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
                    ? 'border-sky-200 bg-sky-50/70'
                    : 'border-slate-100 bg-slate-50'
                    }`}>
                  <Layers
                    size={14}
                    color={observation.swelling ? '#0284c7' : '#64748b'}
                    strokeWidth={2}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400">Hinchazón</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800">
                      {observation.swelling ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </View>

                <View
                  className={`flex-1 flex-row items-center rounded-xl border p-2.5 ${observation.functionalLimitation
                    ? 'border-sky-200 bg-sky-50/70'
                    : 'border-slate-100 bg-slate-50'
                    }`}>
                  <MotionStatusIcon
                    size={14}
                    color={observation.functionalLimitation ? '#0284c7' : '#64748b'}
                  />
                  <View className="ml-2">
                    <Text className="font-mono text-[9px] text-slate-400">Limitación funcional</Text>
                    <Text className="font-mono text-xs font-bold text-slate-800">
                      {observation.functionalLimitation ? 'Sí' : 'No'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cuadro de Detalles Escritos */}
              <View className="mt-3.5 rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5">
                <View className="mb-1.5 flex-row items-center">
                  <FileText size={13} color="#475569" strokeWidth={2} />
                  <Text className="ml-1.5 font-mono text-[10px] font-bold text-slate-700">
                    Detalles escritos
                  </Text>
                </View>
                <Text className="font-mono text-xs leading-5 text-slate-600">
                  {observation.notes || 'Sin observaciones adicionales escritas.'}
                </Text>
              </View>

              {/* Botón de seguimiento fotográfico / Timelapse */}
              <Pressable
                onPress={onOpenTimelapse}
                className="mt-3.5 flex-row items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2.5 active:opacity-75">
                <Camera size={14} color="#0284c7" strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800">
                  Seguimiento fotográfico / Timelapse ({photoCount})
                </Text>
              </Pressable>

              {/* Botones de Acción: Editar / Borrar */}
              {!confirmingDelete ? (
                <View className="mt-4 flex-row items-center justify-between gap-2.5">
                  <Pressable
                    onPress={onEdit}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 shadow-xs active:opacity-75">
                    <Pencil size={13} color="#0f172a" strokeWidth={2.2} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink">
                      Editar registro
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setConfirmingDeleteId(muscle.id)}
                    className="flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 active:opacity-75">
                    <Trash2 size={13} color="#dc2626" strokeWidth={2.1} />
                    <Text className="ml-1.5 font-mono text-xs font-bold text-red-600">
                      Borrar
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-red-200 bg-red-50/90 p-3">
                  <Text className="flex-1 font-mono text-[10.5px] font-bold text-red-800">
                    ¿Borrar este malestar por error?
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => setConfirmingDeleteId(null)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 active:opacity-75">
                      <Text className="font-mono text-[10.5px] font-bold text-slate-600">
                        Cancelar
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleConfirmDelete}
                      className="rounded-lg bg-red-600 px-3 py-1.5 active:opacity-80">
                      <Text className="font-mono text-[10.5px] font-bold text-white">
                        Sí, borrar
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
  const [tab, setTab] = useState<'body' | 'health' | 'records'>('body');
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

            const normalizedDate = new Date(record.recordedAt.replace(' ', 'T'));
            const updatedAt = Number.isNaN(normalizedDate.getTime())
              ? record.recordedAt
              : normalizedDate.toLocaleString();

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
        Alert.alert(
          'No se pudieron cargar los registros',
          'Revisa la conexión con el backend e inténtalo de nuevo.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
        Alert.alert(
          'No se guardó en el backend',
          'El padecimiento se actualizó en esta sesión, pero no pudo sincronizarse. Revisa la conexión antes de cerrar la app.'
        );
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
    : '#0284c7';

  return (
    <View className="px-5 pb-10 pt-5">
      {/* Pestañas superiores: Vista Corporal / Cuestionario / Registros */}
      <View className="mb-5 flex-row gap-2">
        {(
          [
            { id: 'body', label: 'Vista 3D' },
            { id: 'health', label: 'Cuestionario' },
            { id: 'records', label: `Registros (${registeredMuscles.length})` },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            className={`flex-1 items-center rounded-md border px-2 py-1.5 active:opacity-70 ${tab === t.id
                ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                : 'border-trauma-ink bg-white'
              }`}>
            <Text className="font-mono text-[11px] font-bold text-trauma-ink" numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'health' ? (
        <HealthQuestionnaireSection />
      ) : tab === 'records' ? (
        <View className="mt-1">
          <Text className="mb-4 text-center font-mono text-base font-bold text-trauma-ink">
            Registros Previos
          </Text>

          {/* Escala minimalista en la pestaña de registros */}
          <View className="mb-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="font-mono text-[10px] font-bold text-slate-700">
                Escala de dolor 3D
              </Text>
              <Text className="font-mono text-[9px] text-slate-400">Gradual 1 - 10</Text>
            </View>
            <MinimalPainScaleBar showLabels />
          </View>

          {registeredMuscles.length === 0 ? (
            <View className="items-center rounded-2xl border border-trauma-line bg-white p-6">
              <Text className="font-mono text-xs text-trauma-muted">
                No hay malestares registrados aún.
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
                  className="mb-3 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs active:opacity-80">
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
                        <Text className="font-mono text-xs font-bold text-trauma-ink">
                          {m.name}
                        </Text>
                        <Text className="font-mono text-[9.5px] text-slate-400">
                          {m.category}
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
                        <Text className="ml-1 font-mono text-[10px] font-bold text-slate-800">
                          {intensity}/10
                        </Text>
                      </View>
                      <ArrowRight size={14} color="#94a3b8" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      ) : (
        <>
          <Text className="mb-3 text-center font-mono text-base font-bold text-trauma-ink">
            Seleccione grupo Muscular
          </Text>

          {/* Cuadro del Visor 3D Interactivo dividido en 34 zonas anatómicas */}
          <View
            className="overflow-hidden rounded-3xl border border-trauma-line bg-trauma-bg shadow-md"
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
            <Text className="flex-1 font-mono text-[9px] text-trauma-ink">
              1 dedo: rotar · 2 dedos: mover/zoom · Toca un músculo
            </Text>
          </View>

          {/* Barra de escala de dolor */}
          <View className="mt-3 px-1">
            <MinimalPainScaleBar showLabels />
          </View>

          {/* Tarjeta simplificada de problema registrado */}
          {hasSavedProblem ? (
            <View className="mt-4 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-xs">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    style={{ backgroundColor: selectedPainColor }}
                    className="mr-2 h-2.5 w-2.5 rounded-full"
                  />
                  <Text className="flex-1 font-mono text-xs font-bold text-slate-800" numberOfLines={1}>
                    {selectedMuscle.name}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: `${selectedPainColor}18`,
                    borderColor: selectedPainColor,
                    borderWidth: 1,
                  }}
                  className="rounded-lg px-2 py-0.5">
                  <Text className="font-mono text-[11px] font-extrabold text-slate-800">
                    {selectedMuscle.observation?.painIntensity}/10
                  </Text>
                </View>
              </View>

              <View className="mt-2.5 flex-row gap-2">
                <Pressable
                  onPress={() => openDetailFor(selectedMuscle)}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-2 active:opacity-75">
                  <FileText size={13} color="#0f172a" strokeWidth={2.2} />
                  <Text className="ml-1.5 font-mono text-[11px] font-bold text-trauma-ink">
                    Detalles
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openTimelapseFor(selectedMuscle)}
                  className="flex-row items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 active:opacity-75">
                  <Camera size={13} color="#0284c7" strokeWidth={2.2} />
                  <Text className="ml-1.5 font-mono text-[11px] font-bold text-slate-800">
                    Fotos ({(injuryPhotos[selectedMuscle.id] ?? []).length})
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // Botón para registrar observación si no hay malestar
            <View className="mt-4 items-center rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <View className="mb-2.5 flex-row items-center">
                <RegionCategoryIcon
                  category={selectedMuscle.category}
                  color="#0284c7"
                  size={15}
                />
                <Text className="ml-2 font-mono text-xs font-bold text-slate-800">
                  {selectedMuscle.name}
                </Text>
                <View className="ml-2 rounded-full bg-slate-100 px-2 py-0.5">
                  <Text className="font-mono text-[9px] text-slate-500">Sin registro</Text>
                </View>
              </View>

              <Pressable
                onPress={() => setObservationModalOpen(true)}
                className="w-full flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft px-5 py-2.5 shadow-xs active:opacity-75">
                <PlusCircle size={14} color="#0f172a" strokeWidth={2.2} />
                <Text className="ml-1.5 font-mono text-xs font-bold text-trauma-ink">
                  Registrar Observación
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
        onClose={() => setObservationModalOpen(false)}
        onSave={handleSaveObservation}
      />
    </View>
  );
}
