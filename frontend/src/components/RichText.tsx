import type { ReactNode } from 'react';
import type { RetrievedChunk } from '../types/sage';

const CITE = /(\*\*[^*]+\*\*|\[[\w:.\-]+(?:\s*,\s*[\w:.\-]+)*\])/g;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * Light formatter for LLM text: **bold**, bullet / numbered lists, paragraphs, and [chunk_id] citations rendered as
 * small numbered chips (raw ids are never shown). Unknown ids are dropped.
 */
export default function RichText({ text, chunks = [], onCite, className = '' }: {
  text: string; chunks?: RetrievedChunk[]; onCite?: (id: string) => void; className?: string;
}) {
  const index = new Map(chunks.map((c, i) => [c.id, { n: i + 1, source: c.source }]));

  const inline = (s: string, key: string): ReactNode[] =>
    s.split(CITE).filter(Boolean).map((part, i) => {
      const k = `${key}-${i}`;
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={k} className="font-semibold text-moss-900">{part.slice(2, -2)}</strong>;
      if (part.startsWith('[') && part.endsWith(']')) {
        const ids = part.slice(1, -1).split(',').map((x) => x.trim());
        const known = ids.filter((id) => index.has(id));
        if (!known.length) return /[_\d]/.test(part) ? null : part; // drop stray ids, keep ordinary brackets
        return (
          <span key={k} className="whitespace-nowrap">
            {known.map((id) => {
              const c = index.get(id)!;
              return (
                <button key={id} type="button" title={c.source} onClick={() => onCite?.(id)} aria-label={`Source ${c.n}: ${c.source}`}
                  className={`ml-0.5 inline-grid size-4 place-items-center rounded-full bg-moss-100 align-super text-[9px] font-semibold text-moss-700 transition hover:bg-moss-200 ${onCite ? 'cursor-pointer' : 'cursor-help'}`}>
                  {c.n}
                </button>
              );
            })}
          </span>
        );
      }
      return part;
    });

  return (
    <div className={`space-y-2 ${className}`}>
      {text.trim().split(/\n{2,}/).map((block, b) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.length && lines.every((l) => BULLET.test(l))) {
          return (
            <ul key={b} className="space-y-1">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2"><span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-moss-500" />
                  <span className="min-w-0">{inline(l.replace(BULLET, ''), `${b}-${i}`)}</span></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={b}>
            {lines.map((l, i) => (
              <span key={i}>{i > 0 && <br />}{BULLET.test(l) ? '• ' : ''}{inline(l.replace(BULLET, ''), `${b}-${i}`)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
