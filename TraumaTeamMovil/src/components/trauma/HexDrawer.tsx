import { memo, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import { Activity, BookOpen, ChevronRight, PersonStanding, Rocket, X } from 'lucide-react-native';

import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey, VoiceLanguage } from '@/i18n/messages';
import { SegmentedControl } from '@/settings/SegmentedControl';
import { useSettings } from '@/settings/SettingsProvider';
import { useAppTheme, type ThemePreference } from '@/theme';

import { useDrawer } from './drawer-context';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Geometría y tiempos de la animación hexagonal
const R = 28;
const HEX_W = Math.sqrt(3) * R;
const ROW_STEP = 1.5 * R;
const BOX_W = HEX_W + 4;
const BOX_H = 2 * R + 4;
const OPEN_MS = 1020;
const CLOSE_MS = 550;

function hexPoints(radius: number, cx: number, cy: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

// Radio con ligero solapamiento para fusionar hexágonos en fondo blanco continuo
const TILE_POINTS = hexPoints(R + 1.6, BOX_W / 2, BOX_H / 2);

type Tile = { key: string; cx: number; cy: number; d: number };

function buildTiles(w: number, h: number, ox: number, oy: number): Tile[] {
  const tiles: Tile[] = [];
  const rows = Math.ceil(h / ROW_STEP) + 1;
  const cols = Math.ceil(w / HEX_W) + 1;
  const maxD = Math.hypot(w, h);
  for (let r = 0; r <= rows; r++) {
    const offset = r % 2 ? HEX_W / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const cx = c * HEX_W + offset;
      const cy = r * ROW_STEP;
      if (cx - HEX_W / 2 > w || cx + HEX_W / 2 < 0) continue;
      tiles.push({
        key: `${r}-${c}`,
        cx,
        cy,
        d: Math.min(1, Math.hypot(cx - ox, cy - oy) / maxD),
      });
    }
  }
  return tiles;
}

