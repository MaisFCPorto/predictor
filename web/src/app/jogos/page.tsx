'use client';

import { useEffect, useMemo, useState } from 'react';
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

/** Helper que garante JSON (evita erro quando o Worker devolve HTML) */
async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${url} → (${res.status}) ${res.statusText}${txt ? ` — ${txt.slice(0, 140)}…` : ''}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${url} → resposta não-JSON: ${txt.slice(0, 140)}…`);
  }
  return res.json();
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

        // 1) novo endpoint via proxy do Next
        let list: FixtureDTO[] = await fetchJson('/api/fixtures/open');

        // 2) fallback para o endpoint antigo (se necessário)
        if (!Array.isArray(list) || list.length === 0) {
          list = await fetchJson('/api/matchdays/md1/fixtures');
        }

        if (!abort) setFixtures(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!abort) setError(e?.message ?? 'Erro a carregar jogos');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

  // ordenar por kickoff
  const sorted = useMemo(
    () =>
      [...fixtures].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [fixtures]
  );

  // separar abertos vs bloqueados/passados
  const openFixtures = sorted.filter(f => f.status === 'SCHEDULED' && !f.is_locked);
  const lockedFixtures = sorted.filter(f => f.is_locked || f.status === 'FINISHED');

  // guardar palpite
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
    <main className="px-2 sm:px-4 md:px-6 lg:px-10 py-10">
      <Toaster position="top-center" />

      <div className="mx-auto w-full max-w-none space-y-10">
        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm break-words">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FixtureSkeleton key={i} />
            ))}
          </div>
        )}

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
