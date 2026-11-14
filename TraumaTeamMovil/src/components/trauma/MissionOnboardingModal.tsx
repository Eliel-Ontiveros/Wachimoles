import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClockPlus,
  Flag,
  Globe,
  Orbit,
  Rocket,
  Satellite,
  Sparkles,
  X,
} from 'lucide-react-native';
import {
  addDaysToIsoDate,
  calculateMissionStateFromDeparture,
  extendMissionArrivalIso,
  formatRouteDays,
  getDateDaysAgoIso,
  getDelayPresetDays,
  getRouteDurationSpec,
  getRouteTotalDays,
  getTodayIsoDate,
  SPACE_LOCATIONS,
} from '../../services/mission-api';
import { SpaceLocation } from '../../types/mission';
import { SpaceJourneyTimeline } from './SpaceJourneyTimeline';
import { useMission } from './mission-context';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const WEEKDAYS_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function LocationIcon({ loc, color }: { loc: SpaceLocation; color: string }) {
  if (loc === 'estacion') return <Satellite size={14} color={color} />;
  if (loc === 'luna') return <Orbit size={14} color={color} />;
  return <Globe size={14} color={color} />;
}

function toIsoDate(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatReadableIso(iso: string): string {
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return iso;
  return `${parts[2]} ${MONTHS_FULL[parts[1] - 1]?.slice(0, 3) ?? ''} ${parts[0]}`;
}

// Calendario mensual claro con soporte de fecha mínima y marcador de salida
function SpaceDateCalendar({
  selectedIso,
  onSelectIso,
  minExclusiveIso,
  markerIso,
}: {
  selectedIso: string;
  onSelectIso: (iso: string) => void;
  minExclusiveIso?: string;
  markerIso?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => getTodayIsoDate(), []);

  const parsedSelected = useMemo(() => {
    const parts = selectedIso.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return { year: parts[0], month: parts[1] - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [selectedIso, today]);

  const [browsedMonth, setBrowsedMonth] = useState<{
    forIso: string;
    year: number;
    month: number;
  } | null>(null);

  const viewYear =
    browsedMonth && browsedMonth.forIso === selectedIso
      ? browsedMonth.year
      : parsedSelected.year;
  const viewMonth =
    browsedMonth && browsedMonth.forIso === selectedIso
      ? browsedMonth.month
      : parsedSelected.month;

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setBrowsedMonth({
      forIso: selectedIso,
      year: next.getFullYear(),
      month: next.getMonth(),
    });
  };

  return (
    <View className="rounded-2xl border border-slate-200 bg-[#f7f7f7] p-3">
      {/* Navegación de mes y año */}
      <View className="mb-2.5 flex-row items-center justify-between">
        <Pressable
          onPress={() => shiftMonth(-1)}
          className="h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white active:opacity-75">
          <ChevronLeft size={15} color="#475569" />
        </Pressable>

        <View className="flex-row items-center">
          <Calendar size={12} color="#0284c7" />
          <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800">
            {MONTHS_FULL[viewMonth]} {viewYear}
          </Text>
        </View>

        <Pressable
          onPress={() => shiftMonth(1)}
          className="h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white active:opacity-75">
          <ChevronRight size={15} color="#475569" />
        </Pressable>
      </View>

      {/* Cabecera de días */}
      <View className="mb-1 flex-row">
        {WEEKDAYS_ES.map((w, idx) => (
          <View key={idx} style={{ width: '14.28%' }} className="items-center py-0.5">
            <Text className="font-mono text-[9px] font-bold text-slate-400">{w}</Text>
          </View>
        ))}
      </View>

      {/* Cuadrícula de días */}
      <View className="flex-row flex-wrap">
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={{ width: '14.28%', height: 28 }} />;
          }

          const iso = toIsoDate(viewYear, viewMonth, day);
          const isToday = iso === todayIso;
          const isSelected = iso === selectedIso;
          const isMarker = Boolean(markerIso && iso === markerIso && !isSelected);
          const isDisabled = Boolean(minExclusiveIso && iso <= minExclusiveIso);

          return (
            <Pressable
              key={iso}
              disabled={isDisabled}
              onPress={() => onSelectIso(iso)}
              style={{
                width: '14.28%',
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: isSelected
                    ? '#0284c7'
                    : isMarker
                      ? '#e0f2fe'
                      : 'transparent',
                  borderWidth: (isToday || isMarker) && !isSelected ? 1 : 0,
                  borderColor: isMarker ? '#0284c7' : '#7dd3fc',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  className={`font-mono text-[10.5px] font-bold ${
                    isSelected
                      ? 'text-white'
                      : isDisabled
                        ? 'text-slate-300'
                        : isMarker
                          ? 'text-sky-700'
                          : 'text-slate-700'
                  }`}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const LOCATION_OPTIONS: SpaceLocation[] = ['tierra', 'estacion', 'luna', 'marte'];

// Modal de Plan de Vuelo blanco (manteniendo la tarjeta de trayectoria espacial oscura)
export function MissionOnboardingModal() {
  const {
    missionSetupOpen,
    closeMissionSetup,
    origin,
    destination,
    departureDate,
    arrivalDate,
    configureMission,
  } = useMission();

  if (!missionSetupOpen) return null;

  return (
    <MissionOnboardingModalContent
      origin={origin}
      destination={destination}
      departureDate={departureDate}
      arrivalDate={arrivalDate}
      closeMissionSetup={closeMissionSetup}
      configureMission={configureMission}
    />
  );
}

function MissionOnboardingModalContent({
  origin,
  destination,
  departureDate,
  arrivalDate,
  closeMissionSetup,
  configureMission,
}: {
  origin: SpaceLocation;
  destination: SpaceLocation;
  departureDate: string;
  arrivalDate: string | null;
  closeMissionSetup: () => void;
  configureMission: (setup: {
    origin: SpaceLocation;
    destination: SpaceLocation;
    departureDate: string;
    arrivalDate?: string | null;
  }) => void;
}) {
  const locationOptions = LOCATION_OPTIONS;
  const [selectedOrigin, setSelectedOrigin] = useState<SpaceLocation>(origin);
  const [selectedDest, setSelectedDest] = useState<SpaceLocation>(
    destination !== origin
      ? destination
      : LOCATION_OPTIONS.find((loc) => loc !== origin) ?? 'luna'
  );
  const [selectedDate, setSelectedDate] = useState<string>(departureDate || getTodayIsoDate());
  const [selectedArrivalDate, setSelectedArrivalDate] = useState<string | null>(arrivalDate);
  const [dateStep, setDateStep] = useState<'departure' | 'arrival'>('departure');
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [delayExpanded, setDelayExpanded] = useState<boolean>(false);

  const [calendarAnim] = useState(() => new Animated.Value(0));
  const [chevronAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(calendarAnim, {
        toValue: calendarOpen ? 1 : 0,
        duration: 280,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(chevronAnim, {
        toValue: calendarOpen ? 1 : 0,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [calendarOpen, calendarAnim, chevronAnim]);

  const preview = useMemo(
    () =>
      calculateMissionStateFromDeparture(
        selectedOrigin,
        selectedDest,
        selectedDate,
        selectedArrivalDate
      ),
    [selectedOrigin, selectedDest, selectedDate, selectedArrivalDate]
  );

  const isSameRoute = selectedOrigin === selectedDest;
  const routeSpec = useMemo(
    () => getRouteDurationSpec(selectedOrigin, selectedDest),
    [selectedOrigin, selectedDest]
  );
  const defaultRouteDays = getRouteTotalDays(selectedOrigin, selectedDest);
  const estimatedArrivalIso = addDaysToIsoDate(selectedDate, defaultRouteDays);
  const delayPresets = useMemo(
    () => getDelayPresetDays(preview.totalDays),
    [preview.totalDays]
  );

  const handleAddDelayDays = (extraDays: number) => {
    if (isSameRoute || extraDays <= 0) return;
    const nextArrival = extendMissionArrivalIso(
      selectedDate,
      preview.effectiveArrivalDate,
      extraDays
    );
    setSelectedArrivalDate(nextArrival);
    setDelayExpanded(false);
  };

  const calendarMaxHeight = calendarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 360],
  });
  const calendarOpacity = calendarAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.4, 1],
  });
  const calendarMarginTop = calendarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });
  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const handleSelectOrigin = (nextOrigin: SpaceLocation) => {
    if (nextOrigin === selectedDest) {
      const fallbackDest =
        selectedOrigin !== nextOrigin
          ? selectedOrigin
          : locationOptions.find((loc) => loc !== nextOrigin) ?? 'luna';
      setSelectedDest(fallbackDest);
    }
    setSelectedOrigin(nextOrigin);
  };

  const handleSelectDest = (nextDest: SpaceLocation) => {
    if (nextDest === selectedOrigin) return;
    setSelectedDest(nextDest);
  };

  const handlePickDate = (iso: string) => {
    if (dateStep === 'departure') {
      setSelectedDate(iso);
      if (selectedArrivalDate && selectedArrivalDate <= iso) {
        setSelectedArrivalDate(null);
      }
      setDateStep('arrival');
      return;
    }

    if (iso > selectedDate) {
      setSelectedArrivalDate(iso);
    }
  };

  const handleStepPress = (step: 'departure' | 'arrival') => {
    if (dateStep === step) {
      setCalendarOpen((v) => !v);
    } else {
      setDateStep(step);
      setCalendarOpen(true);
    }
  };

  const handleConfirm = () => {
    if (isSameRoute) return;
    configureMission({
      origin: selectedOrigin,
      destination: selectedDest,
      departureDate: selectedDate,
      arrivalDate: selectedArrivalDate,
    });
  };

  const handleArriveEarly = () => {
    if (isSameRoute) return;
    configureMission({
      origin: selectedOrigin,
      destination: selectedDest,
      departureDate: getDateDaysAgoIso(defaultRouteDays),
      arrivalDate: null,
    });
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={closeMissionSetup}>
      <Pressable
        onPress={closeMissionSetup}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          justifyContent: 'center',
          paddingHorizontal: 16,
        }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ maxHeight: '88%' }}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          {/* Cabecera */}
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft">
                <Rocket size={16} color="#0284c7" />
              </View>
              <Text className="font-mono text-sm font-extrabold text-trauma-ink">
                Plan de vuelo
              </Text>
            </View>
            <Pressable
              onPress={closeMissionSetup}
              className="h-7 w-7 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
              <X size={15} color="#475569" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Tarjeta de trayectoria espacial (mantiene fondo espacial) */}
            <View className="mb-3">
              <SpaceJourneyTimeline
                compact
                previewDay={preview.missionDay}
                previewOrigin={selectedOrigin}
                previewDestination={selectedDest}
                previewEnvironment={preview.calculatedEnvironment}
                previewDaysUntilDeparture={preview.daysUntilDeparture}
                previewTotalDays={preview.totalDays}
              />
            </View>

            {routeSpec && (
              <View className="mb-3.5 rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-mono text-[9.5px] font-bold text-slate-700">
                    Trayecto: {formatRouteDays(routeSpec.minDias)}–{formatRouteDays(routeSpec.maxDias)} días
                  </Text>
                  <Text className="font-mono text-[9.5px] font-extrabold text-sky-700">
                    Promedio: {formatRouteDays(routeSpec.promedioDias)}{' '}
                    {routeSpec.promedioDias === 1 ? 'día' : 'días'}
                  </Text>
                </View>
                {(routeSpec.ventanaLanzamientoMeses !== undefined ||
                  (routeSpec.esperaRetornoDiasMin !== undefined &&
                    routeSpec.esperaRetornoDiasMax !== undefined)) && (
                  <View className="mt-1 flex-row flex-wrap gap-1.5">
                    {routeSpec.ventanaLanzamientoMeses !== undefined && (
                      <View className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5">
                        <Text className="font-mono text-[8.5px] font-bold text-amber-800">
                          Ventana de lanzamiento: c/{routeSpec.ventanaLanzamientoMeses} meses
                        </Text>
                      </View>
                    )}
                    {routeSpec.esperaRetornoDiasMin !== undefined &&
                      routeSpec.esperaRetornoDiasMax !== undefined && (
                        <View className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5">
                          <Text className="font-mono text-[8.5px] font-bold text-orange-800">
                            Espera retorno en Marte: {routeSpec.esperaRetornoDiasMin}–
                            {routeSpec.esperaRetornoDiasMax} días
                          </Text>
                        </View>
                      )}
                  </View>
                )}
              </View>
            )}

            {/* 1. Punto de salida */}
            <Text className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Salida desde
            </Text>
            <View className="mb-3 flex-row gap-1.5">
              {locationOptions.map((locId) => {
                const opt = SPACE_LOCATIONS[locId];
                const active = selectedOrigin === locId;
                return (
                  <Pressable
                    key={locId}
                    onPress={() => handleSelectOrigin(locId)}
                    className={`flex-1 items-center rounded-xl border px-1 py-2 ${
                      active
                        ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                        : 'border-slate-200 bg-[#f7f7f7]'
                    }`}>
                    <LocationIcon loc={locId} color={active ? '#0284c7' : '#64748b'} />
                    <Text
                      numberOfLines={1}
                      className={`mt-1 font-mono text-[10px] font-bold ${
                        active ? 'text-trauma-ink' : 'text-slate-600'
                      }`}>
                      {opt.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 2. Destino (bloquea el mismo punto de salida) */}
            <Text className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Destino
            </Text>
            <View className="mb-3.5 flex-row gap-1.5">
              {locationOptions.map((locId) => {
                const opt = SPACE_LOCATIONS[locId];
                const isSameAsOrigin = locId === selectedOrigin;
                const active = selectedDest === locId && !isSameAsOrigin;
                return (
                  <Pressable
                    key={locId}
                    disabled={isSameAsOrigin}
                    onPress={() => handleSelectDest(locId)}
                    style={isSameAsOrigin ? { opacity: 0.35 } : undefined}
                    className={`flex-1 items-center rounded-xl border px-1 py-2 ${
                      active
                        ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                        : 'border-slate-200 bg-[#f7f7f7]'
                    }`}>
                    <LocationIcon
                      loc={locId}
                      color={active ? '#0284c7' : isSameAsOrigin ? '#94a3b8' : '#64748b'}
                    />
                    <Text
                      numberOfLines={1}
                      className={`mt-1 font-mono text-[10px] font-bold ${
                        active
                          ? 'text-trauma-ink'
                          : isSameAsOrigin
                            ? 'text-slate-400'
                            : 'text-slate-600'
                      }`}>
                      {opt.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3. Fechas secuenciales: Salida -> Llegada */}
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fechas de misión
              </Text>
              <Pressable
                onPress={() => setCalendarOpen((v) => !v)}
                className="flex-row items-center rounded-lg border border-slate-200 bg-[#f7f7f7] px-2 py-0.5 active:opacity-75">
                <Calendar size={11} color="#0284c7" />
                <Text className="mx-1 font-mono text-[9.5px] font-bold text-slate-600">
                  {calendarOpen ? 'Ocultar' : 'Calendario'}
                </Text>
                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                  <ChevronDown size={12} color="#475569" />
                </Animated.View>
              </Pressable>
            </View>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleStepPress('departure')}
                className={`flex-1 rounded-xl border px-3 py-2 active:opacity-80 ${
                  calendarOpen && dateStep === 'departure'
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                  1. Salida
                </Text>
                <Text className="mt-0.5 font-mono text-[11px] font-extrabold text-trauma-ink" numberOfLines={1}>
                  {formatReadableIso(selectedDate)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleStepPress('arrival')}
                className={`flex-1 rounded-xl border px-3 py-2 active:opacity-80 ${
                  calendarOpen && dateStep === 'arrival'
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                  2. Llegada {selectedArrivalDate ? '' : '(Est.)'}
                </Text>
                <Text className="mt-0.5 font-mono text-[11px] font-extrabold text-trauma-ink" numberOfLines={1}>
                  {formatReadableIso(preview.effectiveArrivalDate)}
                </Text>
              </Pressable>
            </View>

            {/* Control para añadir tiempo si la misión se atrasa */}
            <View className="mt-2 rounded-xl border border-amber-200 bg-amber-50/75 px-3 py-2">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center">
                  <ClockPlus size={13} color="#b45309" />
                  <Text className="ml-1.5 font-mono text-[10px] font-bold text-amber-900">
                    ¿Se atrasó la misión?
                  </Text>
                </View>
                <Pressable
                  disabled={isSameRoute}
                  onPress={() => setDelayExpanded((open) => !open)}
                  style={isSameRoute ? { opacity: 0.45 } : undefined}
                  accessibilityLabel="Añadir tiempo a la misión"
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 active:opacity-75">
                  <Text className="font-mono text-[10px] font-extrabold text-amber-800">
                    {delayExpanded ? 'Cerrar' : '+ Añadir tiempo'}
                  </Text>
                </Pressable>
              </View>

              {delayExpanded && (
                <View className="mt-2 flex-row gap-1.5">
                  {delayPresets.map((extra) => (
                    <Pressable
                      key={extra}
                      onPress={() => handleAddDelayDays(extra)}
                      className="flex-1 items-center rounded-lg border border-amber-300 bg-white py-1.5 active:opacity-75">
                      <Text className="font-mono text-[10px] font-extrabold text-amber-900">
                        +{extra}d
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Contenedor animado del calendario al expandir o colapsar */}
            <Animated.View
              style={{
                maxHeight: calendarMaxHeight,
                opacity: calendarOpacity,
                marginTop: calendarMarginTop,
                overflow: 'hidden',
              }}>
              <View className="mb-2 flex-row items-center justify-between px-0.5">
                <Text className="font-mono text-[10px] font-bold text-slate-600">
                  {dateStep === 'departure'
                    ? 'Paso 1 · Selecciona fecha de salida'
                    : 'Paso 2 · Selecciona llegada o déjala estimada'}
                </Text>
                {dateStep === 'departure' && (
                  <Pressable onPress={() => setDateStep('arrival')}>
                    <Text className="font-mono text-[10px] font-bold text-sky-600">
                      Siguiente →
                    </Text>
                  </Pressable>
                )}
              </View>

              {dateStep === 'arrival' && (
                <Pressable
                  onPress={() => setSelectedArrivalDate(null)}
                  className={`mb-2 flex-row items-center justify-between rounded-xl border px-3 py-2 active:opacity-80 ${
                    selectedArrivalDate === null
                      ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                      : 'border-slate-200 bg-[#f7f7f7]'
                  }`}>
                  <View className="flex-1 flex-row items-center pr-2">
                    <Sparkles size={13} color="#0284c7" />
                    <Text className="ml-1.5 font-mono text-[10px] font-bold text-slate-700" numberOfLines={1}>
                      Estimar ({formatReadableIso(estimatedArrivalIso)} · {formatRouteDays(defaultRouteDays)}d)
                    </Text>
                  </View>
                  <Text className="font-mono text-[9px] font-bold text-sky-700">
                    {selectedArrivalDate === null ? 'Activa' : 'Usar'}
                  </Text>
                </Pressable>
              )}

              <SpaceDateCalendar
                selectedIso={
                  dateStep === 'departure'
                    ? selectedDate
                    : selectedArrivalDate ?? preview.effectiveArrivalDate
                }
                onSelectIso={handlePickDate}
                minExclusiveIso={dateStep === 'arrival' ? selectedDate : undefined}
                markerIso={dateStep === 'arrival' ? selectedDate : undefined}
              />
            </Animated.View>
          </ScrollView>

          <View className="mt-3 flex-row gap-2">
            {!preview.arrived && (
              <Pressable
                disabled={isSameRoute}
                onPress={handleArriveEarly}
                style={isSameRoute ? { opacity: 0.45 } : undefined}
                className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-[#f7f7f7] px-3.5 py-3 active:opacity-80">
                <Flag size={13} color="#0284c7" />
                <Text className="ml-1.5 font-mono text-[11px] font-bold text-slate-700">
                  Llegué antes
                </Text>
              </Pressable>
            )}

            <Pressable
              disabled={isSameRoute}
              onPress={handleConfirm}
              style={isSameRoute ? { opacity: 0.45 } : undefined}
              className="flex-1 items-center justify-center rounded-2xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3 active:opacity-85">
              <Text className="font-mono text-xs font-extrabold text-trauma-ink">
                Guardar plan de vuelo
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
