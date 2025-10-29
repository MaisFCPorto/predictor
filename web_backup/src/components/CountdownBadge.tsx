'use client';

import { useEffect, useMemo, useState } from 'react';

function fmtTimeLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function CountdownBadge({
  lockAtIso,
  locked,
}: {
  lockAtIso?: string | null;
  locked: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (locked || !lockAtIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked, lockAtIso]);

  const content = useMemo(() => {
    if (locked) {
      return (
        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-400/20">
          Fechado
        </span>
      );
    }
    if (!lockAtIso) return null;
    const left = new Date(lockAtIso).getTime() - now;
    return (
      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/20">
        Fecha em {fmtTimeLeft(left)}
      </span>
    );
  }, [locked, lockAtIso, now]);

  return content;
}
