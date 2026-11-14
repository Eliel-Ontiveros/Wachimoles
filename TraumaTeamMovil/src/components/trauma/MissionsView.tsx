import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Check, CheckCircle2, Circle, Dumbbell, Flame, Footprints, Sparkles } from 'lucide-react-native';
import { EnvironmentSelector } from './EnvironmentSelector';
import { SpaceJourneyTimeline } from './SpaceJourneyTimeline';
import { useMission } from './mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber } from '@/i18n/format';
import { useAppTheme } from '@/theme';
import { getEnvironmentText } from '../../services/mission-api';
import { useVoice } from '@/voice/voice-context';
import { DailyMission } from '../../types/mission';
import { StreakCheckinHost } from '../streak/StreakCheckinHost';
import { playStreakCheckin } from '../streak/streak-checkin';

function MissionIcon({ category, completed }: { category: DailyMission['category']; completed: boolean }) {
  const { colors } = useAppTheme();
  const color = completed ? colors.accentDeep : colors.textMuted;
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

  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const weekDays = t('missions.week.initials').split(',');
  const routineSummary = getEnvironmentText(locale, environmentConfig.id).routineSummary;
  const { missionsIntent, consumeMissionsIntent, announce } = useVoice();
  const [pulse] = useState(() => new Animated.Value(0));
  const handledNonce = useRef(0);
  const checkInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ checkedInToday, streakDays, doDailyCheckIn });
  useEffect(() => {
    latest.current = { checkedInToday, streakDays, doDailyCheckIn };
  });

  // Animación de racha: se dispara solo cuando el check-in del día pasa de
  // pendiente a hecho (botón, voz o misión), nunca al cargar la pantalla.
  const prevCheckedIn = useRef(checkedInToday);
  useEffect(() => {
    if (!prevCheckedIn.current && checkedInToday) {
      playStreakCheckin({ streak: streakDays, todayIndex: new Date().getDay() });
    }
    prevCheckedIn.current = checkedInToday;
  }, [checkedInToday, streakDays]);

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
      <StreakCheckinHost />
      {/* Selector de entorno */}
      <View className="mb-4">
        <EnvironmentSelector />
      </View>

      {/* Tarjeta de racha estilo Duolingo */}
      <View className="mb-4 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <Flame size={22} color="#f97316" fill="#fb923c" />
            </View>
            <View>
              <Text className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
                {t('missions.streak.title')}
              </Text>
              <Text className="font-mono text-2xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
                {t(streakDays === 1 ? 'missions.streak.day' : 'missions.streak.days', { n: streakDays })}
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
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
                : 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt active:opacity-75'
            }`}>
            <Check size={14} color={checkedInToday ? colors.success : scheme === 'dark' ? colors.text : '#0f172a'} strokeWidth={2.5} />
            <Text
              className={`ml-1.5 font-mono text-xs font-bold ${
                checkedInToday
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-trauma-ink dark:text-trauma-nightInk'
              }`}>
              {checkedInToday ? t('missions.checkin.done') : t('missions.checkin.today')}
            </Text>
          </Pressable>
          </View>
        </View>

        {/* Indicador semanal */}
        <View className="mt-4 flex-row justify-between border-t border-slate-100 dark:border-trauma-nightLine pt-3">
          {weekDays.map((day, idx) => {
            const active = idx < Math.min(6, streakDays) || (idx === 6 && checkedInToday);
            return (
              <View key={idx} className="items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border ${
                    active
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900'
                      : 'border-slate-200 dark:border-trauma-nightLine bg-slate-50 dark:bg-trauma-nightAlt'
                  }`}>
                  {active ? (
                    <Flame size={13} color="#ea580c" fill="#fb923c" />
                  ) : (
                    <View className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  )}
                </View>
                <Text className="mt-1 font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{day}</Text>
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
          <Text className="font-mono text-sm font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('missions.daily.title')}
          </Text>
          <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
            {routineSummary}
          </Text>
        </View>
        <View className="rounded-lg bg-slate-100 dark:bg-trauma-nightAlt px-2.5 py-1">
          <Text className="font-mono text-[10px] font-bold text-slate-700 dark:text-trauma-nightMuted">
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
            ? t('missions.hint.sync')
            : isTreadmill
              ? treadmillRoutineActive
                ? t('missions.hint.treadmillOn')
                : t('missions.hint.treadmillOff')
              : t('missions.hint.toggle');

          return (
            <Pressable
              key={mission.id}
              onPress={() => toggleMission(mission.id)}
              className={`rounded-2xl border p-3.5 shadow-xs active:opacity-85 ${
                mission.completed
                  ? 'border-trauma-cyanEdge bg-sky-50/40 dark:bg-sky-950/40'
                  : 'border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night'
              }`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-2">
                  <View
                    className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
                      mission.completed
                        ? 'bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                        : 'bg-slate-100 dark:bg-trauma-nightAlt'
                    }`}>
                    <MissionIcon category={mission.category} completed={mission.completed} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {mission.title}
                    </Text>
                    <Text className="font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted">
                      {mission.description}
                    </Text>
                  </View>
                </View>

                {mission.completed ? (
                  <CheckCircle2 size={20} color={colors.accentDeep} />
                ) : (
                  <Circle size={20} color={scheme === 'dark' ? colors.border : '#cbd5e1'} />
                )}
              </View>

              <View className="mt-3">
                <View className="mb-1 flex-row justify-between">
                  <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                    {statusHint}
                  </Text>
                  <Text className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-trauma-nightMuted">
                    {formatNumber(mission.currentValue, locale)} / {formatNumber(mission.targetValue, locale)}{' '}
                    {mission.unit}
                  </Text>
                </View>
                <View className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-trauma-nightAlt">
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

