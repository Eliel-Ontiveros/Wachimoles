import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Calendar, Check, ChevronDown, Globe, Orbit, Rocket, X } from 'lucide-react-native';
import { ENVIRONMENTS, getRouteTotalDays, SPACE_LOCATIONS } from '../../services/mission-api';
import { EnvironmentType } from '../../types/mission';
import { useMission } from './mission-context';

function EnvironmentIcon({ env, color }: { env: EnvironmentType; color: string }) {
  if (env === 'nave') return <Rocket size={15} color={color} />;
  if (env === 'luna') return <Orbit size={15} color={color} />;
  return <Globe size={15} color={color} />;
}

const CARD_THEME: Record<
  EnvironmentType,
  {
    activeBorder: string;
    badgeBg: string;
    iconColor: string;
    subtitleColor: string;
  }
> = {
  nave: {
    activeBorder: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.22)',
    iconColor: '#7dd3fc',
    subtitleColor: '#bae6fd',
  },
  luna: {
    activeBorder: '#cbd5e1',
    badgeBg: 'rgba(203, 213, 225, 0.22)',
    iconColor: '#e2e8f0',
    subtitleColor: '#cbd5e1',
  },
  marte: {
    activeBorder: '#fb923c',
    badgeBg: 'rgba(251, 146, 60, 0.24)',
    iconColor: '#fdba74',
    subtitleColor: '#fed7aa',
  },
  tierra: {
    activeBorder: '#34d399',
    badgeBg: 'rgba(255, 255, 255, 0.22)',
    iconColor: '#ffffff',
    subtitleColor: '#e0f2fe',
  },
};

