'use client';

import { useEffect, useState } from 'react';
import FixtureCard from '@/components/FixtureCard';
import FixtureSkeleton from '@/components/FixtureSkeleton';
import { supabasePKCE } from '@/utils/supabase/client';
import { savePrediction } from '@/utils/api';
import toast, { Toaster } from 'react-hot-toast';

type FixtureDTO = {
  id: string;
  kickoff_at: string; // UTC
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_team_name: string;
  away_team_name: string;
  home_crest: string | null;
  away_crest: string | null;
  competition_id: string | null;
  competition_code: string | null; // LP/LE/TP/TL…
  round_label: string | null;      // J1, QF, SF, F, M1…
  leg: number | null;
  is_locked: boolean;
  lock_at_utc?: string | null;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function fetchJsonOrThrow(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text().catch(() => '');

  if (!res.ok) {
    // devolve só o início do HTML para evitar a parede de texto
    const preview = text ? ` — ${text.slice(0, 180)}…` : '';
    throw new Error(`(${res.status}) ${res.statusText}${preview}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const preview = text ? text.slice(0, 180) : '';
    throw new Error(`Resposta não-JSON: ${preview}…`);
  }

  return JSON.parse(text);
}

async function tryEndpoints(): Promise<FixtureDTO[]> {
  const candidates = [
    '/api/fixtures/open',
    BASE ? `${BASE}/api/fixtures/open` : null,
    '/api/matchdays/md1/fixtures',
    BASE ? `${BASE}/api/matchdays/md1/fixtures` : null,
  ].filter(Boolean) as string[];

  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const json = await fetchJsonOrThrow(url);
      if (Array.isArray(json)) return json;
      // se não for array, tenta o próximo
      errors.push(`${url} → não devolveu lista`);
    } catch (e: any) {
      errors.push(`${url} → ${e?.message ?? e}`);
    }
  }
  throw new Error(errors.join('\n'));
}

export default function JogosPage() {
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<FixtureDTO[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const list = await tryEndpoints();
        if (!abort) {
          // garante só jogos agendados
          setFixtures(list.filter(f => f.status === 'SCHEDULED'));
        }
      } catch (e: any) {
        if (!abort) setError(e?.message ?? 'Erro a carregar jogos');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  async function onSave(fixtureId: string, home: number, away: number) {
    try {
      setSavingId(fixtureId);
      setError(null);
      const { data: { user } } = await supabasePKCE.auth.getUser();
      if (!user) throw new Error('Sessão inválida. Faz login novamente.');

      await savePrediction({ userId: user.id, fixtureId, home, away });
      toast.success('Palpite guardado!', { duration: 1500 });
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a guardar');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="p-10 ">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">Jogos em aberto</h1>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <FixtureSkeleton key={i} />)}
          </div>
        ) : fixtures.length === 0 ? (
          <div className="opacity-70">Sem jogos disponíveis.</div>
        ) : (
          <div className="space-y-4">
            {fixtures.map(f => (
              <FixtureCard
                key={f.id}
                id={f.id}
                kickoff_at={f.kickoff_at}
                status={f.status}
                home_team_name={f.home_team_name}
                away_team_name={f.away_team_name}
                home_crest={f.home_crest}
                away_crest={f.away_crest}
                competition_code={f.competition_code}
                round_label={f.round_label}
                leg={f.leg}
                is_locked={f.is_locked || f.status === 'FINISHED'}
                lock_at_utc={f.lock_at_utc}
                onSave={onSave}
                saving={savingId === f.id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
