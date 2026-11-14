import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { MuscleData } from './BodyModelViewer';
import { useMission } from './mission-context';

export function resolveInjuryPhotoSource(uri: string) {
  return { uri };
}

// Visor timelapse y captura diaria de fotos para seguimiento de lesiones
export function InjuryTimelapseModal({
  visible,
  muscle,
  onClose,
}: {
  visible: boolean;
  muscle: MuscleData | null;
  onClose: () => void;
}) {
  const { injuryPhotos, addInjuryPhoto, refreshInjuryPhotos } = useMission();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const photos = muscle ? injuryPhotos[muscle.id] ?? [] : [];
  const activeIndex =
    selectedIndex !== null && selectedIndex < photos.length
      ? selectedIndex
      : Math.max(0, photos.length - 1);

  useEffect(() => {
    if (!visible || !muscle) return;
    let isMounted = true;
    void Promise.resolve().then(async () => {
      if (!isMounted) return;
      setIsLoadingPhotos(true);
      setPhotoLoadError(null);
      try {
        await refreshInjuryPhotos(muscle.id, muscle.name);
      } catch (error: unknown) {
        console.error('[InjuryTimelapseModal] Error al cargar fotos de lesión:', error);
        if (isMounted) {
          setPhotoLoadError(
            error instanceof Error ? error.message : 'No se pudieron cargar las imágenes.'
          );
        }
      } finally {
        if (isMounted) setIsLoadingPhotos(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [visible, muscle, refreshInjuryPhotos]);

  useEffect(() => {
    if (!isPlaying || photos.length < 2) return;
    const timer = setInterval(() => {
      setSelectedIndex((prev) => (((prev ?? 0) + 1) % photos.length));
    }, 900);
    return () => clearInterval(timer);
  }, [isPlaying, photos.length]);

  if (!visible || !muscle) return null;

  const handleClose = () => {
    setIsPlaying(false);
    setSelectedIndex(null);
    onClose();
  };

  const currentPhoto = photos[activeIndex] ?? photos[photos.length - 1];

  const handleSaveImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (isUploading) return;
    setIsUploading(true);
    try {
      await addInjuryPhoto(muscle.id, muscle.name, {
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
        painIntensity: muscle.observation?.painIntensity,
        note: note.trim() || 'Registro fotográfico diario',
      });
      setNote('');
      setIsPlaying(false);
      setSelectedIndex(photos.length);
    } catch (error: unknown) {
      console.error('[InjuryTimelapseModal] Error al subir la imagen:', error);
      Alert.alert(
        'No se pudo subir la imagen',
        error instanceof Error ? error.message : 'Ocurrió un error al subir la imagen.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para tomar la foto.');
          return;
        }
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        await handleSaveImage(res.assets[0]);
      }
    } catch {
      // Fallback en navegadores/simuladores sin cámara disponible
      await handlePickFromGallery();
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        await handleSaveImage(res.assets[0]);
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería de imágenes.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.45)',
          justifyContent: 'flex-end',
        }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: '88%' }}>
          <View className="overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl">
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" />

            {/* Cabecera */}
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-3">
              <View className="flex-1 pr-2">
                <Text className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  Timelapse de recuperación
                </Text>
                <Text className="font-mono text-base font-extrabold text-trauma-ink" numberOfLines={1}>
                  {muscle.name}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <X size={16} color="#475569" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
              {/* Visor principal del timelapse */}
              {currentPhoto ? (
                <View className="overflow-hidden rounded-2xl border border-trauma-line bg-[#f8fafc]">
                  <View className="h-56 w-full items-center justify-center bg-slate-100">
                    <Image
                      source={resolveInjuryPhotoSource(currentPhoto.uri)}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <View className="absolute left-3 top-3 rounded-lg bg-slate-900/75 px-2.5 py-1">
                      <Text className="font-mono text-[10px] font-bold text-white">
                        Día {currentPhoto.dayNumber} de {photos.length}
                      </Text>
                    </View>
                    {currentPhoto.painIntensity !== undefined && (
                      <View className="absolute right-3 top-3 rounded-lg bg-white/90 px-2 py-1">
                        <Text className="font-mono text-[10px] font-bold text-slate-800">
                          Dolor {currentPhoto.painIntensity}/10
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="p-3.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-mono text-[10px] font-bold text-slate-700">
                        {currentPhoto.capturedAt}
                      </Text>
                      {photos.length >= 2 && (
                        <View className="flex-row items-center gap-2">
                          <Pressable
                            onPress={() => {
                              setIsPlaying(false);
                              setSelectedIndex(0);
                            }}
                            className="h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white">
                            <RotateCcw size={12} color="#475569" />
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              if (!isPlaying && selectedIndex === null) {
                                setSelectedIndex(0);
                              }
                              setIsPlaying((p) => !p);
                            }}
                            className="flex-row items-center rounded-lg border border-trauma-cyanEdge bg-trauma-cyanSoft px-2.5 py-1">
                            {isPlaying ? (
                              <Pause size={12} color="#0f172a" />
                            ) : (
                              <Play size={12} color="#0f172a" />
                            )}
                            <Text className="ml-1 font-mono text-[10px] font-bold text-trauma-ink">
                              {isPlaying ? 'Pausar' : 'Timelapse'}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                    {!!currentPhoto.note && (
                      <Text className="mt-1.5 font-mono text-[11px] text-slate-500">
                        {currentPhoto.note}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View className="items-center rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] p-6">
                  {isLoadingPhotos ? (
                    <ActivityIndicator color="#0284c7" />
                  ) : (
                    <Camera size={26} color="#94a3b8" />
                  )}
                  <Text className="mt-2 font-mono text-xs font-bold text-slate-600">
                    {isLoadingPhotos
                      ? 'Cargando imágenes...'
                      : photoLoadError
                        ? 'No se pudieron cargar las imágenes'
                        : 'Sin fotos registradas aún'}
                  </Text>
                  <Text className="mt-0.5 text-center font-mono text-[10px] text-slate-400">
                    {photoLoadError ??
                      'Toma una foto diaria de esta zona para armar tu timelapse de recuperación.'}
                  </Text>
                </View>
              )}

              {/* Tira cronológica de miniaturas */}
              {photos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-3"
                  contentContainerStyle={{ gap: 8 }}>
                  {photos.map((p, idx) => {
                    const selected = idx === activeIndex;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setIsPlaying(false);
                          setSelectedIndex(idx);
                        }}
                        className={`overflow-hidden rounded-xl border-2 ${
                          selected ? 'border-trauma-cyanDeep' : 'border-slate-200'
                        }`}>
                        <Image
                          source={resolveInjuryPhotoSource(p.uri)}
                          style={{ width: 58, height: 58 }}
                          resizeMode="cover"
                        />
                        <View className="bg-white py-0.5">
                          <Text className="text-center font-mono text-[9px] font-bold text-slate-700">
                            Día {p.dayNumber}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Añadir foto del día */}
              <View className="mt-4 pb-8">
                <Text className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Agregar foto de hoy
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota breve (ej. menos inflamación hoy)..."
                  placeholderTextColor="#94a3b8"
                  className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                />

                <View className="flex-row gap-2.5">
                  <Pressable
                    onPress={handleTakePhoto}
                    disabled={isLoadingPhotos || isUploading}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 active:opacity-75">
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#0f172a" />
                    ) : (
                      <Camera size={16} color="#0f172a" />
                    )}
                    <Text className="ml-2 font-mono text-xs font-bold text-trauma-ink">
                      {isUploading ? 'Subiendo...' : 'Tomar foto'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickFromGallery}
                    disabled={isLoadingPhotos || isUploading}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-line bg-white py-3 active:opacity-75">
                    <Images size={16} color="#334155" />
                    <Text className="ml-2 font-mono text-xs font-bold text-slate-700">
                      Galería
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
