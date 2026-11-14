# App-wide i18n (es/en) + light/dark mode
Branch feat/i18n-theme (from main 698493a). App: TraumaTeamMovil (Expo SDK 58, NativeWind 4.2.7 with darkMode 'class' and `--css-interop-darkMode: class dark` in global.css). Existing base: src/i18n (messages.ts es/en with identical keys + translate, I18nProvider/useI18n, SPEECH per locale) currently used only by src/voice.

## Specs
- S1 User (verbatim): "implementa i18n y modo claro y oscuro"
- S2 Every user-visible string in the app (screens, components, modals, alerts, accessibility labels, data labels such as mission titles/environment names/symptoms/muscle names shown to the user, date/number formatting) comes from i18n in Spanish (default) and English. Stored/sent data values (ids, enum values, values sent to the backend) do not change.
- S3 Theme preference: Sistema / Claro / Oscuro (default Sistema, follows the OS). Applied app-wide on web and native, including the status bar.
- S4 Dark palette keeps the brand: dark "space night" surfaces (#0a0f1d / #05070f family), cyan accents (#58d5f7 / #7dd3fc), readable contrast (text ≥ 4.5:1 on its surface), status colors (red/amber/emerald) remain distinguishable. Light mode looks exactly as today.
- S5 Settings UI: a "Ajustes / Settings" section in the side drawer (HexDrawer) with a language selector (Español / English) and the theme selector (Sistema / Claro / Oscuro). Changes apply instantly.
- S6 Preferences persist across restarts (AsyncStorage via `npx expo install @react-native-async-storage/async-storage`).
- S7 Voice follows the selected language (STT, TTS, LLM reply — already wired through useI18n) and voice commands can change settings: "cambia a modo oscuro|claro|del sistema", "cambia el idioma a inglés|español" / "switch to dark mode", "change language to Spanish" (local parser intents `set-theme` {theme:'system'|'light'|'dark'} and `set-locale` {locale:'es'|'en'}; backend catalog/whitelist gets them too).
- S8 Dictionaries are split per area to avoid one huge file: `src/i18n/locales/<locale>/<area>.ts`, merged into MESSAGES; the existing test that every locale has every key keeps passing.

## Tasks
- T1 S3-S8 infrastructure: SettingsProvider (locale + theme, persisted), theme tokens (`useAppTheme()` palette for style-prop colors + NativeWind `dark:` for classes), status bar, drawer settings UI, split dictionaries, voice set-theme/set-locale (app + backend) — worker — done
- T2 S2,S4 migrate group A: VitalMonitorView, TraumaHeader, CriticalAlertToaster, HexDrawer (remaining strings), StartupSplashAnimation, streak/* — worker — done
- T3 S2,S4 migrate group B: BodyView, BodyModelViewer, RegisterObservationModal, InjuryTimelapseModal, HealthQuestionnaireSection — worker — done
- T4 S2,S4 migrate group C: MissionsView, SpaceJourneyTimeline, EnvironmentSelector, MissionOnboardingModal, MissionProvider/mission-api user-facing texts, types/mission labels, voice UI dark adjustments — worker — done

## Log
- L1 "implementa i18n y modo claro y oscuro"