function EnvironmentCardBackdrop({ env }: { env: EnvironmentType }) {
  return (
    <Svg
      viewBox="0 0 320 90"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <LinearGradient id="envGradNave" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#050a18" />
          <Stop offset="55%" stopColor="#0b132b" />
          <Stop offset="100%" stopColor="#0f172a" />
        </LinearGradient>
        <LinearGradient id="envGradLuna" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#090d16" />
          <Stop offset="62%" stopColor="#1e293b" />
          <Stop offset="100%" stopColor="#334155" />
        </LinearGradient>
        <LinearGradient id="envGradMarte" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#431407" />
          <Stop offset="55%" stopColor="#9a3412" />
          <Stop offset="100%" stopColor="#c2410c" />
        </LinearGradient>
        <LinearGradient id="envGradTierra" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#0369a1" />
          <Stop offset="55%" stopColor="#0284c7" />
          <Stop offset="100%" stopColor="#38bdf8" />
        </LinearGradient>
      </Defs>

      {env === 'nave' && (
        <>
          <Rect x={0} y={0} width={320} height={90} fill="url(#envGradNave)" />
          <Circle cx={268} cy={46} r={34} fill="#0ea5e9" opacity={0.12} />
          <Path
            d="M 185 88 Q 250 18 326 30"
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            opacity={0.5}
          />
          <Circle cx={292} cy={22} r={9} fill="#1e3a8a" stroke="#38bdf8" strokeWidth={1} opacity={0.55} />
          <Circle cx={34} cy={18} r={1} fill="#e0f2fe" opacity={0.75} />
          <Circle cx={88} cy={12} r={1.2} fill="#ffffff" opacity={0.85} />
          <Circle cx={142} cy={24} r={0.9} fill="#bae6fd" opacity={0.65} />
          <Circle cx={196} cy={14} r={1.3} fill="#ffffff" opacity={0.8} />
          <Circle cx={238} cy={30} r={1} fill="#7dd3fc" opacity={0.75} />
          <Circle cx={62} cy={72} r={0.9} fill="#ffffff" opacity={0.5} />
          <Circle cx={172} cy={66} r={1.1} fill="#e0f2fe" opacity={0.65} />
          <Circle cx={255} cy={70} r={1.2} fill="#ffffff" opacity={0.7} />
        </>
      )}

      {env === 'luna' && (
        <>
          <Rect x={0} y={0} width={320} height={90} fill="url(#envGradLuna)" />
          <Circle cx={42} cy={16} r={1.1} fill="#ffffff" opacity={0.8} />
          <Circle cx={108} cy={12} r={0.9} fill="#e2e8f0" opacity={0.65} />
          <Circle cx={166} cy={20} r={1.2} fill="#ffffff" opacity={0.85} />
          <Circle cx={224} cy={14} r={1} fill="#cbd5e1" opacity={0.7} />
          <Circle cx={286} cy={22} r={1.3} fill="#ffffff" opacity={0.8} />
          <Circle cx={260} cy={28} r={0.8} fill="#e2e8f0" opacity={0.55} />
          {/* Horizonte y superficie gris lunar con cráteres */}
          <Path
            d="M 0 60 Q 75 46 155 56 T 320 50 L 320 90 L 0 90 Z"
            fill="#475569"
          />
          <Path
            d="M 0 68 Q 90 58 190 66 T 320 62 L 320 90 L 0 90 Z"
            fill="#64748b"
          />
          <Ellipse cx={245} cy={73} rx={22} ry={6.5} fill="#334155" opacity={0.75} />
          <Ellipse cx={245} cy={74} rx={17} ry={4.2} fill="#475569" opacity={0.7} />
          <Ellipse cx={110} cy={78} rx={15} ry={4.5} fill="#334155" opacity={0.65} />
          <Ellipse cx={288} cy={63} rx={10} ry={3} fill="#94a3b8" opacity={0.35} />
        </>
      )}

      {env === 'marte' && (
        <>
          <Rect x={0} y={0} width={320} height={90} fill="url(#envGradMarte)" />
          <Circle cx={274} cy={24} r={16} fill="#fb923c" opacity={0.18} />
          <Circle cx={274} cy={24} r={8} fill="#fdba74" opacity={0.3} />
          <Circle cx={72} cy={16} r={1} fill="#fed7aa" opacity={0.55} />
          <Circle cx={154} cy={12} r={1.1} fill="#ffedd5" opacity={0.6} />
          <Circle cx={216} cy={20} r={0.9} fill="#fed7aa" opacity={0.5} />
          {/* Dunas y cañones rojizos de Marte */}
          <Path
            d="M 0 56 Q 80 42 165 54 T 320 46 L 320 90 L 0 90 Z"
            fill="#7c2d12"
          />
          <Path
            d="M 0 68 Q 105 55 205 68 T 320 60 L 320 90 L 0 90 Z"
            fill="#ea580c"
            opacity={0.78}
          />
          <Ellipse cx={250} cy={76} rx={20} ry={5.5} fill="#431407" opacity={0.55} />
          <Ellipse cx={95} cy={80} rx={14} ry={4} fill="#7c2d12" opacity={0.6} />
        </>
      )}

      {env === 'tierra' && (
        <>
          <Rect x={0} y={0} width={320} height={90} fill="url(#envGradTierra)" />
          {/* Nubes atmosféricas */}
          <Ellipse cx={225} cy={22} rx={24} ry={6} fill="#ffffff" opacity={0.22} />
          <Ellipse cx={240} cy={20} rx={14} ry={5} fill="#ffffff" opacity={0.28} />
          <Ellipse cx={125} cy={16} rx={18} ry={4.5} fill="#ffffff" opacity={0.18} />
          {/* Océano y colinas verdes terrestres */}
          <Path
            d="M 0 60 Q 95 54 195 58 T 320 55 L 320 90 L 0 90 Z"
            fill="#0369a1"
            opacity={0.75}
          />
          <Path
            d="M 0 66 Q 72 52 155 66 T 320 58 L 320 90 L 0 90 Z"
            fill="#059669"
          />
          <Path
            d="M 110 90 Q 200 60 320 68 L 320 90 Z"
            fill="#10b981"
            opacity={0.9}
          />
        </>
      )}
    </Svg>
  );
}

