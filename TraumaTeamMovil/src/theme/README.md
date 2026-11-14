# Tema claro / oscuro

Preferencia: Sistema (por defecto) / Claro / Oscuro, persistida por `SettingsProvider`. El tema efectivo
se aplica a NativeWind (`dark` class, `darkMode: 'class'`), a la barra de estado y al fondo raíz.
El modo claro es idéntico al de siempre; el oscuro es "space night".

Dos mecanismos (los CSS variables no se usan: `dark:` funciona igual en web y nativo, verificado en el export web):

## 1. Clases NativeWind → variantes `dark:`
```tsx
<View className="border border-slate-200 bg-white dark:border-trauma-nightLine dark:bg-trauma-night">
  <Text className="text-trauma-ink dark:text-trauma-nightInk">…</Text>
  <Text className="text-slate-500 dark:text-trauma-nightMuted">…</Text>
</View>
```
Colores nuevos de Tailwind (`tailwind.config.js`, `trauma.*`): `nightBg #05070f`, `night #0a0f1d` (superficie),
`nightAlt #111a2e`, `nightLine #1e293b` (borde), `nightInk #f1f5f9` (texto), `nightMuted #a3b1c6`,
`nightSubtle #8391a7`; el cian de marca (`cyan`, `cyanEdge`) se mantiene en ambos modos.
Equivalencias habituales: `bg-trauma-bg` → `dark:bg-trauma-nightBg`, `bg-white` → `dark:bg-trauma-night`,
`bg-slate-50/100` → `dark:bg-trauma-nightAlt`, `border-slate-200`/`border-trauma-line` → `dark:border-trauma-nightLine`,
`text-trauma-ink`/`text-slate-900` → `dark:text-trauma-nightInk`, `text-slate-500/600` → `dark:text-trauma-nightMuted`,
`text-slate-400` → `dark:text-trauma-nightSubtle`, `bg-red-50` → `dark:bg-red-950`, `text-red-600` → `dark:text-red-300`
(lo mismo con amber/emerald/sky). Texto ≥ 4.5:1 sobre su superficie.

## 2. Props de estilo (iconos `color`, SVG, `style`, ActivityIndicator…) → `useAppTheme()`
```tsx
import { useAppTheme } from '@/theme';
const { colors, scheme, preference, setPreference } = useAppTheme();
<Bell size={18} color={colors.danger} />
<View style={{ backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }} />
```
Claves de `Palette` (`src/theme/palette.ts`): `bg surface surfaceAlt border text textMuted textSubtle onAccent
accent accentSoft accentEdge accentDeep danger dangerSoft warning warningSoft success successSoft overlay shadow shadowOpacity`.
`scheme` es `'light' | 'dark'` ya resuelto (Sistema → SO). Para el status bar usa `scheme === 'dark' ? 'light' : 'dark'`
(el root y `TraumaScreen` ya lo hacen).

Reglas: nunca hex en componentes migrados (usa clase `dark:` o `colors.*`); superficies que ya eran oscuras
(overlay de voz, orbe) no cambian. Selector de 2-3 opciones: `@/settings/SegmentedControl`.
