import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image, type ImageProps } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Calendar, Check, ChevronDown, Globe, Lock, Orbit, Rocket, Satellite, X } from 'lucide-react-native';
import { ENVIRONMENTS, SPACE_LOCATIONS } from '../../services/mission-api';
import { EnvironmentType } from '../../types/mission';
import { useMission } from './mission-context';

function EnvironmentIcon({ env, color }: { env: EnvironmentType; color: string }) {
  if (env === 'nave') return <Rocket size={15} color={color} />;
  if (env === 'estacion') return <Satellite size={15} color={color} />;
  if (env === 'luna') return <Orbit size={15} color={color} />;
  return <Globe size={15} color={color} />;
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
  const bg = ENV_CARD_BG[env] ?? ENV_CARD_BG.tierra;
  const config = ENVIRONMENTS[env] ?? ENVIRONMENTS.tierra;

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
          {config.gravityLabel}
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

  const options = (['nave', 'estacion', 'luna', 'marte', 'tierra'] as EnvironmentType[]).map(
    (id) => ENVIRONMENTS[id]
  );
  const inTransit = environment === 'nave';
  const destShort = SPACE_LOCATIONS[destination].shortLabel;

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel="Cambiar ubicación del astronauta"
          className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-line bg-white active:opacity-75 ${compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5 shadow-xs'
            }`}>
          <View className="flex-1 flex-row items-center pr-2">
            <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
              <EnvironmentIcon env={environment} color="#0284c7" />
            </View>
            <View className="flex-1">
              <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400" numberOfLines={1}>
                {inTransit ? `Rumbo a ${destShort}` : 'Ubicación actual'}
              </Text>
              <Text className="font-mono text-xs font-bold text-trauma-ink" numberOfLines={1}>
                {environmentConfig.shortLabel}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            {flightPlanAccepted && (
              <View className="mr-1.5 h-5 w-5 items-center justify-center rounded-md bg-sky-50">
                <Lock size={11} color="#0284c7" />
              </View>
            )}
            <View className="mr-1.5 rounded-md bg-slate-100 px-1.5 py-0.5">
              <Text className="font-mono text-[9px] font-bold text-slate-600">
                {environmentConfig.gravityLabel.split(' ')[0]}
              </Text>
            </View>
            <ChevronDown size={15} color="#475569" />
          </View>
        </Pressable>

        {/* Botón directo de Plan de Vuelo */}
        <Pressable
          onPress={openMissionSetup}
          accessibilityLabel="Abrir plan de vuelo"
          className={`flex-row items-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft active:opacity-75 ${compact ? 'px-3 py-2' : 'px-3.5 py-3 shadow-xs'
            }`}>
          <Calendar size={14} color="#0f172a" />
          <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-trauma-ink">
            Plan de vuelo
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
            backgroundColor: 'rgba(15,23,42,0.42)',
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ maxHeight: '88%' }}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-mono text-sm font-bold text-trauma-ink">
                Ubicación actual del astronauta
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityLabel="Cerrar selector de ubicación"
                className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <X size={15} color="#475569" />
              </Pressable>
            </View>

            {flightPlanAccepted ? (
              <View className="mb-3.5 flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    openMissionSetup();
                  }}
                  className="flex-1 items-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-2.5 active:opacity-75">
                  <Text className="font-mono text-[10.5px] font-bold text-trauma-ink">
                    Ver plan de vuelo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={cancelFlightPlan}
                  className="flex-1 items-center rounded-xl border border-slate-200 bg-white py-2.5 active:opacity-75">
                  <Text className="font-mono text-[10.5px] font-bold text-slate-700">
                    Cancelar plan
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text className="mb-3.5 font-mono text-[10px] text-slate-400">
                Elige tu ubicación actual y se guardará en tu perfil.
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
              className="mt-4 flex-row items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2.5 active:opacity-75">
              <Calendar size={14} color="#0284c7" />
              <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-slate-700">
                Configurar salida, destino y actividad
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
