import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles, UserRound } from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage, DiagnoseResponse } from '../types/sage';
import { PartialState } from './TreatmentAdvisory';

const SUGGESTIONS = ['How fast will this spread?', 'What organic options do I have?', 'When should I re-inspect the field?', 'Can I still harvest this crop?'];

export default function AgronomistChat({ result, onError }: { result: DiagnoseResponse; onError: (m: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);

  const llmDown = /not configured/i.test(result.partial_failure?.llm ?? '');
  if (llmDown) return <PartialState title="AI Agronomist unavailable" reasons={[result.partial_failure?.llm]} />;

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
        { delta: (t) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: m[m.length - 1].content + t }]) },
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
    <div className="flex flex-col gap-4">
      <div className="animate-fade-up rounded-2xl border border-moss-200 bg-gradient-to-br from-moss-50 to-white p-5">
        <div className="mb-2 flex items-center gap-2 text-moss-700"><Sparkles className="size-4" /><span className="label text-moss-700">Advisory summary</span></div>
        <p className="text-sm leading-relaxed text-moss-950">
          {result.advisory?.summary ?? `Diagnosis: ${result.prediction.prediction.class_name ?? 'unidentified'}. ${result.partial_failure?.llm ?? ''}`}
        </p>
      </div>

      <div className="max-h-[28rem] min-h-40 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button key={s} onClick={() => send(s)} style={{ animationDelay: `${i * 70}ms` }}
                className="animate-fade-up rounded-full border border-soil-200 bg-white px-3 py-1.5 text-xs text-soil-800 transition hover:-translate-y-0.5 hover:border-moss-400 hover:text-moss-800">
                {s}
              </button>
            ))}
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
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine
                ? 'rounded-tr-sm bg-moss-700 text-white' : 'rounded-tl-sm border border-soil-200 bg-white text-moss-950'}`}>
                {m.content || (streaming && <LoaderCircle className="size-4 animate-spin text-moss-500" />)}
                {streaming && m.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-moss-500 align-text-bottom" />}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 rounded-2xl border border-soil-200 bg-white p-2 focus-within:border-moss-500 focus-within:ring-4 focus-within:ring-moss-500/15">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} aria-label="Ask the AI agronomist"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask a follow-up question…" className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
          className="grid size-9 place-items-center rounded-xl bg-moss-600 text-white transition hover:bg-moss-700 active:scale-95 disabled:bg-soil-200">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
      <p className="text-center text-[11px] text-soil-500">Recommendations only — confirm dosages and high-risk decisions with your local extension officer.</p>
    </div>
  );
}
