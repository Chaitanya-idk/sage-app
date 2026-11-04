import { useCallback, useState } from 'react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; message: string }

let seq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
  }, [dismiss]);
  return { toasts, push, dismiss };
}

const STYLE: Record<ToastKind, { icon: typeof Info; cls: string }> = {
  success: { icon: CircleCheck, cls: 'border-moss-300 text-moss-800' },
  error: { icon: CircleX, cls: 'border-clay-500/40 text-clay-700' },
  info: { icon: Info, cls: 'border-soil-300 text-soil-800' },
};

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
      {toasts.map(({ id, kind, message }) => {
        const { icon: Icon, cls } = STYLE[kind];
        return (
          <div key={id} role={kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full animate-fade-up items-start gap-3 rounded-xl border bg-white/95 p-3 text-sm shadow-lg backdrop-blur ${cls}`}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 text-moss-950">{message}</p>
            <button onClick={() => dismiss(id)} aria-label="Dismiss" className="rounded p-0.5 text-soil-500 hover:bg-soil-100">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
