import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Check, CheckCircle2, Circle, Dumbbell, Flame, Footprints, Rocket, Sparkles } from 'lucide-react-native';
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

/** Shared Home-style cyan progress track for mission KPIs and cards. */
function MissionProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-trauma-nightLine">
      <View
        className="h-full rounded-full bg-trauma-cyan"
        style={{ width: `${clamped}%` }}
      />
    </View>
  );
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
  const envText = getEnvironmentText(locale, environmentConfig.id);
  const gravityShort = envText.gravityLabel.split(' ')[0] ?? envText.gravityLabel;
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
  const completionPct =
    missions.length > 0 ? Math.round((completedCount / missions.length) * 100) : 0;
  const activeWeekFlags = weekDays.map(
    (_, idx) => idx < Math.min(6, streakDays) || (idx === 6 && checkedInToday)
  );
  const activeWeekCount = activeWeekFlags.filter(Boolean).length;
  const weeklyPct =
    weekDays.length > 0 ? Math.round((activeWeekCount / weekDays.length) * 100) : 0;

  return (
    <View className="px-5 pb-10 pt-6">
      <StreakCheckinHost />

      {/* Cabecera superior alineada con Inicio */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-mono text-xl font-bold text-trauma-ink dark:text-trauma-nightInk">
          {t('route./missions')}
        </Text>
        <View className="flex-row items-center rounded-full border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night px-2.5 py-1 shadow-xs">
          <Rocket size={12} color={colors.accentDeep} />
          <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
            {envText.shortLabel} · {gravityShort}
          </Text>
        </View>
      </View>

      {/* Tarjeta Hero de Racha y Check-in con el lenguaje visual de Inicio */}
      <View className="mb-5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-md">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-end">
              <View style={{ marginRight: 8, marginBottom: 6 }}>
                <Flame size={20} color="#f97316" fill="#fb923c" />
              </View>
              <Text className="font-mono text-4xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
                {streakDays}
              </Text>
              <Text className="mb-1 ml-1.5 font-mono text-xs font-bold text-trauma-muted dark:text-trauma-nightMuted">
                {t(streakDays === 1 ? 'missions.unit.day' : 'missions.unit.days')}
              </Text>
            </View>
            <Text className="mt-0.5 font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
              {t('missions.streak.title')}
            </Text>
          </View>

          <View className="items-end">
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
                className={`flex-row items-center rounded-xl border px-3 py-2 shadow-xs ${
                  checkedInToday
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
                    : 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-cyan-950 active:opacity-75'
                }`}>
                <Check
                  size={13}
                  color={checkedInToday ? colors.success : scheme === 'dark' ? colors.text : '#0f172a'}
                  strokeWidth={2.5}
                />
                <Text
                  className={`ml-1.5 font-mono text-[10.5px] font-bold ${
                    checkedInToday
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-trauma-ink dark:text-trauma-nightInk'
                  }`}>
                  {checkedInToday ? t('missions.checkin.done') : t('missions.checkin.today')}
                </Text>
              </Pressable>
            </View>
            <Text className="mt-1.5 font-mono text-[8.5px] text-slate-400 dark:text-trauma-nightSubtle">
              {envText.gravityLabel}
            </Text>
          </View>
        </View>

        {/* Indicador semanal */}
        <View className="mt-4 flex-row justify-between border-t border-slate-100 dark:border-trauma-nightLine pt-3.5">
          {weekDays.map((day, idx) => {
            const active = activeWeekFlags[idx];
            return (
              <View key={idx} className="items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border ${
                    active
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'
                      : 'border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                  }`}>
                  {active ? (
                    <Flame size={12} color="#f97316" fill="#fb923c" />
                  ) : (
                    <View className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-trauma-nightSubtle" />
                  )}
                </View>
                <Text className="mt-1 font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                  {day}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Fila de 2 métricas resumidas idéntica a las tarjetas SpO2 / Stress de Inicio */}
      <View className="mb-5 flex-row gap-4">
        <View className="flex-1 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-md">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-xs text-trauma-ink dark:text-trauma-nightInk">
              {t('missions.kpi.completed')}
            </Text>
            <Text className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-300">
              {completionPct}%
            </Text>
          </View>
          <View className="my-2 flex-row items-baseline">
            <Text className="font-mono text-3xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
              {completedCount}/{missions.length}
            </Text>
          </View>
          <MissionProgressBar percent={completionPct} />
        </View>

        <View className="flex-1 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-md">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-xs text-trauma-ink dark:text-trauma-nightInk">
              {t('missions.kpi.weekly')}
            </Text>
            <Text className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-300">
              {weeklyPct}%
            </Text>
          </View>
          <View className="my-2 flex-row items-baseline">
            <Text className="font-mono text-3xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
              {activeWeekCount}/{weekDays.length}
            </Text>
          </View>
          <MissionProgressBar percent={weeklyPct} />
        </View>
      </View>

      {/* Misiones diarias adaptadas al entorno */}
      <View className="mb-3">
        <Text className="font-mono text-sm font-bold text-trauma-ink dark:text-trauma-nightInk">
          {t('missions.daily.title')}
        </Text>
        <Text className="mt-0.5 font-mono text-[9.5px] leading-[14px] text-slate-400 dark:text-trauma-nightSubtle">
          {envText.routineSummary}
        </Text>
      </View>

      <View className="gap-4">
        {missions.map((mission) => {
          const rawPct =
            mission.targetValue > 0
              ? Math.min(100, Math.max(0, Math.round((mission.currentValue / mission.targetValue) * 100)))
              : 0;
          const visualPct = mission.completed ? 100 : rawPct;
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
              className={`rounded-2xl border bg-white p-4 shadow-md active:opacity-85 dark:bg-trauma-night ${
                mission.completed
                  ? 'border-trauma-cyanEdge dark:border-sky-700'
                  : 'border-trauma-line dark:border-trauma-nightLine'
              }`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center pr-3">
                  <View
                    className={`mr-3 h-10 w-10 items-center justify-center rounded-xl border ${
                      mission.completed
                        ? 'border-trauma-cyanEdge/70 bg-trauma-cyanSoft/50 dark:border-sky-800 dark:bg-cyan-950/60'
                        : 'border-slate-200 bg-[#f7f7f7] dark:border-trauma-nightLine dark:bg-trauma-nightAlt'
                    }`}>
                    <MissionIcon category={mission.category} completed={mission.completed} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
                      {mission.title}
                    </Text>
                    <Text className="mt-0.5 font-mono text-[9.5px] leading-[14px] text-slate-500 dark:text-trauma-nightMuted">
                      {mission.description}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-1.5">
                  <Text
                    className={`font-mono text-[10px] font-bold ${
                      mission.completed
                        ? 'text-sky-600 dark:text-sky-300'
                        : 'text-slate-400 dark:text-trauma-nightSubtle'
                    }`}>
                    {visualPct}%
                  </Text>
                  {mission.completed ? (
                    <CheckCircle2 size={16} color={colors.accentDeep} />
                  ) : (
                    <Circle size={15} color={colors.textSubtle} />
                  )}
                </View>
              </View>

              <MissionProgressBar percent={visualPct} />

              <View className="mt-2.5 flex-row items-center justify-between border-t border-slate-100 pt-2.5 dark:border-trauma-nightLine">
                <Text
                  numberOfLines={1}
                  className="mr-2 flex-1 font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                  {statusHint}
                </Text>
                <Text
                  className={`font-mono text-[10px] font-bold ${
                    mission.completed
                      ? 'text-sky-600 dark:text-sky-300'
                      : 'text-slate-600 dark:text-trauma-nightMuted'
                  }`}>
                  {formatNumber(mission.currentValue, locale)} / {formatNumber(mission.targetValue, locale)}{' '}
                  {mission.unit}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

