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

  // carrega jogos (novo endpoint) com fallback
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) tenta o novo
        let res = await fetch(`${API_BASE}/api/fixtures/open`, { cache: 'no-store' });
        if (res.status === 404) {
          // 2) fallback para o antigo (se ainda existirem md1)
          res = await fetch(`${API_BASE}/api/matchdays/md1/fixtures`, { cache: 'no-store' });
        }
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`(${res.status}) ${res.statusText} ${txt}`.trim());
        }
        const list: FixtureDTO[] = await res.json();

        if (!abort) setFixtures(list); // keep all fixtures; we'll split below
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

  // split fixtures
  const openFixtures = fixtures.filter(f => f.status === 'SCHEDULED' && !f.is_locked);
  const lockedFixtures = fixtures.filter(f => f.is_locked || f.status === 'FINISHED');

  return (
    <main className="px-2 sm:px-4 md:px-6 lg:px-10 py-10">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <h1 className="text-2xl font-bold">Jogos em aberto</h1>


      <div className="mx-auto w-full max-w-none space-y-10">
        {/* Error banner */}
        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <FixtureSkeleton key={i} />)}
          </div>
        )}

        {/* Open fixtures */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Jogos em aberto</h2>
            {openFixtures.length === 0 ? (
              <div className="opacity-70">Sem jogos abertos.</div>
            ) : (
              <div className="space-y-4">
                {openFixtures.map((f) => (
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
          </section>
        )}

        {/* Locked fixtures */}
        {!loading && (
          <section>
            <h2 className="text-2xl font-bold mb-4">Jogos passados</h2>
            {lockedFixtures.length === 0 ? (
              <div className="opacity-70">Sem jogos passados.</div>
            ) : (
              <div className="space-y-4">
                {lockedFixtures.map((f) => (
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
                    variant="past"
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
