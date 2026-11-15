import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Calendar, Check, CheckCircle2, ChevronRight, Lock, X } from 'lucide-react-native';
import { ENVIRONMENTS, getEnvironmentText } from '../../services/mission-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';
import { EnvironmentType } from '../../types/mission';
import { useMission } from './mission-context';

// Todos los SVGs de tarjetas comparten viewBox="0 0 809.1 184.7"
const ENV_CARD_BG: Record<
  EnvironmentType,
  {
    source: ImageProps['source'];
    labelLeftPct: number;
    labelTopPct: number;
  }
> = {
  nave: {
    source: require('@/assets/images/fondos/Ship.svg'),
    labelLeftPct: 4.8,
    labelTopPct: 41.5,
  },
  estacion: {
    source: require('@/assets/images/fondos/Station.svg'),
    labelLeftPct: 3.9,
    labelTopPct: 39,
  },
  luna: {
    source: require('@/assets/images/fondos/Moon.svg'),
    labelLeftPct: 4.8,
    labelTopPct: 39.5,
  },
  marte: {
    source: require('@/assets/images/fondos/Mars.svg'),
    labelLeftPct: 3.6,
    labelTopPct: 40,
  },
  tierra: {
    source: require('@/assets/images/fondos/REAL EARTH.svg'),
    labelLeftPct: 3.4,
    labelTopPct: 42.5,
  },
};

const ENV_BANNER_BG: Record<
  EnvironmentType,
  {
    source: ImageProps['source'];
    scrimStartOpacity: number;
    scrimMidOpacity: number;
  }
> = {
  nave: {
    source: require('@/assets/images/fondos/banners/ShipBanner.svg'),
    scrimStartOpacity: 0.42,
    scrimMidOpacity: 0.14,
  },
  estacion: {
    source: require('@/assets/images/fondos/banners/StationBanner.svg'),
    scrimStartOpacity: 0.36,
    scrimMidOpacity: 0.12,
  },
  luna: {
    source: require('@/assets/images/fondos/banners/MoonBanner.svg'),
    scrimStartOpacity: 0.45,
    scrimMidOpacity: 0.16,
  },
  marte: {
    source: require('@/assets/images/fondos/banners/MarsBanner.svg'),
    scrimStartOpacity: 0.56,
    scrimMidOpacity: 0.24,
  },
  tierra: {
    source: require('@/assets/images/fondos/banners/EarthBanner.svg'),
    scrimStartOpacity: 0.64,
    scrimMidOpacity: 0.28,
  },
};

export function EnvironmentBannerBackdrop({ env }: { env: EnvironmentType }) {
  const banner = ENV_BANNER_BG[env] ?? ENV_BANNER_BG.tierra;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={banner.source}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
      />
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bannerScrim-${env}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#060b19" stopOpacity={banner.scrimStartOpacity} />
            <Stop offset="58%" stopColor="#060b19" stopOpacity={banner.scrimMidOpacity} />
            <Stop offset="100%" stopColor="#060b19" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill={`url(#bannerScrim-${env})`} />
      </Svg>
    </View>
  );
}

