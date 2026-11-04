import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, Upload, X } from 'lucide-react';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 10 * 1024 * 1024;

export default function ImageDropzone({ file, onChange, onError, scanning, disabled }: {
  file: File | null; onChange: (f: File | null) => void; onError: (msg: string) => void;
  scanning?: boolean; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const accept = (f?: File | null) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return onError('Unsupported image format. Use JPEG, PNG or WebP.');
    if (f.size > MAX) return onError(`Image is ${(f.size / 1048576).toFixed(1)} MB — the limit is 10 MB.`);
    onChange(f);
  };

  const pickers = (
    <>
      <input ref={input} type="file" accept={TYPES.join(',')} className="hidden"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { accept(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );

  return (
    <section aria-labelledby="img-label">
      <h2 id="img-label" className="label mb-2">2 · Leaf image</h2>
      {pickers}
      {url && file ? (
        <div className="group relative animate-pop overflow-hidden rounded-2xl border border-soil-200 bg-moss-950">
          <img src={url} alt="Selected leaf" className={`mx-auto max-h-72 w-full object-contain transition duration-700 ${scanning ? 'scale-[1.02] saturate-[1.2]' : ''}`} />
          {scanning && (
            <div className="pointer-events-none absolute inset-0 animate-fade-in">
              <div className="absolute inset-0 bg-[linear-gradient(rgb(119_168_82/0.12)_1px,transparent_1px),linear-gradient(90deg,rgb(119_168_82/0.12)_1px,transparent_1px)] bg-[size:24px_24px]" />
              <div className="absolute inset-x-0 h-[3px] animate-scan bg-moss-300 shadow-[0_0_24px_6px_rgb(159_196_127/0.7)]" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 text-white">
            <p className="truncate text-xs"><span className="font-medium">{file.name}</span> · {(file.size / 1024).toFixed(0)} KB</p>
            <div className="flex gap-1.5">
              <button disabled={disabled} onClick={() => input.current?.click()} aria-label="Replace image"
                className="rounded-lg bg-white/15 p-1.5 backdrop-blur transition hover:bg-white/30 disabled:opacity-50"><RotateCcw className="size-4" /></button>
              <button disabled={disabled} onClick={() => onChange(null)} aria-label="Clear image"
                className="rounded-lg bg-white/15 p-1.5 backdrop-blur transition hover:bg-clay-500 disabled:opacity-50"><X className="size-4" /></button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button" tabIndex={0} aria-label="Upload a leaf image"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-9 text-center transition-all duration-300
            ${drag ? 'scale-[1.01] border-moss-500 bg-moss-50' : 'border-soil-300 bg-soil-50/60 hover:border-moss-400 hover:bg-moss-50/50'}`}>
          <div className={`grid size-14 place-items-center rounded-2xl bg-white shadow-sm transition-transform duration-300 ${drag ? '-translate-y-1 scale-110' : ''}`}>
            {drag ? <Upload className="size-6 text-moss-600" /> : <ImagePlus className="size-6 text-moss-600" />}
          </div>
          <div>
            <p className="text-sm font-medium text-moss-900">{drag ? 'Drop to upload' : 'Drag & drop a leaf photo, or click to browse'}</p>
            <p className="mt-1 text-xs text-soil-600">JPEG, PNG or WebP · up to 10 MB</p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); camera.current?.click(); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-moss-300 bg-white px-3 py-1.5 text-xs font-medium text-moss-700 sm:hidden">
            <Camera className="size-3.5" /> Take a photo
          </button>
        </div>
      )}
    </section>
  );
}
