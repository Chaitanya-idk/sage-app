import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircleQuestion, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage, DiagnoseResponse, RetrievedChunk } from '../types/sage';
import RichText from './RichText';
import { PartialState } from './TreatmentAdvisory';

/** Suggested questions built from what this diagnosis and advisory actually cover. */
function suggestions(r: DiagnoseResponse): string[] {
  const p = r.prediction.prediction;
  const name = p.class_name ?? 'this condition';
  const crop = r.prediction.crop;
  const a = r.advisory;
  if (/healthy/i.test(name)) {
    return [`How do I keep my ${crop} healthy through the season?`, `Which ${crop} diseases should I scout for?`,
      `What are early warning signs of disease in ${crop}?`];
  }
  const qs: string[] = [];
  if (a?.treatments.cultural.length) qs.push(`Which field practices help control ${name}?`);
  if (a?.treatments.organic.length) qs.push(`What organic options work for ${name}?`);
  if (a?.treatments.chemical.length) qs.push(`How do I use the chemical treatment safely?`);
  if (a?.prevention.length) qs.push(`How can I prevent ${name} next season?`);
  if (a?.optimal_conditions) qs.push(`What weather makes ${name} worse?`);
  if (p.visual_symptoms || p.pathogen) qs.push(`Which symptoms confirm ${name}?`);
  qs.push(`What causes ${name} in ${crop}?`, `How do I spot ${name} early?`);
  return [...new Set(qs)].slice(0, 4);
}

export default function AgronomistChat({ result, onError }: { result: DiagnoseResponse; onError: (m: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chunks, setChunks] = useState<RetrievedChunk[]>(result.retrieval.chunks);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const qs = useMemo(() => suggestions(result), [result]);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  if (/not configured/i.test(result.partial_failure?.llm ?? '')) {
    return <PartialState title="AI Agronomist unavailable" reasons={[result.partial_failure?.llm]} />;
  }

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    abort.current = new AbortController();
    try {
      await api.chat(
        { diagnosis_context: { prediction: result.prediction, retrieval: result.retrieval, advisory: result.advisory, farm_context: result.farm_context }, messages: history },
        {
          chunks: setChunks,
          delta: (t) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: m[m.length - 1].content + t }]),
        },
        abort.current.signal,
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      onError((e as Error).message);
      setMessages((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="animate-fade-up rounded-2xl border border-moss-200 bg-gradient-to-br from-moss-50 to-white p-5">
        <div className="mb-2 flex items-center gap-2 text-moss-700"><Sparkles className="size-4" /><span className="label text-moss-700">Advisory summary</span></div>
        <RichText className="text-sm leading-relaxed text-moss-950" chunks={chunks}
          text={result.advisory?.summary ?? `Diagnosis: ${result.prediction.prediction.class_name ?? 'unidentified'}.`} />
      </div>

      <div ref={scroller} className="max-h-[60vh] min-h-48 space-y-4 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="animate-fade-in">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-soil-600"><MessageCircleQuestion className="size-3.5" />Suggested questions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {qs.map((s, i) => (
                <button key={s} onClick={() => send(s)} style={{ animationDelay: `${i * 70}ms` }}
                  className="animate-fade-up rounded-xl border border-soil-200 bg-white px-3.5 py-2.5 text-left text-sm text-soil-800 transition hover:-translate-y-0.5 hover:border-moss-400 hover:text-moss-800 hover:shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.role === 'user';
          const streaming = busy && i === messages.length - 1 && !mine;
          return (
            <div key={i} className={`flex animate-fade-up gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${mine ? 'bg-soil-200 text-soil-800' : 'bg-moss-600 text-white'}`}>
                {mine ? <UserRound className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${mine
                ? 'rounded-tr-sm bg-moss-700 text-white' : 'rounded-tl-sm border border-soil-200 bg-white text-moss-950 shadow-sm'}`}>
                {mine ? <p className="whitespace-pre-wrap">{m.content}</p>
                  : m.content ? <RichText text={m.content} chunks={chunks} />
                  : streaming && <span className="flex items-center gap-2 text-soil-500"><LoaderCircle className="size-4 animate-spin text-moss-500" />Thinking…</span>}
                {streaming && m.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-moss-500 align-text-bottom" />}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 rounded-2xl border border-soil-200 bg-white p-2 transition focus-within:border-moss-500 focus-within:ring-4 focus-within:ring-moss-500/15">
        {messages.length > 0 && !busy && (
          <button type="button" onClick={() => setMessages([])} aria-label="Clear conversation" title="Clear conversation"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-soil-500 transition hover:bg-soil-100 hover:text-soil-800">
            <RotateCcw className="size-4" />
          </button>
        )}
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} aria-label="Ask the AI agronomist"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about treatment, spread, prevention…" className="max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-moss-600 text-white transition hover:bg-moss-700 active:scale-95 disabled:bg-soil-200">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      <p className="text-center text-[11px] text-soil-500">Recommendations only — confirm dosages and high-risk decisions with your local extension officer.</p>
    </div>
  );
}
