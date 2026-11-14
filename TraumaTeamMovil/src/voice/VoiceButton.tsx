import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, X } from 'lucide-react-native';

import { VOICE_EXAMPLES } from './parser';
import { useVoice } from './voice-context';

/** Botón flotante + panel de escucha con transcripción y feedback visible. */
export function VoiceFab() {
  const v = useVoice();
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState('');

  const tone =
    v.feedback?.kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : v.feedback?.kind === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <>
      {v.panelOpen && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 88 }}>
          <View
            accessibilityLiveRegion="polite"
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-mono text-xs font-bold text-slate-900">
                {v.listening
                  ? v.mode === 'dictation'
                    ? 'Dictando… habla ahora'
                    : 'Escuchando…'
                  : 'Control por voz'}
              </Text>
              <Pressable onPress={v.closePanel} accessibilityLabel="Cerrar control por voz" hitSlop={10}>
                <X size={16} color="#475569" />
              </Pressable>
            </View>

            {v.transcript !== '' && (
              <Text className="mb-2 font-mono text-sm text-slate-900">“{v.transcript}”</Text>
            )}

            {v.feedback && (
              <View className={`mb-2 rounded-xl border px-3 py-2 ${tone}`}>
                <Text className={`font-mono text-[11px] font-bold ${tone.split(' ').pop()}`}>
                  {v.feedback.text}
                </Text>
              </View>
            )}

            {!v.listening && !v.feedback && (
              <View className="mb-2">
                {VOICE_EXAMPLES.slice(0, 5).map((e) => (
                  <Text key={e} className="font-mono text-[10.5px] text-slate-500">
                    • {e}
                  </Text>
                ))}
              </View>
            )}

            {(!v.supported || !v.listening) && (
              <TextInput
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={() => {
                  v.runText(typed);
                  setTyped('');
                }}
                returnKeyType="send"
                placeholder={v.supported ? 'O escribe un comando…' : 'Sin micrófono: escribe un comando…'}
                placeholderTextColor="#94a3b8"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700"
              />
            )}
          </View>
        </View>
      )}

      <Pressable
        onPress={v.listening ? v.stop : v.startCommand}
        accessibilityRole="button"
        accessibilityLabel={v.listening ? 'Detener escucha' : 'Hablar con la app'}
        style={{ position: 'absolute', right: 16, bottom: insets.bottom + 20 }}
        className={`h-14 w-14 items-center justify-center rounded-full border shadow-lg active:opacity-80 ${
          v.listening ? 'border-red-300 bg-red-500' : 'border-sky-300 bg-sky-500'
        }`}>
        {v.supported ? <Mic size={24} color="#ffffff" /> : <MicOff size={24} color="#ffffff" />}
      </Pressable>
    </>
  );
}

/** Mic compacto para dictar en un campo de texto; el usuario revisa antes de guardar. */
export function DictationButton({ onText, label = 'Dictar' }: { onText: (text: string) => void; label?: string }) {
  const v = useVoice();
  const active = v.listening && v.mode === 'dictation';
  return (
    <Pressable
      onPress={() => (active ? v.stop() : v.startDictation(onText))}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center self-start rounded-full border px-3 py-1.5 active:opacity-70 ${
        active ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-sky-50'
      }`}>
      <Mic size={13} color={active ? '#dc2626' : '#0284c7'} />
      <Text className={`ml-1.5 font-mono text-[10.5px] font-bold ${active ? 'text-red-600' : 'text-sky-700'}`}>
        {active ? 'Escuchando…' : label}
      </Text>
    </Pressable>
  );
}
