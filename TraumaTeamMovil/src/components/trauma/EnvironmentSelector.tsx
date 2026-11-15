import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import Svg, { Defs, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { Calendar, Check, ChevronDown, Lock, X } from 'lucide-react-native';
import {
  ENVIRONMENTS,
  getEnvironmentText,
  getLocationText,
} from '../../services/mission-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useAppTheme } from '@/theme';
import { EnvironmentType } from '../../types/mission';
import { useMission } from './mission-context';

// Iconos vectoriales personalizados de assets/images/Icons (teñibles con `color` para claro/oscuro)
function EnvironmentIcon({ env, color }: { env: EnvironmentType; color: string }) {
  if (env === 'nave') {
    return (
      <Svg width={18} height={18} viewBox="0 0 85.58 57.49">
        <Path
          fill={color}
          d="M44.35,56.64l25.44-24.28c2.84-1.11,5.62-2.29,8.17-3.37,2.95-1.26,5.58-2.39,7.62-3.11q-1.23-6.46-2.47-12.92c-2.17.02-5.02-.09-8.24-.19-3.29-.12-6.97-.22-10.71-.19L33.56.2c-1.68-.68-4.18.48-3.92,1.83l2.77,14.47q-2.03.39-4.01.8l-.45-2.38c-.19-.96-1.12-1.59-2.08-1.41L1.44,18.18c-.96.19-1.59,1.12-1.41,2.08l1.18,6.14c.18.97,1.11,1.6,2.08,1.42l6.4-1.23c-.45,1.56-.71,3.36-.57,5.36.26,3.51,1.7,6.29,3.28,8.33l-6.49,1.25c-.97.18-1.6,1.11-1.41,2.08l1.17,6.14c.18.96,1.12,1.59,2.08,1.41l24.42-4.67c.97-.18,1.6-1.12,1.42-2.08l-.52-2.7q1.99-.38,4.01-.78l2.96,15.46C40.29,57.73,43.04,57.89,44.35,56.64ZM59.4,24.01c-.52-2.71,1.25-5.32,3.96-5.83s5.31,1.25,5.83,3.96c.52,2.7-1.26,5.31-3.96,5.83C62.53,28.48,59.91,26.71,59.4,24.01Z"
        />
      </Svg>
    );
  }
  if (env === 'estacion') {
    return (
      <Svg width={17} height={17} viewBox="0 0 96.31 82.6">
        <Polygon
          fill={color}
          points="79.26,14.28 67.61,39.13 58.83,35.02 63.07,25.97 64.91,26.84 67.63,21.04 65.78,20.18 67.95,15.54 55.58,9.74 53.41,14.38 51.56,13.51 48.84,19.3 50.69,20.17 46.45,29.21 37.17,24.86 49.62,1.88 27.42,0 0,50.6 22.21,52.48 33.84,31.01 43.49,35.54 38.24,46.73 36.68,45.99 32.93,53.98 34.5,54.71 29.25,65.92 32.18,67.29 28.57,75 35.08,78.05 38.69,70.35 41.62,71.72 46.88,60.51 48.44,61.25 52.19,53.26 50.62,52.53 55.86,41.34 64.65,45.45 54.83,66.39 71.88,82.6 96.31,30.49 79.26,14.28"
        />
      </Svg>
    );
  }
  if (env === 'luna') {
    return (
      <Svg width={16} height={16} viewBox="0 0 68.19 68.19">
        <Path
          fill={color}
          d="M34.1,0C15.27,0,0,15.27,0,34.1s15.27,34.09,34.1,34.09,34.09-15.26,34.09-34.09S52.93,0,34.1,0ZM13.66,33.23c-12.81,1.7-7.17-19.9,1.81-21.74C26.93,11.19,19.59,29.76,13.66,33.23ZM29.73,64.57c-4.99.38-12.26-2.14-9.85-5.85.66-1.02,1.79-1.64,3-1.82,2.42-.35,5.8.06,8.16,1.23C34.09,59.64,33.13,64.32,29.73,64.57ZM34.3,50.85c-8.39,3.27-23.68-7.53-13.33-14.84C29.03,32.13,45.93,44.74,34.3,50.85ZM39.94,30c-1.76,6.03-10.98,2.69-9.64-2.99C32.21,19.85,41.86,23.16,39.94,30ZM41.08,10.51c.28-13.34,22.61,6.22,8.75,9.1C44.61,19.89,42.34,14.68,41.08,10.51ZM61.51,50.77c-.89,4.96-7.96,10.78-11.55,7.55-1.47-1.33-1.57-3.6-.47-5.25,2.98-4.49,10.97-9.72,12.02-3.41C61.57,50.02,61.57,50.41,61.51,50.77ZM61.55,34.11c-1.06,4.88-4.48,10.8-10.18,10.43C32.17,39.71,61.51,12.65,61.55,34.11Z"
        />
      </Svg>
    );
  }
  if (env === 'marte') {
    return (
      <Svg width={16} height={16} viewBox="0 0 71.8 71.8">
        <Path
          fill={color}
          d="M35.9,0C16.07,0,0,16.07,0,35.9s16.07,35.9,35.9,35.9,35.9-16.08,35.9-35.9S55.72,0,35.9,0ZM28.17,55.15l-4.96,1.42-2.75,2.33-6.61-2.37-1.26-6.92,5.36-4.54.53.19,6.35-1.81,5.04,4.89L28.17,55.15ZM35.52,27.84l-6.66,2.22-.49,2.36-6.66,2.22-5.26-4.67.48-2.35-5.25-4.66,2.82-13.77,13.33-4.44,5.08,4.51,1.15-.97,6.61,2.37,1.26,6.92-5.21,4.41L35.52,27.84ZM57.03,53.32l-6.67,2.22-1.17-1.03-2.05,3.56h-7.03s-3.51-6.09-3.51-6.09l3.51-6.08h6.02s.39-1.9.39-1.9l4.13-1.38-.22-4.02,5.88-3.84,6.27,3.17.39,7.02-4.88,3.19L57.03,53.32Z"
        />
      </Svg>
    );
  }
  return (
    <Svg width={16} height={16} viewBox="0 0 68.87 68.89">
      <Path
        fill={color}
        d="M1.18,43.41c5.46,20.1,27.2,30.79,46.45,22.85,15.88-6.55,24.56-24.2,20.06-40.78C62.23,5.39,40.49-5.31,21.24,2.64,5.37,9.19-3.32,26.83,1.18,43.41ZM13.03,53.02c-5.76-5.85-6.96-13.43-7.27-16.59-.46-4.82-.04-11.91,2.15-12.4,1.05-.23,2.17,1.11,2.81,1.88,3.46,4.17,1.33,7.62,3.43,14.01,1.54,4.72,3.55,5.41,4.89,11.41.41,1.83,1,4.59-.05,5.23C17.49,57.49,13.54,53.54,13.03,53.02ZM50.03,37.63c.46.07.91.19,1.33.39,1.49.73,2.86,1.96,3.18,2.82,1.24,3.33-9.91,6.84-11.9,15.72-.72,3.21.24,5.03-1.38,6.53-2.31,2.14-7.2,1.21-10.24-.75-6.41-4.11-5.98-13.64-5.96-14.06.02-.37.03-.55.07-.79C27.08,35.77,40.89,36.3,50.03,37.63ZM60.93,23.57c.24,1.1.09,2.28-.45,3.27-3.19,5.86-10.59.67-16.26-1.03-.95-.28-1.98-.3-2.93.01-14.99,4.86-29.27-4.26-19.09-18.46.59-.82,1.42-1.45,2.36-1.8C37.76.68,58.03,10,60.93,23.57Z"
      />
    </Svg>
  );
}

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

export function EnvironmentLocationCard({
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

// Selector desplegable de ubicación actual del astronauta (Nave / EEI / Luna / Marte / Tierra)
export function EnvironmentSelector({ compact = false }: { compact?: boolean }) {
  const {
    environment,
    environmentConfig,
    destination,
    flightPlanAccepted,
    setEnvironment,
    cancelFlightPlan,
    openMissionSetup,
  } = useMission();
  const [open, setOpen] = useState(false);
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const dark = scheme === 'dark';
  const slateIcon = dark ? colors.textMuted : '#475569';
  const envText = getEnvironmentText(locale, environmentConfig.id);

  const options = (['nave', 'estacion', 'luna', 'marte', 'tierra'] as EnvironmentType[]).map(
    (id) => ENVIRONMENTS[id]
  );
  const inTransit = environment === 'nave';
  const destShort = getLocationText(locale, destination).shortLabel;

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel={t('missions.selector.changeA11y')}
          className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night active:opacity-75 ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5 shadow-xs'
            }`}>
          <View className="flex-1 flex-row items-center pr-2">
            <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
              <EnvironmentIcon env={environment} color={colors.accentDeep} />
            </View>
            <View className="flex-1">
              <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle" numberOfLines={1}>
                {inTransit
                  ? t('missions.selector.headingTo', { dest: destShort })
                  : t('missions.selector.current')}
              </Text>
              <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk" numberOfLines={1}>
                {envText.shortLabel}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            {flightPlanAccepted && (
              <View className="mr-1.5 h-5 w-5 items-center justify-center rounded-md bg-sky-50 dark:bg-sky-950">
                <Lock size={11} color={colors.accentDeep} />
              </View>
            )}
            <View className="mr-1.5 rounded-md bg-slate-100 dark:bg-trauma-nightAlt px-1.5 py-0.5">
              <Text className="font-mono text-[9px] font-bold text-slate-600 dark:text-trauma-nightMuted">
                {envText.gravityLabel.split(' ')[0]}
              </Text>
            </View>
            <ChevronDown size={15} color={slateIcon} />
          </View>
        </Pressable>

        {/* Botón directo de Plan de Vuelo */}
        <Pressable
          onPress={openMissionSetup}
          accessibilityLabel={t('missions.selector.planA11y')}
          className={`flex-row items-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt active:opacity-75 ${compact ? 'px-3 py-2' : 'px-3.5 py-3 shadow-xs'
            }`}>
          <Calendar size={14} color={dark ? colors.text : '#0f172a'} />
          <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('missions.plan.title')}
          </Text>
          {flightPlanAccepted && (
            <View className="ml-1.5 h-2 w-2 rounded-full bg-sky-600" />
          )}
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
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
                onPress={() => setOpen(false)}
                accessibilityLabel={t('missions.selector.closeA11y')}
                className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt active:bg-slate-200">
                <X size={15} color={slateIcon} />
              </Pressable>
            </View>

            {flightPlanAccepted ? (
              <View className="mb-3.5 flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    openMissionSetup();
                  }}
                  className="flex-1 items-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt py-2.5 active:opacity-75">
                  <Text className="font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
                    {t('missions.selector.viewPlan')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={cancelFlightPlan}
                  accessibilityLabel={t('missions.selector.cancelPlanA11y')}
                  className="flex-1 items-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night py-2.5 active:opacity-75">
                  <Text className="font-mono text-[10.5px] font-bold text-slate-700 dark:text-trauma-nightMuted">
                    {t('missions.selector.cancelPlan')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text className="mb-3.5 font-mono text-[10px] text-slate-400 dark:text-trauma-nightSubtle">
                {t('missions.selector.manualHint')}
              </Text>
            )}

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
                          setOpen(false);
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
                setOpen(false);
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
    </>
  );
}
