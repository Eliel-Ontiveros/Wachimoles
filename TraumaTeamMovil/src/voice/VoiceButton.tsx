import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Mic, X } from 'lucide-react-native';

import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme';
import { useVoice } from './voice-context';
import { VoiceOrb } from './VoiceOrb';

const ORB_BIG = 120;
const ORB_SMALL = 42;

/** Botón flotante (esfera) + overlay espacial estilo Siri con transcripción arriba de la esfera. */
export function VoiceFab() {
  const v = useVoice();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');
  const [exiting, setExiting] = useState(false);
  const [prevPanelOpen, setPrevPanelOpen] = useState(v.panelOpen);
  if (prevPanelOpen !== v.panelOpen) {
    setPrevPanelOpen(v.panelOpen);
    setExiting(!v.panelOpen);
  }
  const mounted = v.panelOpen || exiting;
  const [enter] = useState(() => new Animated.Value(v.panelOpen ? 1 : 0));
  const [intro] = useState(() => new Animated.Value(v.panelOpen ? 0 : 1));
  const initialPanelOpenRef = useRef(v.panelOpen);

  useEffect(() => {
    if (initialPanelOpenRef.current) return;
    const introAnim = Animated.sequence([
      Animated.delay(450),
      Animated.timing(intro, {
        toValue: 0,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    introAnim.start();
    return () => introAnim.stop();
  }, [intro]);

  useEffect(() => {
    if (v.panelOpen) {
      intro.stopAnimation();
      intro.setValue(0);
      enter.stopAnimation();
      Animated.timing(enter, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!exiting) return;
    enter.stopAnimation();
    Animated.timing(enter, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setExiting(false);
      }
    });
  }, [v.panelOpen, exiting, enter, intro]);

  const status = v.thinking
    ? t('voice.thinking')
    : v.listening
      ? v.mode === 'dictation'
        ? t('voice.dictating')
        : t('voice.listening')
      : v.question
        ? t('dialog.asking')
        : t('voice.tapToTalk');

  const fb = v.feedback;
  const pill =
    fb?.kind === 'error'
      ? { bg: 'rgba(239,68,68,0.18)', border: 'rgba(248,113,113,0.5)', text: '#fecaca' }
      : fb?.kind === 'success'
        ? { bg: 'rgba(16,185,129,0.18)', border: 'rgba(52,211,153,0.5)', text: '#a7f3d0' }
        : { bg: 'rgba(88,213,247,0.14)', border: 'rgba(125,211,252,0.4)', text: '#bae6fd' };

  const examples = t('examples').split('|').slice(0, 4);
  const idle = !v.listening && !v.thinking && v.transcript === '' && !fb && !v.question;

  if (!mounted) {
    const dockedTranslateX = intro.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -46],
    });
    const dockedTranslateY = intro.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -24],
    });
    const dockedScale = intro.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.3],
    });
    const dockedOpacity = intro.interpolate({
      inputRange: [0, 1],
      outputRange: [0.34, 0.96],
    });

    return (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: -ORB_SMALL * 0.48,
          bottom: insets.bottom + 16,
          zIndex: 40,
          opacity: dockedOpacity,
          transform: [
            { translateX: dockedTranslateX },
            { translateY: dockedTranslateY },
            { scale: dockedScale },
          ],
        }}>
        <Pressable
          onPress={v.startCommand}
          hitSlop={{ top: 14, bottom: 14, left: 22, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('voice.talk')}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
          })}>
          <VoiceOrb size={ORB_SMALL} listening={false} thinking={false} level={v.level} subtle />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents={v.panelOpen ? 'auto' : 'none'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, opacity: enter }}>
      <Pressable
        onPress={v.closePanel}
        accessibilityLabel={t('voice.close')}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="voiceBackdrop" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#05070f" stopOpacity={0} />
              <Stop offset="1" stopColor="#05070f" stopOpacity={0.92} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#voiceBackdrop)" />
        </Svg>
      </Pressable>

      <Pressable
        onPress={v.closePanel}
        accessibilityRole="button"
        accessibilityLabel={t('voice.close')}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}>
        <X size={18} color="#e2e8f0" />
      </Pressable>

      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
        }}>
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', marginBottom: 12 }} pointerEvents="none">
          {v.question && (
            <Text
              numberOfLines={6}
              style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>
              {v.question}
            </Text>
          )}
          {v.transcript !== '' && (
            <Text
              numberOfLines={4}
              style={
                v.question
                  ? { color: '#7dd3fc', fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 10 }
                  : { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 }
              }>
              {v.transcript}
            </Text>
          )}
          <Text
            style={{
              color: '#7dd3fc',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}>
            {status}
          </Text>
          {fb && (
            <View
              style={{
                marginTop: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: pill.border,
                backgroundColor: pill.bg,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}>
              <Text style={{ color: pill.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{fb.text}</Text>
            </View>
          )}
          {fb?.items?.map((item) => (
            <Text key={item} style={{ color: '#e0f2fe', fontSize: 14, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>
              • “{item}”
            </Text>
          ))}
          {idle &&
            examples.map((e) => (
              <Text
                key={e}
                style={{ color: 'rgba(203,213,225,0.6)', fontSize: 13, fontStyle: 'italic', marginTop: 6 }}>
                “{e}”
              </Text>
            ))}
        </View>

        <Animated.View
          style={{
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
            ],
          }}>
          <Pressable
            onPress={v.question ? v.cancelDialog : v.listening ? v.stop : v.startCommand}
            accessibilityRole="button"
            accessibilityLabel={v.question ? t('voice.close') : v.listening ? t('voice.stopListening') : t('voice.talk')}>
            <VoiceOrb size={ORB_BIG} listening={v.listening} thinking={v.thinking} level={v.level} />
          </Pressable>
        </Animated.View>

        {!v.listening && (
          <TextInput
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => {
              v.runText(typed);
              setTyped('');
            }}
            returnKeyType="send"
            placeholder={v.supported ? t('voice.typePlaceholder') : t('voice.typePlaceholderNoMic')}
            placeholderTextColor="rgba(148,163,184,0.8)"
            style={{
              alignSelf: 'stretch',
              marginTop: 4,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(125,211,252,0.25)',
              backgroundColor: 'rgba(15,23,42,0.6)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: '#e2e8f0',
              fontSize: 13,
            }}
          />
        )}
      </View>
    </Animated.View>
  );
}

/** Mic compacto para dictar en un campo de texto; el usuario revisa antes de guardar. */
export function DictationButton({ onText, label }: { onText: (text: string) => void; label?: string }) {
  const v = useVoice();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const text = label ?? t('voice.dictate');
  const active = v.listening && v.mode === 'dictation';
  return (
    <Pressable
      onPress={() => (active ? v.stop() : v.startDictation(onText))}
      accessibilityRole="button"
      accessibilityLabel={text}
      className={`flex-row items-center self-start rounded-full border px-3 py-1.5 active:opacity-70 ${active
        ? 'border-red-300 bg-red-50 dark:border-red-400/50 dark:bg-red-950'
        : 'border-sky-200 bg-sky-50 dark:border-sky-300/40 dark:bg-sky-950'
        }`}>
      <Mic size={13} color={active ? colors.danger : colors.accentDeep} />
      <Text className={`ml-1.5 font-mono text-[10.5px] font-bold ${active ? 'text-red-600 dark:text-red-300' : 'text-sky-700 dark:text-sky-300'}`}>
        {active ? t('voice.listening') : text}
      </Text>
    </Pressable>
  );
}
