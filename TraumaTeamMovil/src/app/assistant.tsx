import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowUpRight, BookOpen, Search } from 'lucide-react-native';

import { TraumaScreen } from '@/components/trauma/TraumaHeader';
import { useMission } from '@/components/trauma/mission-context';
import { askAssistant, fetchAssistantStatus, type AssistantAnswer, type AssistantEnvironment, type AssistantStatus } from '@/services/assistant-api';

const ENVIRONMENTS: Record<string, AssistantEnvironment> = { tierra: 'earth', nave: 'spacecraft', estacion: 'spacecraft', luna: 'moon', marte: 'mars' };
const EXAMPLES = ['What are the five hazards of human spaceflight?', 'How does space radiation affect astronauts?', 'Why are bone and muscle changes studied in space?'];
const MODE_LABELS = { generated: 'Evidence-based explanation', evidence_only: 'Retrieved passages', insufficient_evidence: 'Insufficient evidence', generation_unavailable: 'Passages available · AI unavailable' };

export default function AssistantScreen() {
  const { environment } = useMission();
  const [question, setQuestion] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [result, setResult] = useState<AssistantAnswer | null>(null);
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [submittedEnvironment, setSubmittedEnvironment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const selectedEnvironment = ENVIRONMENTS[environment];

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetchAssistantStatus(controller.signal).then((value) => {
      if (!controller.signal.aborted) setStatus(value);
    }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      request.current?.abort();
      request.current = null;
      clearTimeout(timer);
    };
  }, []);

  async function submit() {
    if (!question.trim() || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 40000);
    setLoading(true);
    setError(null);
    setResult(null);
    setSubmittedQuestion(question.trim());
    setSubmittedEnvironment(selectedEnvironment);
    try {
      const answer = await askAssistant({ question: question.trim(), environment: selectedEnvironment, bodyZone: bodyZone.trim() || undefined }, controller.signal);
      if (!controller.signal.aborted) setResult(answer);
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? 'The request timed out. Check your connection and try again.' : cause instanceof Error ? cause.message : 'The assistant is unavailable.');
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }

  return (
    <TraumaScreen>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
        <View>
          <Text className="font-mono text-[10px] font-bold uppercase tracking-widest text-sky-700">RESEARCH / CREW KNOWLEDGE</Text>
          <Text className="mt-2 text-3xl font-bold text-slate-900">Space Health Assistant</Text>
          <Text className="mt-2 text-sm leading-6 text-slate-600">Explore NASA and CSA research. Every explanation includes the passages used to support it.</Text>
        </View>

        <View className="rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-xs font-bold text-slate-700">SELECTED ENVIRONMENT</Text>
            <Text className="font-mono text-xs uppercase text-sky-700">{selectedEnvironment}</Text>
          </View>
          <Text className="mt-2 text-xs leading-5 text-slate-500">From your mission settings. This is not measured location telemetry.</Text>
          {status && <Text className="mt-3 font-mono text-xs text-slate-600">{status.indexedSources} sources · {status.indexedPassages} passages · {status.generationConfigured ? 'AI enabled' : 'Search only'}</Text>}
        </View>

        <View>
          <Text className="mb-2 text-sm font-bold text-slate-800">Your question</Text>
          <TextInput accessibilityLabel="Your space health research question" value={question} onChangeText={setQuestion} editable={!loading} multiline maxLength={1500} placeholder="Ask about radiation, isolation, gravity or spaceflight research..." placeholderTextColor="#64748b" textAlignVertical="top" style={{ minHeight: 116, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, backgroundColor: 'white', padding: 16, fontSize: 16, color: '#0f172a' }} />
          <Text className="mt-2 text-xs text-slate-500">Ask in English for the best search results.</Text>
          <Text className="mb-2 mt-4 text-sm font-bold text-slate-800">Body zone <Text className="font-normal text-slate-500">(optional)</Text></Text>
          <TextInput accessibilityLabel="Body zone, optional" value={bodyZone} onChangeText={setBodyZone} editable={!loading} maxLength={100} placeholder="e.g. lower back" placeholderTextColor="#64748b" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, backgroundColor: 'white', padding: 14, color: '#0f172a', fontSize: 16 }} />
          <Text className="mt-3 text-xs leading-5 text-slate-500">When AI is enabled, your question, selected environment, body zone and retrieved passages are sent to DeepSeek. Saved health records and photos are not attached.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Search resources and explain" accessibilityState={{ disabled: loading || !question.trim(), busy: loading }} disabled={loading || !question.trim()} onPress={submit} className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4" style={{ opacity: loading || !question.trim() ? 0.5 : 1 }}>
            {loading ? <ActivityIndicator color="white" /> : <Search size={18} color="white" />}
            <Text className="font-bold text-white">{loading ? 'Reviewing resources…' : 'Search & explain'}</Text>
          </Pressable>
        </View>

        {!result && !loading && <View className="gap-2">
          <Text className="mb-1 font-mono text-xs font-bold text-slate-500">START WITH A QUESTION</Text>
          {EXAMPLES.map((example) => <Pressable key={example} accessibilityRole="button" onPress={() => setQuestion(example)} className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><Text className="flex-1 pr-3 text-sm text-slate-700">{example}</Text><ArrowUpRight size={16} color="#0369a1" /></Pressable>)}
        </View>}

        {error && <View accessibilityRole="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><Text className="text-sm leading-6 text-red-800">{error}</Text></View>}
        {result && <View className="gap-4" accessibilityLiveRegion="polite">
          <View className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <Text className="font-mono text-xs font-bold uppercase text-sky-800">{MODE_LABELS[result.mode]}</Text>
            <Text className="mt-3 text-sm font-bold text-slate-800">{submittedQuestion}</Text>
            <Text className="mt-1 text-xs text-slate-500">Environment at request: {submittedEnvironment}</Text>
            <Text selectable className="mt-4 text-base leading-7 text-slate-800">{result.answer}</Text>
          </View>
          {result.citations.map((source) => <View key={source.chunkId} className="rounded-2xl border border-slate-200 bg-white p-5">
            <View className="flex-row items-center gap-2"><BookOpen size={16} color="#0369a1" /><Text className="font-mono text-xs text-sky-800">SOURCE [{source.citationId}] · {source.publisher}</Text></View>
            <Text className="mt-3 text-base font-bold text-slate-900">{source.title}</Text>
            <Text selectable className="mt-3 text-sm leading-6 text-slate-600">{source.excerpt}</Text>
            <Text className="mt-3 font-mono text-[10px] text-slate-500">Indexed {source.retrievedAt.slice(0, 10)} · word offset {source.wordOffset}</Text>
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${source.title}`} onPress={() => Linking.openURL(source.url).catch(() => setError('The source could not be opened. Check your connection.'))} className="mt-2 min-h-12 flex-row items-center gap-2"><Text className="font-bold text-sky-800">Read original source</Text><ArrowUpRight size={16} color="#075985" /></Pressable>
          </View>)}
          <Text className="text-xs leading-5 text-slate-600">{result.notice}</Text>
        </View>}
        {!result && <Text className="text-xs leading-5 text-slate-500">Educational research assistance. This prototype cannot diagnose, prescribe treatment or clear you for duty. For urgent symptoms, follow mission emergency procedures and contact the crew medical officer.</Text>}
      </ScrollView>
    </TraumaScreen>
  );
}
