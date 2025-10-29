'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY!; // define no .env.local

export default function CloseResultPage({
  params: { id },
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const homeName = sp.get('home') ?? 'Equipa A';
  const awayName = sp.get('away') ?? 'Equipa B';

  const [home, setHome] = useState<number | ''>('');
  const [away, setAway] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const disabled =
    saving ||
    typeof home !== 'number' ||
    typeof away !== 'number' ||
    Number.isNaN(home) ||
    Number.isNaN(away);

  async function onSave() {
    setErr(null);
    setOk(null);
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/admin/fixtures/${id}/result`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY, // tem de bater certo com o da API
        },
        body: JSON.stringify({
          home_score: Number(home),
          away_score: Number(away),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Falha a fechar resultado');
      }
      setOk('Resultado fechado!');
      setTimeout(() => router.back(), 700);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Fechar resultado</h1>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">{homeName}</div>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            placeholder="0"
            value={home}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '') return setHome('');
              if (!/^\d{1,2}$/.test(v)) return;
              setHome(Number(v));
            }}
            className="w-16 rounded-full border border-white/10 bg-black/20 p-2 text-center outline-none focus:border-white/30"
          />
          <span className="opacity-60">–</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            placeholder="0"
            value={away}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '') return setAway('');
              if (!/^\d{1,2}$/.test(v)) return;
              setAway(Number(v));
            }}
            className="w-16 rounded-full border border-white/10 bg-black/20 p-2 text-center outline-none focus:border-white/30"
          />
          <div className="min-w-0 flex-1 text-right">{awayName}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            Voltar
          </button>
          <button
            onClick={onSave}
            disabled={disabled}
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/15 disabled:opacity-50"
          >
            {saving ? 'A guardar…' : 'Fechar resultado'}
          </button>
        </div>

        {err && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {err}
          </div>
        )}
        {ok && (
          <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
            {ok}
          </div>
        )}
      </div>
    </main>
  );
}
