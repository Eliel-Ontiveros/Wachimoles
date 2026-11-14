import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Polygon, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  ArrowLeft,
  Camera,
  Images,
  Zap,
  Layers,
  FileText,
  Check,
  RotateCcw,
  Clock,
  PlusCircle,
  X,
} from 'lucide-react-native';
import {
  BodyRegionCategory,
  MuscleData,
  MuscleObservation,
  getPainColorHex,
} from './BodyModelViewer';
import { useMission } from './mission-context';
import type { InjuryPhoto } from '../../types/mission';
import {
  appendConditionUpdate,
  parseConditionUpdates,
  serializeConditionUpdates,
} from '../../utils/condition-updates';

// Modal para registrar o agregar actualizaciones a la observación clínica de una zona
interface RegisterObservationModalProps {
  visible: boolean;
  muscle: MuscleData;
  snapshotUri?: string;
  mode?: 'create' | 'update';
  existingPhotos?: InjuryPhoto[];
  onClose: () => void;
  onSave: (
    muscleId: string,
    observation: MuscleObservation | null,
    options?: { isCured?: boolean; latestUpdateNote?: string }
  ) => void;
}

// Icono vectorial por categoría anatómica
export function RegionCategoryIcon({
  category,
  color = '#38bdf8',
  size = 15,
}: {
  category: BodyRegionCategory;
  color?: string;
  size?: number;
}) {
  if (category === 'Cabeza y cuello') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={5} stroke={color} strokeWidth={2} />
        <Path
          d="M9 13v4l-2 3h10l-2-3v-4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (category === 'Extremidad inferior') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 3v11l-2 5h8l1-2.5-3.5-1.5V3H9z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (category === 'Extremidad superior') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 15l4-9 4 3 4-4v8c0 3-2.5 5-6 5H6v-3z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (category === 'Cadera y pelvis') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 6c2 0 4 1.5 7 1.5S17 6 19 6c1 4-1 9-4 11l-3-3-3 3C6 15 4 10 5 6z"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // Tronco anterior o posterior
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 4h8l2 5-2 11H8L6 9l2-5zM12 4v16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Barra de gradiente para la escala de dolor (1 amarillo -> 5 naranja -> 10 rojo)
export function MinimalPainScaleBar({
  showLabels = true,
}: {
  showLabels?: boolean;
  selectedIntensity?: number;
  onSelectLevel?: (level: number) => void;
  compact?: boolean;
}) {
  return (
    <View className="w-full">
      {/* Tira continua de gradiente */}
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="painGradientMinimal" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#fde047" />
              <Stop offset="45%" stopColor="#f97316" />
              <Stop offset="75%" stopColor="#ef4444" />
              <Stop offset="100%" stopColor="#991b1b" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#painGradientMinimal)" rx="3" />
        </Svg>
      </View>

      {showLabels && (
        <View className="mt-1 flex-row items-center justify-between px-0.5">
          <View className="flex-row items-center">
            <View className="h-1.5 w-1.5 rounded-full bg-[#fde047] mr-1" />
            <Text className="font-mono text-[9px] text-slate-400">1 Leve</Text>
          </View>
          <View className="flex-row items-center">
            <View className="h-1.5 w-1.5 rounded-full bg-[#f97316] mr-1" />
            <Text className="font-mono text-[9px] text-slate-400">5 Moderado</Text>
          </View>
          <View className="flex-row items-center">
            <View className="h-1.5 w-1.5 rounded-full bg-[#991b1b] mr-1" />
            <Text className="font-mono text-[9px] text-slate-400">10 Intenso</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Icono de limitación funcional
function FunctionalMotionIcon({ size = 18, color = '#334155' }: { size?: number; color?: string }) {
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

export function RegisterObservationModal({
  visible,
  muscle,
  snapshotUri,
  mode,
  existingPhotos,
  onClose,
  onSave,
}: RegisterObservationModalProps) {
  const { addInjuryPhoto, injuryPhotos } = useMission();
  const [painIntensity, setPainIntensity] = useState<number>(7);
  const [swelling, setSwelling] = useState<boolean>(true);
  const [functionalLimitation, setFunctionalLimitation] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [sliderWidth, setSliderWidth] = useState<number>(0);
  const [capturedPhoto, setCapturedPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isUpdateMode = (mode ?? (muscle.observation ? 'update' : 'create')) === 'update' && Boolean(muscle.observation);
  const musclePhotos = useMemo(
    () => existingPhotos ?? injuryPhotos[muscle.id] ?? [],
    [existingPhotos, injuryPhotos, muscle.id]
  );

  const existingUpdates = useMemo(() => {
    if (!muscle.observation) return [];
    return parseConditionUpdates({
      description: muscle.observation.notes,
      fallbackPain: muscle.observation.painIntensity,
      fallbackDateLabel: muscle.observation.updatedAt,
      photos: musclePhotos,
    });
  }, [muscle.observation, musclePhotos]);

  const nextUpdateNumber = isUpdateMode
    ? existingUpdates.length > 0
      ? Math.max(...existingUpdates.map((u) => u.updateNumber)) + 1
      : 2
    : 1;

  // Sincroniza los datos de la zona seleccionada
  useEffect(() => {
    if (!visible || !muscle) return;
    let isMounted = true;
    void Promise.resolve().then(() => {
      if (!isMounted) return;
      setCapturedPhoto(null);
      if (muscle.observation) {
        setPainIntensity(muscle.observation.painIntensity);
        setSwelling(muscle.observation.swelling);
        setFunctionalLimitation(muscle.observation.functionalLimitation);
        setNotes('');
      } else {
        setPainIntensity(7);
        setSwelling(true);
        setFunctionalLimitation(false);
        setNotes('');
      }
    });
    return () => {
      isMounted = false;
    };
  }, [visible, muscle]);

  const updatePainFromTouch = (locationX: number) => {
    if (sliderWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / sliderWidth));
    setPainIntensity(Math.round(ratio * 10));
  };

  const handleCapturePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Activa la cámara para adjuntar foto.');
          return;
        }
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setCapturedPhoto(res.assets[0]);
      }
    } catch {
      await handlePickPhoto();
    }
  };

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setCapturedPhoto(res.assets[0]);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const persistUpdate = async (forceCure: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    const effectivePain = forceCure ? 0 : painIntensity;
    const isCured = forceCure || effectivePain === 0;
    const trimmedInput = notes.trim();
    const updateText =
      trimmedInput ||
      (isCured
        ? 'Ya no siento el síntoma, molestia superada.'
        : isUpdateMode
          ? `Seguimiento #${nextUpdateNumber} registrado.`
          : `Registro inicial en ${muscle.name}.`);

    try {
      let uploadedPath: string | undefined;
      if (capturedPhoto) {
        const uploaded = await addInjuryPhoto(muscle.id, muscle.name, {
          uri: capturedPhoto.uri,
          fileName: capturedPhoto.fileName ?? undefined,
          mimeType: capturedPhoto.mimeType ?? undefined,
          painIntensity: effectivePain,
          note: `Actualización ${nextUpdateNumber} - ${updateText}`,
        });
        uploadedPath = uploaded.id;
      }

      const baseDescription =
        muscle.observation?.notes?.trim() ||
        (existingUpdates.length > 0 ? serializeConditionUpdates(existingUpdates) : null);

      const { serializedDescription } = appendConditionUpdate({
        existingDescription: isUpdateMode ? baseDescription : null,
        newText: updateText,
        painIntensity: effectivePain,
        photoPathOrFileName: uploadedPath,
        isResolvedEvent: isCured,
        fallbackPain: muscle.observation?.painIntensity,
        fallbackDateLabel: muscle.observation?.updatedAt,
      });

      onSave(
        muscle.id,
        {
          painIntensity: effectivePain,
          swelling: isCured ? false : swelling,
          functionalLimitation: isCured ? false : functionalLimitation,
          notes: serializedDescription,
          updatedAt: 'Ahora mismo',
        },
        {
          isCured,
          latestUpdateNote: updateText,
        }
      );
      onClose();
    } catch (error: unknown) {
      console.error('[RegisterObservationModal] Error al guardar:', error);
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Ocurrió un error al guardar la actualización.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    void persistUpdate(false);
  };

  const handleMarkCured = () => {
    void persistUpdate(true);
  };

  const handleClear = () => {
    if (isSaving) return;
    onSave(muscle.id, null);
    onClose();
  };

  const percent = (painIntensity / 10) * 100;
  // Color gradual actual para el slider (Amarillo en 1 -> Naranja en 5 -> Rojo en 10)
  const currentPainColor = painIntensity > 0 ? getPainColorHex(painIntensity) : '#10b981';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f8fb' }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Hexágonos decorativos sutiles en la esquina superior derecha */}
          <View style={{ position: 'absolute', top: 0, right: 0, opacity: 0.45 }} pointerEvents="none">
            <Svg width={150} height={130} viewBox="0 0 150 130">
              <Polygon
                points="95,10 120,24 120,52 95,66 70,52 70,24"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.2}
              />
              <Polygon
                points="125,55 150,69 150,97 125,111 100,97 100,69"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.2}
              />
              <Polygon
                points="70,62 95,76 95,104 70,118 45,104 45,76"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={1.2}
              />
            </Svg>
          </View>

          {/* Barra superior de navegación */}
          <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
            <View className="flex-row items-center">
              <Pressable
                onPress={onClose}
                accessibilityLabel="Volver"
                className="mr-3 h-9 w-9 items-center justify-center rounded-full active:bg-slate-200">
                <ArrowLeft size={20} color="#1e293b" strokeWidth={2.2} />
              </Pressable>
              <View>
                <Text className="text-lg font-bold text-slate-800">
                  {isUpdateMode
                    ? `Actualización #${nextUpdateNumber}`
                    : 'Registrar observación'}
                </Text>
                <Text className="font-mono text-[10px] text-slate-500">
                  {isUpdateMode
                    ? 'Seguimiento de evolución clínica (texto y foto)'
                    : 'Se guardará como Actualización 1 en la base de datos'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}>
            {/* Tarjeta 1: Región Seleccionada (captura en vivo del modelo 3D) */}
            <View className="mt-2 flex-row items-center rounded-3xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <View
                style={{
                  backgroundColor: '#060b19',
                  borderColor: currentPainColor,
                  borderWidth: 1.5,
                }}
                className="h-24 w-24 items-center justify-center overflow-hidden rounded-2xl">
                {snapshotUri ? (
                  <Image
                    source={{ uri: snapshotUri }}
                    style={{ width: 96, height: 96 }}
                    resizeMode="cover"
                  />
                ) : (
                  <RegionCategoryIcon
                    category={muscle.category}
                    color={currentPainColor}
                    size={36}
                  />
                )}
              </View>

              <View className="ml-4 flex-1">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  REGIÓN SELECCIONADA
                </Text>
                <Text className="mt-0.5 text-xl font-extrabold text-slate-800">{muscle.name}</Text>

                <View className="mt-2 flex-row items-center self-start rounded-full bg-slate-100 px-3 py-1">
                  <RegionCategoryIcon category={muscle.category} color="#0284c7" size={14} />
                  <Text className="ml-1.5 text-xs font-medium text-slate-600">
                    {muscle.category}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bitácora de actualizaciones previas cuando se agrega una nueva actualización */}
            {isUpdateMode && existingUpdates.length > 0 && (
              <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <View className="mb-2.5 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Clock size={15} color="#0284c7" strokeWidth={2.2} />
                    <Text className="ml-1.5 text-xs font-bold text-slate-800">
                      Historial previo ({existingUpdates.length})
                    </Text>
                  </View>
                  <Text className="font-mono text-[10px] font-bold text-sky-700">
                    Siguiente: Actualización {nextUpdateNumber}
                  </Text>
                </View>

                <View className="gap-2">
                  {existingUpdates.map((item) => (
                    <View
                      key={item.updateNumber}
                      className="flex-row items-start rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <View className="flex-1 pr-2">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <View className="rounded-md bg-sky-100 px-1.5 py-0.5">
                            <Text className="font-mono text-[9.5px] font-bold text-sky-900">
                              {item.title}
                            </Text>
                          </View>
                          {!!item.dateLabel && (
                            <Text className="font-mono text-[9.5px] text-slate-400">
                              {item.dateLabel}
                            </Text>
                          )}
                          {item.painIntensity !== undefined && (
                            <Text className="font-mono text-[9.5px] font-bold text-slate-600">
                              · Dolor {item.painIntensity}/10
                            </Text>
                          )}
                        </View>
                        <Text className="mt-1 text-[11.5px] leading-4 text-slate-600">
                          {item.text}
                        </Text>
                      </View>
                      {item.photoUri && (
                        <Image
                          source={{ uri: item.photoUri }}
                          style={{ width: 46, height: 46, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Tarjeta 2: Intensidad del dolor (Fiel al diseño original con slider minimalista) */}
            <View className="mt-3.5 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Zap size={18} color="#334155" strokeWidth={2} />
                  <Text className="ml-2 text-sm font-bold text-slate-800">
                    Intensidad del dolor
                  </Text>
                </View>
                {/* Indicador numérico pill: "7 / 10" */}
                <View
                  className={`flex-row items-baseline rounded-xl border px-3 py-1 ${
                    painIntensity === 0
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}>
                  <Text
                    className={`text-sm font-extrabold ${
                      painIntensity === 0 ? 'text-emerald-700' : 'text-slate-800'
                    }`}>
                    {painIntensity}
                  </Text>
                  <Text className="text-xs text-slate-400"> / 10</Text>
                </View>
              </View>

              {/* Slider interactivo minimalista */}
              <View
                className="my-3.5 h-6 justify-center"
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => updatePainFromTouch(e.nativeEvent.locationX)}
                onResponderMove={(e) => updatePainFromTouch(e.nativeEvent.locationX)}>
                {/* Pista de fondo */}
                <View className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                  <View
                    style={{
                      width: `${percent}%`,
                      height: '100%',
                      backgroundColor: currentPainColor,
                      borderRadius: 999,
                    }}
                  />
                </View>
                {/* Thumb circular */}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: `${percent}%`,
                    marginLeft: -11,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#ffffff',
                    borderWidth: 2.5,
                    borderColor: currentPainColor,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1.5 },
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    elevation: 2,
                  }}
                />
              </View>

              {/* Números 0..10 limpios y minimalistas */}
              <View className="flex-row justify-between px-0.5">
                {Array.from({ length: 11 }, (_, i) => {
                  const active = i === painIntensity;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setPainIntensity(i)}
                      hitSlop={6}
                      className="items-center px-1">
                      <Text
                        className={`text-xs ${
                          active
                            ? i === 0
                              ? 'font-extrabold text-emerald-700'
                              : 'font-extrabold text-slate-900'
                            : 'font-medium text-slate-400'
                        }`}>
                        {i}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {painIntensity === 0 && (
                <View className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5">
                  <Text className="text-xs font-bold text-emerald-800">
                    Mejoría total (0/10): se guardará esta actualización como curada y pasará al historial de malestares.
                  </Text>
                </View>
              )}

              {/* Tira minimalista discreta de la escala de color (1 Leve -> 5 Moderado -> 10 Intenso) */}
              <View className="mt-3 pt-1">
                <MinimalPainScaleBar showLabels />
              </View>
            </View>

            {/* Tarjeta 3: ¿Hinchazón o inflamación? */}
            <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <View className="flex-1 flex-row items-center pr-2">
                <Layers size={18} color="#334155" strokeWidth={2} />
                <Text className="ml-2.5 text-xs font-bold text-slate-800">
                  ¿Hinchazón o inflamación?
                </Text>
              </View>
              <View className="flex-row rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <Pressable
                  onPress={() => setSwelling(true)}
                  className={`rounded-lg px-5 py-1.5 ${
                    swelling ? 'border border-[#7dd3fc] bg-[#c5eefc]' : ''
                  }`}>
                  <Text
                    className={`text-xs ${
                      swelling ? 'font-bold text-slate-800' : 'font-medium text-slate-500'
                    }`}>
                    Sí
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSwelling(false)}
                  className={`rounded-lg px-5 py-1.5 ${
                    !swelling ? 'border border-[#7dd3fc] bg-[#c5eefc]' : ''
                  }`}>
                  <Text
                    className={`text-xs ${
                      !swelling ? 'font-bold text-slate-800' : 'font-medium text-slate-500'
                    }`}>
                    No
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Tarjeta 4: ¿Limitación funcional? */}
            <View className="mt-2.5 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <View className="flex-1 flex-row items-center pr-2">
                <FunctionalMotionIcon size={18} color="#334155" />
                <Text className="ml-2.5 text-xs font-bold text-slate-800">
                  ¿Limitación funcional?
                </Text>
              </View>
              <View className="flex-row rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                <Pressable
                  onPress={() => setFunctionalLimitation(true)}
                  className={`rounded-lg px-5 py-1.5 ${
                    functionalLimitation ? 'border border-[#7dd3fc] bg-[#c5eefc]' : ''
                  }`}>
                  <Text
                    className={`text-xs ${
                      functionalLimitation ? 'font-bold text-slate-800' : 'font-medium text-slate-500'
                    }`}>
                    Sí
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFunctionalLimitation(false)}
                  className={`rounded-lg px-5 py-1.5 ${
                    !functionalLimitation ? 'border border-[#7dd3fc] bg-[#c5eefc]' : ''
                  }`}>
                  <Text
                    className={`text-xs ${
                      !functionalLimitation ? 'font-bold text-slate-800' : 'font-medium text-slate-500'
                    }`}>
                    No
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Tarjeta 5: Texto de la actualización */}
            <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="mb-2.5 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <FileText size={18} color="#334155" strokeWidth={2} />
                  <Text className="ml-2 text-sm font-bold text-slate-800">
                    {isUpdateMode
                      ? `Texto · Actualización ${nextUpdateNumber}`
                      : 'Texto · Actualización 1'}
                  </Text>
                </View>
                <Text className="font-mono text-[10px] text-slate-400">
                  Se guarda en BD
                </Text>
              </View>

              <View className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={400}
                  placeholder={
                    isUpdateMode
                      ? `Describe la evolución o cambios para la Actualización ${nextUpdateNumber}...`
                      : `Ej. Dolor localizado en ${muscle.name.toLowerCase()} tras esfuerzo...`
                  }
                  placeholderTextColor="#94a3b8"
                  className="min-h-[76px] text-xs leading-5 text-slate-700"
                  textAlignVertical="top"
                />
              </View>
              <Text className="mt-1.5 text-right text-[11px] text-slate-400">
                {notes.length} / 400
              </Text>
            </View>

            {/* Tarjeta 6: Foto de esta actualización */}
            <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="mb-2.5 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Camera size={18} color="#334155" strokeWidth={2} />
                  <Text className="ml-2 text-sm font-bold text-slate-800">
                    {`Foto · Actualización ${nextUpdateNumber}`}
                  </Text>
                </View>
                <Text className="text-[10px] text-slate-400">Opcional</Text>
              </View>

              {capturedPhoto && (
                <View className="relative mb-3 overflow-hidden rounded-2xl border border-slate-200">
                  <Image
                    source={{ uri: capturedPhoto.uri }}
                    style={{ width: '100%', height: 150 }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => setCapturedPhoto(null)}
                    className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-slate-900/75">
                    <X size={14} color="#ffffff" />
                  </Pressable>
                </View>
              )}

              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={handleCapturePhoto}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-[#7dd3fc] bg-[#e0f7fe] py-2.5 active:opacity-75">
                  <Camera size={15} color="#0284c7" />
                  <Text className="ml-1.5 text-xs font-bold text-slate-800">Tomar foto</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickPhoto}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2.5 active:opacity-75">
                  <Images size={15} color="#475569" />
                  <Text className="ml-1.5 text-xs font-bold text-slate-700">Galería</Text>
                </Pressable>
              </View>
            </View>

            {/* Botón Principal Guardar */}
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              className={`mt-5 flex-row items-center justify-center rounded-2xl py-4 shadow-md active:opacity-80 ${
                painIntensity === 0 ? 'bg-emerald-600' : 'bg-[#58c7f3]'
              }`}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : isUpdateMode ? (
                <PlusCircle size={18} color="#ffffff" strokeWidth={2.3} />
              ) : (
                <Check size={18} color="#ffffff" strokeWidth={2.5} />
              )}
              <Text className="ml-2 text-sm font-bold text-white">
                {isSaving
                  ? 'Guardando...'
                  : painIntensity === 0
                    ? 'Guardar mejoría y mover al historial'
                    : isUpdateMode
                      ? `Guardar Actualización ${nextUpdateNumber}`
                      : 'Guardar Actualización 1'}
              </Text>
            </Pressable>

            {/* Botón dedicado para curar el malestar ("Ya no siento el síntoma") */}
            {isUpdateMode && painIntensity > 0 && (
              <Pressable
                onPress={handleMarkCured}
                disabled={isSaving}
                className="mt-3 flex-row items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 py-3.5 active:opacity-80">
                <Check size={16} color="#047857" strokeWidth={2.4} />
                <Text className="ml-2 text-xs font-bold text-emerald-800">
                  Ya no siento el síntoma (Curar y guardar historial)
                </Text>
              </Pressable>
            )}

            {/* Botón secundario para limpiar la zona si se registró por error */}
            {muscle.status !== 'normal' && (
              <Pressable
                onPress={handleClear}
                disabled={isSaving}
                className="mt-3 flex-row items-center justify-center py-2 active:opacity-70">
                <RotateCcw size={13} color="#64748b" />
                <Text className="ml-1.5 text-xs font-medium text-slate-500">
                  Quitar alerta de esta zona
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
