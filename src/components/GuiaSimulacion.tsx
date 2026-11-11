import { useId, useState } from 'react';

export default function GuiaSimulacion({ explicacion }: { explicacion: string }) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();

  return (
    <div className="rounded-xl border border-sky-800 bg-sky-950/40 p-3">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-md text-left font-semibold text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta(!abierta)}
      >
        <svg aria-hidden="true" viewBox="0 0 40 40" className="h-9 w-9 shrink-0">
          <circle cx="20" cy="20" r="19" fill="currentColor" opacity=".13" />
          <ellipse cx="20" cy="20" rx="18" ry="9" fill="none" stroke="currentColor" transform="rotate(-35 20 20)" />
          <circle cx="20" cy="20" r="10" fill="currentColor" />
          <path d="M16 18h1m6 0h1m-7 5q3 4 6 0" stroke="#301e16" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="33" cy="11" r="2.5" fill="currentColor" />
        </svg>
        ¿Qué está pasando?
        <span aria-hidden="true" className="ml-auto">{abierta ? '−' : '+'}</span>
      </button>
      <div id={id} hidden={!abierta} className="mt-3 space-y-2 text-sm">
        <p className="text-slate-100">{explicacion}</p>
      </div>
    </div>
  );
}
