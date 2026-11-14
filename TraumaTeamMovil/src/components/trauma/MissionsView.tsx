import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Check, CheckCircle2, Circle, Dumbbell, Flame, Footprints, Sparkles } from 'lucide-react-native';
import { EnvironmentSelector } from './EnvironmentSelector';
import { SpaceJourneyTimeline } from './SpaceJourneyTimeline';
import { useMission } from './mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import { useVoice } from '@/voice/voice-context';
import { DailyMission } from '../../types/mission';

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function MissionIcon({ category, completed }: { category: DailyMission['category']; completed: boolean }) {
  const color = completed ? '#0284c7' : '#64748b';
  if (category === 'steps' || category === 'treadmill') return <Footprints size={16} color={color} />;
  if (category === 'checkin') return <Sparkles size={16} color={color} />;
  return <Dumbbell size={16} color={color} />;
}

export function MissionsView() {
  const {
    environmentConfig,
    streakDays,
    checkedInToday,
    treadmillRoutineActive,
    doDailyCheckIn,
    missions,
    toggleMission,
  } = useMission();

  const { t } = useI18n();
  const { missionsIntent, consumeMissionsIntent, announce } = useVoice();
  const [pulse] = useState(() => new Animated.Value(0));
  const handledNonce = useRef(0);
  const checkInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ checkedInToday, streakDays, doDailyCheckIn });
  useEffect(() => {
    latest.current = { checkedInToday, streakDays, doDailyCheckIn };
  });

  // Check-in por voz: resalta el botón ~1 s, hace el check-in y anuncia la racha (S7).
  useEffect(() => {
    if (!missionsIntent || missionsIntent.nonce === handledNonce.current)
      return;
    handledNonce.current = missionsIntent.nonce;
    consumeMissionsIntent(missionsIntent.nonce);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0.35,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => pulse.setValue(0));
    checkInTimer.current = setTimeout(() => {
      const cur = latest.current;
      if (cur.checkedInToday) {
        announce(t("action.checkinAlready", { days: cur.streakDays }));
      } else {
        cur.doDailyCheckIn();
        announce(t("action.checkinDone", { days: cur.streakDays + 1 }));
      }
    }, 1000);
  }, [missionsIntent, consumeMissionsIntent, announce, pulse, t]);
  useEffect(
    () => () => {
      if (checkInTimer.current) clearTimeout(checkInTimer.current);
    },
    [],
  );

  const completedCount = missions.filter((m) => m.completed).length;

  return (
    <View className="px-5 pb-10 pt-5">
      {/* Selector de entorno */}
      <View className="mb-4">
        <EnvironmentSelector />
      </View>

      {/* Tarjeta de racha estilo Duolingo */}
      <View className="mb-4 rounded-2xl border border-trauma-line bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
              <Flame size={22} color="#f97316" fill="#fb923c" />
            </View>
            <View>
              <Text className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                Racha de Check-ins
              </Text>
              <Text className="font-mono text-2xl font-extrabold text-trauma-ink">
                {streakDays} días
              </Text>
            </View>
          </View>

          <View>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -5,
              left: -5,
              right: -5,
              bottom: -5,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: '#f59e0b',
              opacity: pulse,
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }],
            }}
          />
          <Pressable
            onPress={doDailyCheckIn}
            disabled={checkedInToday}
            className={`flex-row items-center rounded-xl border px-3.5 py-2.5 ${
              checkedInToday
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-trauma-cyanEdge bg-trauma-cyanSoft active:opacity-75'
            }`}>
            <Check size={14} color={checkedInToday ? '#059669' : '#0f172a'} strokeWidth={2.5} />
            <Text
              className={`ml-1.5 font-mono text-xs font-bold ${
                checkedInToday ? 'text-emerald-700' : 'text-trauma-ink'
              }`}>
              {checkedInToday ? 'Completado' : 'Check-in hoy'}
            </Text>
          </Pressable>
          </View>
        </View>

        {/* Indicador semanal */}
        <View className="mt-4 flex-row justify-between border-t border-slate-100 pt-3">
          {WEEK_DAYS.map((day, idx) => {
            const active = idx < Math.min(6, streakDays) || (idx === 6 && checkedInToday);
            return (
              <View key={idx} className="items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border ${
                    active
                      ? 'border-amber-300 bg-amber-100'
                      : 'border-slate-200 bg-slate-50'
                  }`}>
                  {active ? (
                    <Flame size={13} color="#ea580c" fill="#fb923c" />
                  ) : (
                    <View className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </View>
                <Text className="mt-1 font-mono text-[9px] text-slate-400">{day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Animación de navecita hacia el destino */}
      <View className="mb-5">
        <SpaceJourneyTimeline />
      </View>

      {/* Misiones diarias adaptadas al entorno */}
      <View className="mb-2.5 flex-row items-center justify-between">
        <View>
          <Text className="font-mono text-sm font-bold text-trauma-ink">
            Misiones del día
          </Text>
          <Text className="font-mono text-[9.5px] text-slate-400">
            {environmentConfig.routineSummary}
          </Text>
        </View>
        <View className="rounded-lg bg-slate-100 px-2.5 py-1">
          <Text className="font-mono text-[10px] font-bold text-slate-700">
            {completedCount}/{missions.length}
          </Text>
        </View>
      </View>

      <View className="gap-2.5">
        {missions.map((mission) => {
          const pct = Math.min(100, Math.round((mission.currentValue / mission.targetValue) * 100));
          const isAutoSteps = mission.category === 'steps';
          const isTreadmill = mission.category === 'treadmill';
          const statusHint = isAutoSteps
            ? 'Sincronizado con reloj'
            : isTreadmill
              ? treadmillRoutineActive
                ? 'Caminadora activa · Toca para finalizar'
                : 'Opcional en 0g · Toca para contar pasos'
              : 'Toca para marcar';

          return (
            <Pressable
              key={mission.id}
              onPress={() => toggleMission(mission.id)}
              className={`rounded-2xl border p-3.5 shadow-xs active:opacity-85 ${
                mission.completed
                  ? 'border-trauma-cyanEdge bg-sky-50/40'
                  : 'border-trauma-line bg-white'
              }`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
                      mission.completed ? 'bg-trauma-cyanSoft' : 'bg-slate-100'
                    }`}>
                    <MissionIcon category={mission.category} completed={mission.completed} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-mono text-xs font-bold text-trauma-ink">
                      {mission.title}
                    </Text>
                    <Text className="font-mono text-[9.5px] text-slate-500">
                      {mission.description}
                    </Text>
                  </View>
                </View>

                {mission.completed ? (
                  <CheckCircle2 size={20} color="#0284c7" />
                ) : (
                  <Circle size={20} color="#cbd5e1" />
                )}
              </View>

              <View className="mt-3">
                <View className="mb-1 flex-row justify-between">
                  <Text className="font-mono text-[9px] text-slate-400">
                    {statusHint}
                  </Text>
                  <Text className="font-mono text-[9.5px] font-bold text-slate-700">
                    {mission.currentValue.toLocaleString()} / {mission.targetValue.toLocaleString()}{' '}
                    {mission.unit}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <View
                    className="h-full rounded-full bg-trauma-cyan"
                    style={{ width: `${pct}%` }}
                  />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