function EnvironmentLocationCard({
  env,
  selected = false,
  dimmed = false,
  locked = false,
}: {
  env: EnvironmentType;
  selected?: boolean;
  dimmed?: boolean;
  locked?: boolean;
}) {
  const { locale } = useI18n();
  const bg = ENV_CARD_BG[env] ?? ENV_CARD_BG.tierra;
  const envText = getEnvironmentText(locale, env);

  return (
    <View
      style={{
        aspectRatio: 809.1 / 184.7,
        opacity: dimmed ? 0.52 : 1,
        borderRadius: 13,
      }}
      className="w-full overflow-hidden">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={bg.source}
          style={{ width: '100%', height: '100%' }}
          contentFit="fill"
        />
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${bg.labelLeftPct}%`,
          top: `${bg.labelTopPct}%`,
          right: 46,
        }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          style={{
            fontFamily: 'ASpace-Regular',
            fontSize: 10.5,
            color: '#f8f7f7',
            textShadowColor: 'rgba(6, 11, 25, 0.72)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}>
          {envText.gravityLabel}
        </Text>
      </View>

      {(selected || locked) && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 12,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}>
          {selected && (
            <View
              style={{
                backgroundColor: '#38bdf8',
                borderColor: '#ffffff',
                borderWidth: 1.5,
              }}
              className="h-6 w-6 items-center justify-center rounded-full shadow-sm">
              <Check size={13} color="#060b19" strokeWidth={3} />
            </View>
          )}
          {locked && !selected && (
            <View
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
              className="h-6 w-6 items-center justify-center rounded-full">
              <Lock size={11} color="#e2e8f0" />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// Selector modal de ubicación actual al tocar el banner estacionado
export function EnvironmentPickerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { environment, flightPlanAccepted, setEnvironment, openMissionSetup } = useMission();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const dark = scheme === 'dark';
  const slateIcon = dark ? colors.textMuted : '#475569';
  const options = (['nave', 'estacion', 'luna', 'marte', 'tierra'] as EnvironmentType[]).map(
    (id) => ENVIRONMENTS[id]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: dark ? colors.overlay : 'rgba(15,23,42,0.42)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '88%' }}
          className="rounded-3xl border border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-5 shadow-xl">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-mono text-sm font-bold text-trauma-ink dark:text-trauma-nightInk">
              {t('missions.selector.title')}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t('missions.selector.closeA11y')}
              className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt active:bg-slate-200">
              <X size={15} color={slateIcon} />
            </Pressable>
          </View>

          <Text className="mb-3.5 font-mono text-[10px] text-slate-400 dark:text-trauma-nightSubtle">
            {t('missions.selector.manualHint')}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-2.5">
              {options.map((opt) => {
                const active = opt.id === environment;
                const lockedCard = flightPlanAccepted && !active;

                return (
                  <Pressable
                    key={opt.id}
                    disabled={flightPlanAccepted}
                    onPress={() => {
                      const changed = setEnvironment(opt.id);
                      if (changed) {
                        onClose();
                      }
                    }}
                    className="active:opacity-85">
                    <EnvironmentLocationCard
                      env={opt.id}
                      selected={active}
                      dimmed={lockedCard}
                      locked={lockedCard}
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={() => {
              onClose();
              openMissionSetup();
            }}
            className="mt-4 flex-row items-center justify-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt py-2.5 active:opacity-75">
            <Calendar size={14} color={colors.accentDeep} />
            <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-slate-700 dark:text-trauma-nightMuted">
              {t('missions.selector.configure')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Fila de acciones rápidas: Plan de Vuelo en blanco (izq.) y misiones completadas en 1 fila (der.)
export function EnvironmentSelector({
  compact = false,
  onMissionsPress,
}: {
  compact?: boolean;
  onMissionsPress?: () => void;
}) {
  const { flightPlanAccepted, missions, openMissionSetup } = useMission();
  const { t } = useI18n();
  const { colors, scheme } = useAppTheme();
  const dark = scheme === 'dark';

  const completedMissions = missions.filter((m) => m.completed).length;
  const rowPad = compact ? 'px-3 py-2' : 'px-3.5 py-2.5 shadow-xs';
  const missionsLabel = t('missions.completedRow', {
    done: completedMissions,
    total: missions.length,
  });
  const missionsA11y = t('missions.completedA11y', {
    done: completedMissions,
    total: missions.length,
  });

  const completedContent = (
    <>
      <View className="flex-row items-center flex-1 min-w-0">
        <CheckCircle2 size={14} color={colors.accentDeep} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          className="ml-1.5 flex-shrink font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
          {missionsLabel}
        </Text>
      </View>
      {onMissionsPress && <ChevronRight size={13} color={colors.accentDeep} />}
    </>
  );

  return (
    <View className="flex-row items-center gap-2">
      {/* Botón blanco de Plan de Vuelo */}
      <Pressable
        onPress={openMissionSetup}
        accessibilityLabel={t('missions.selector.planA11y')}
        className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night active:opacity-75 ${rowPad}`}>
        <View className="flex-row items-center flex-1 min-w-0">
          <Calendar size={14} color={dark ? colors.text : '#0f172a'} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            className="ml-1.5 flex-shrink font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('missions.plan.title')}
          </Text>
        </View>
        {flightPlanAccepted && (
          <View className="ml-1.5 h-2 w-2 rounded-full bg-sky-600" />
        )}
      </Pressable>

      {/* Resumen de misiones completadas en la misma fila */}
      {onMissionsPress ? (
        <Pressable
          onPress={onMissionsPress}
          accessibilityLabel={missionsA11y}
          className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft/70 dark:bg-cyan-950/60 active:opacity-75 ${rowPad}`}>
          {completedContent}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={missionsA11y}
          className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft/70 dark:bg-cyan-950/60 ${rowPad}`}>
          {completedContent}
        </View>
      )}
    </View>
  );
}