// Celda hexagonal animada para la transición de apertura/cierre
const HexTile = memo(function HexTile({
  tile,
  progress,
  fill,
}: {
  tile: Tile;
  progress: Animated.Value;
  fill: string;
}) {
  const start = tile.d * 0.52;
  const end = start + 0.48;
  const scale = progress.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' });
  const opacity = progress.interpolate({
    inputRange: [start, start + 0.1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rotate = progress.interpolate({
    inputRange: [start, end],
    outputRange: ['-60deg', '0deg'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: tile.cx - BOX_W / 2,
        top: tile.cy - BOX_H / 2,
        width: BOX_W,
        height: BOX_H,
        opacity,
        transform: [{ scale }, { rotate }],
      }}>
      <Svg width={BOX_W} height={BOX_H}>
        <Polygon
          points={TILE_POINTS}
          fill={fill}
          stroke={fill}
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
});

const NAV_ITEMS: {
  path: string;
  label: MessageKey;
  subtitle: MessageKey;
  href: Href;
  Icon: typeof Activity;
}[] = [
  { path: '/', label: 'route./', subtitle: 'nav.vitals.subtitle', href: '/', Icon: Activity },
  { path: '/explore', label: 'route./explore', subtitle: 'nav.body.subtitle', href: '/explore', Icon: PersonStanding },
  { path: '/missions', label: 'route./missions', subtitle: 'nav.missions.subtitle', href: '/missions', Icon: Rocket },
  { path: '/assistant', label: 'nav.assistant', subtitle: 'nav.assistant.subtitle', href: '/assistant', Icon: BookOpen },
];

export function HexDrawer() {
  const { isOpen, close } = useDrawer();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { t } = useI18n();
  const { voiceLanguage, setVoiceLanguage } = useSettings();
  const { colors, preference, setPreference } = useAppTheme();

  const drawerW = Math.min(width * 0.82, 330);
  const [mounted, setMounted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [content] = useState(() => new Animated.Value(0));

  // Origen de la onda: botón ☰ en la esquina superior izquierda
  const tiles = useMemo(
    () => buildTiles(drawerW, height, 40, insets.top + 28),
    [drawerW, height, insets.top]
  );

  const shouldRender = isOpen || mounted;

  useEffect(() => {
    if (!shouldRender) return;
    progress.stopAnimation();
    content.stopAnimation();
    if (isOpen) {
      const frameId = requestAnimationFrame(() => setMounted(true));
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(content, {
          toValue: 1,
          duration: 280,
          delay: OPEN_MS * 0.55,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
      return () => cancelAnimationFrame(frameId);
    } else {
      Animated.sequence([
        Animated.timing(content, { toValue: 0, duration: 130, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(progress, {
          toValue: 0,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
  }, [shouldRender, isOpen, progress, content]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  if (!shouldRender) return null;

  // Capa blanca continua que asegura 100% blanco sólido y nítido una vez desplegado
  const solidWhiteOpacity = progress.interpolate({
    inputRange: [0.85, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Fondo semitransparente: tocar fuera cierra el drawer */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.overlay, opacity: progress },
        ]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel={t('nav.closeMenu')} />
      </Animated.View>

      {/* Contenedor del panel lateral blanco */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: drawerW,
          overflow: 'hidden',
          borderRightWidth: 1,
          borderRightColor: colors.border,
          shadowColor: colors.shadow,
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: 18,
          elevation: 16,
        }}>
        {/* Onda de hexágonos blancos que arman el drawer desde el botón ☰ */}
        {tiles.map((tile) => (
          <HexTile key={tile.key} tile={tile} progress={progress} fill={colors.surface} />
        ))}

        {/* Fondo blanco puro que garantiza un acabado inmaculado sin cuadrículas */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.surface,
              opacity: solidWhiteOpacity,
            },
          ]}
        />

        {/* Contenido del menú (diseño blanco limpio y minimalista) */}
        <Animated.View
          style={{
            flex: 1,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 20,
            opacity: content,
            transform: [
              {
                translateX: content.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          }}>
          {/* Cabecera del Drawer */}
          <View className="mb-6 flex-row items-center justify-between">
            <View>
              <Text className="font-mono text-xl text-slate-900 dark:text-trauma-nightInk">
                <Text className="font-extrabold text-sky-500">Trauma</Text>Team
              </Text>
            </View>
            <Pressable
              onPress={close}
              accessibilityLabel={t('nav.closeMenu')}
              className="h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 active:bg-slate-100 dark:border-trauma-nightLine dark:bg-trauma-nightAlt dark:active:bg-trauma-nightLine">
              <X size={17} color={colors.text} />
            </Pressable>
          </View>

          {/* Sección de Navegación */}
          <Text className="mb-2 font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
            {t('nav.section')}
          </Text>

          {NAV_ITEMS.map(({ path, label, subtitle, href, Icon }) => {
            const active = pathname === path;
            return (
              <Pressable
                key={path}
                onPress={() => {
                  close();
                  router.navigate(href);
                }}
                className={`mb-2.5 flex-row items-center rounded-2xl border p-3 active:opacity-75 ${active
                  ? 'border-sky-300 bg-sky-50/70 dark:border-trauma-cyanEdge/50 dark:bg-trauma-nightAlt'
                  : 'border-slate-100 bg-white dark:border-trauma-nightLine dark:bg-trauma-night'
                  }`}>
                <View
                  className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-sky-500' : 'bg-slate-100 dark:bg-trauma-nightAlt'
                    }`}>
                  <Icon size={18} color={active ? '#ffffff' : colors.textMuted} />
                </View>

                <View className="flex-1">
                  <Text
                    className={`font-mono text-xs font-bold ${active ? 'text-sky-900 dark:text-trauma-cyanEdge' : 'text-slate-800 dark:text-trauma-nightInk'
                      }`}>
                    {t(label)}
                  </Text>
                  <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                    {t(subtitle)}
                  </Text>
                </View>

                <ChevronRight size={16} color={active ? colors.accentDeep : colors.textSubtle} />
              </Pressable>
            );
          })}

          {/* Ajustes: idioma de entrada de voz y tema */}
          <Text className="mb-2 mt-4 font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
            {t('settings.title')}
          </Text>
          <Text className="mb-1.5 font-mono text-[10.5px] font-bold text-slate-600 dark:text-trauma-nightMuted">
            {t('settings.voiceLanguage')}
          </Text>
          <SegmentedControl<VoiceLanguage>
            accessibilityLabel={t('settings.voiceLanguage')}
            value={voiceLanguage}
            onChange={setVoiceLanguage}
            options={[
              { value: 'en', label: t('settings.lang.en') },
              { value: 'es', label: t('settings.lang.es') },
            ]}
          />
          <Text className="mb-1.5 mt-3 font-mono text-[10.5px] font-bold text-slate-600 dark:text-trauma-nightMuted">
            {t('settings.theme')}
          </Text>
          <SegmentedControl<ThemePreference>
            accessibilityLabel={t('settings.theme')}
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: t('settings.theme.system') },
              { value: 'light', label: t('settings.theme.light') },
              { value: 'dark', label: t('settings.theme.dark') },
            ]}
          />
        </Animated.View>
      </View>
    </View>
  );
}
