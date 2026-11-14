import { useEffect, useRef, useState } from 'react';
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
import { MuscleData, muscleNameKey } from './BodyModelViewer';
import { useMission } from './mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';

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
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const iconInk = isDark ? colors.text : '#0f172a';
  const iconSlate = isDark ? colors.textMuted : '#475569';
  const iconSlate2 = isDark ? colors.textMuted : '#334155';
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
            error instanceof Error ? error.message : tRef.current('body.timelapse.loadFailMsg')
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
        note: note.trim() || 'Registro fotográfico diario', // dato almacenado: no se traduce
      });
      setNote('');
      setIsPlaying(false);
      setSelectedIndex(photos.length);
    } catch (error: unknown) {
      console.error('[InjuryTimelapseModal] Error al subir la imagen:', error);
      Alert.alert(
        t('body.timelapse.uploadFailTitle'),
        error instanceof Error ? error.message : t('body.timelapse.uploadFailMsg')
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
          Alert.alert(t('body.alert.permTitle'), t('body.timelapse.cameraMsg'));
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
      Alert.alert(t('body.alert.errorTitle'), t('body.timelapse.galleryError'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: '88%' }}>
          <View className="overflow-hidden rounded-t-3xl border-t border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night shadow-2xl">
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 dark:bg-trauma-nightLine" />

            {/* Cabecera */}
            <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-trauma-nightLine px-5 pb-3 pt-3">
              <View className="flex-1 pr-2">
                <Text className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
                  {t('body.timelapse.title')}
                </Text>
                <Text className="font-mono text-base font-extrabold text-trauma-ink dark:text-trauma-nightInk" numberOfLines={1}>
                  {t(muscleNameKey(muscle.id))}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                accessibilityLabel={t('common.close')}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt active:bg-slate-200 dark:active:bg-trauma-nightLine">
                <X size={16} color={iconSlate} />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
              {/* Visor principal del timelapse */}
              {currentPhoto ? (
                <View className="overflow-hidden rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt">
                  <View className="h-56 w-full items-center justify-center bg-slate-100 dark:bg-trauma-nightAlt">
                    <Image
                      source={resolveInjuryPhotoSource(currentPhoto.uri)}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    <View className="absolute left-3 top-3 rounded-lg bg-slate-900/75 px-2.5 py-1">
                      <Text className="font-mono text-[10px] font-bold text-white">
                        {t('body.timelapse.day', { day: currentPhoto.dayNumber, total: photos.length })}
                      </Text>
                    </View>
                    {currentPhoto.painIntensity !== undefined && (
                      <View className="absolute right-3 top-3 rounded-lg bg-white/90 dark:bg-trauma-night/90 px-2 py-1">
                        <Text className="font-mono text-[10px] font-bold text-slate-800 dark:text-trauma-nightInk">
                          {t('body.timelapse.pain', { value: currentPhoto.painIntensity })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="p-3.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-mono text-[10px] font-bold text-slate-700 dark:text-trauma-nightInk">
                        {currentPhoto.capturedAt}
                      </Text>
                      {photos.length >= 2 && (
                        <View className="flex-row items-center gap-2">
                          <Pressable
                            onPress={() => {
                              setIsPlaying(false);
                              setSelectedIndex(0);
                            }}
                            className="h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night">
                            <RotateCcw size={12} color={iconSlate} />
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              if (!isPlaying && selectedIndex === null) {
                                setSelectedIndex(0);
                              }
                              setIsPlaying((p) => !p);
                            }}
                            className="flex-row items-center rounded-lg border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt px-2.5 py-1">
                            {isPlaying ? (
                              <Pause size={12} color={iconInk} />
                            ) : (
                              <Play size={12} color={iconInk} />
                            )}
                            <Text className="ml-1 font-mono text-[10px] font-bold text-trauma-ink dark:text-trauma-nightInk">
                              {isPlaying ? t('body.timelapse.pause') : t('body.timelapse.play')}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                    {!!currentPhoto.note && (
                      <Text className="mt-1.5 font-mono text-[11px] text-slate-500 dark:text-trauma-nightMuted">
                        {currentPhoto.note}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View className="items-center rounded-2xl border border-dashed border-slate-300 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-6">
                  {isLoadingPhotos ? (
                    <ActivityIndicator color={colors.accentDeep} />
                  ) : (
                    <Camera size={26} color={colors.textSubtle} />
                  )}
                  <Text className="mt-2 font-mono text-xs font-bold text-slate-600 dark:text-trauma-nightMuted">
                    {isLoadingPhotos
                      ? t('body.timelapse.loading')
                      : photoLoadError
                        ? t('body.timelapse.loadFailTitle')
                        : t('body.timelapse.empty')}
                  </Text>
                  <Text className="mt-0.5 text-center font-mono text-[10px] text-slate-400 dark:text-trauma-nightSubtle">
                    {photoLoadError ?? t('body.timelapse.emptyHint')}
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
                          selected ? 'border-trauma-cyanDeep' : 'border-slate-200 dark:border-trauma-nightLine'
                        }`}>
                        <Image
                          source={resolveInjuryPhotoSource(p.uri)}
                          style={{ width: 58, height: 58 }}
                          resizeMode="cover"
                        />
                        <View className="bg-white dark:bg-trauma-night py-0.5">
                          <Text className="text-center font-mono text-[9px] font-bold text-slate-700 dark:text-trauma-nightInk">
                            {t('body.timelapse.dayShort', { day: p.dayNumber })}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Añadir foto del día */}
              <View className="mt-4 pb-8">
                <Text className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-trauma-nightMuted">
                  {t('body.timelapse.addToday')}
                </Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('body.timelapse.notePlaceholder')}
                  placeholderTextColor={colors.textSubtle}
                  className="mb-3 rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt px-3 py-2 font-mono text-xs text-slate-700 dark:text-trauma-nightInk"
                />

                <View className="flex-row gap-2.5">
                  <Pressable
                    onPress={handleTakePhoto}
                    disabled={isLoadingPhotos || isUploading}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt py-3 active:opacity-75">
                    {isUploading ? (
                      <ActivityIndicator size="small" color={iconInk} />
                    ) : (
                      <Camera size={16} color={iconInk} />
                    )}
                    <Text className="ml-2 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {isUploading ? t('body.timelapse.uploading') : t('body.register.takePhoto')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickFromGallery}
                    disabled={isLoadingPhotos || isUploading}
                    className="flex-1 flex-row items-center justify-center rounded-xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night py-3 active:opacity-75">
                    <Images size={16} color={iconSlate2} />
                    <Text className="ml-2 font-mono text-xs font-bold text-slate-700 dark:text-trauma-nightInk">
                      {t('body.register.gallery')}
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