// Selector desplegable de ubicación actual del astronauta (Nave / Luna / Marte / Tierra)
export function EnvironmentSelector({ compact = false }: { compact?: boolean }) {
  const {
    environment,
    environmentConfig,
    origin,
    destination,
    setEnvironment,
    openMissionSetup,
  } = useMission();
  const [open, setOpen] = useState(false);

  const options = (['nave', 'luna', 'marte', 'tierra'] as EnvironmentType[]).map(
    (id) => ENVIRONMENTS[id]
  );
  const inTransit = environment === 'nave' && destination !== 'nave';
  const destShort = SPACE_LOCATIONS[destination].shortLabel;

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel="Cambiar ubicación del astronauta"
          className={`flex-1 flex-row items-center justify-between rounded-xl border border-trauma-line bg-white active:opacity-75 ${
            compact ? 'px-3 py-1.5' : 'px-3.5 py-2.5 shadow-xs'
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
          className={`flex-row items-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft active:opacity-75 ${
            compact ? 'px-3 py-2' : 'px-3.5 py-3 shadow-xs'
          }`}>
          <Calendar size={14} color="#0f172a" />
          <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-trauma-ink">
            Plan de vuelo
          </Text>
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
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
            <View className="mb-1 flex-row items-center justify-between">
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
            <Text className="mb-4 font-mono text-[10px] text-slate-400">
              Si cambias tu ubicación a Base Lunar o Marte, la misión se adelantará a la llegada.
            </Text>

            <View className="gap-2.5">
              {options.map((opt) => {
                const active = opt.id === environment;
                const theme = CARD_THEME[opt.id];
                const routeDays = getRouteTotalDays(origin === opt.id ? 'tierra' : origin, opt.id);
                const subtitle =
                  opt.id === 'nave'
                    ? `${opt.gravityLabel} · En tránsito / órbita`
                    : opt.id === 'tierra'
                      ? `${opt.gravityLabel} · Base / Readaptación`
                      : `${opt.gravityLabel} · Adelanta misión al día ${routeDays}`;

                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      setEnvironment(opt.id);
                      setOpen(false);
                    }}
                    style={{
                      borderColor: active ? theme.activeBorder : 'rgba(15, 23, 42, 0.14)',
                      borderWidth: active ? 2 : 1,
                    }}
                    className="overflow-hidden rounded-2xl active:opacity-85">
                    <EnvironmentCardBackdrop env={opt.id} />

                    <View
                      style={{
                        backgroundColor: active
                          ? 'rgba(15, 23, 42, 0.14)'
                          : 'rgba(15, 23, 42, 0.24)',
                      }}
                      className="flex-row items-center justify-between px-3.5 py-3.5">
                      <View className="flex-1 flex-row items-center pr-2">
                        <View
                          style={{
                            backgroundColor: theme.badgeBg,
                            borderColor: active
                              ? theme.activeBorder
                              : 'rgba(255, 255, 255, 0.22)',
                            borderWidth: 1,
                          }}
                          className="mr-3 h-9 w-9 items-center justify-center rounded-xl">
                          <EnvironmentIcon env={opt.id} color={theme.iconColor} />
                        </View>
                        <View className="flex-1">
                          <Text className="font-mono text-xs font-extrabold text-white">
                            {opt.label}
                          </Text>
                          <Text
                            style={{ color: theme.subtitleColor }}
                            className="mt-0.5 font-mono text-[9.5px] font-semibold">
                            {subtitle}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <View
                          style={{ backgroundColor: 'rgba(255, 255, 255, 0.16)' }}
                          className="rounded-md px-1.5 py-0.5">
                          <Text className="font-mono text-[9px] font-bold text-white">
                            {opt.gravityLabel.split(' ')[0]}
                          </Text>
                        </View>
                        {active && (
                          <View
                            style={{ backgroundColor: theme.activeBorder }}
                            className="h-5 w-5 items-center justify-center rounded-full">
                            <Check size={12} color="#0f172a" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

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
