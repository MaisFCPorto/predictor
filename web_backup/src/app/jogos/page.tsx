'use client';

import { useEffect, useState } from 'react';
import FixtureCard from '@/components/FixtureCard';
import FixtureSkeleton from '@/components/FixtureSkeleton';
import { supabasePKCE } from '@/utils/supabase/client';
import { savePrediction } from '@/utils/api';
import toast, { Toaster } from 'react-hot-toast';

type FixtureDTO = {
  id: string;
  kickoff_at: string;            // UTC
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_team_name: string;
  away_team_name: string;
  home_crest: string | null;
  away_crest: string | null;

  // novos
  competition_id: string | null;
  competition_code: string | null;  // p/ pill (LP/LE/TP/TL…)
  round_label: string | null;       // J1, QF, SF, F, M1…
  leg: number | null;

  // lock calculado pela API
  is_locked: boolean;
  lock_at_utc?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function JogosPage() {
  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<FixtureDTO[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // carrega jogos abertos (novo endpoint) com fallback
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

        if (!abort) setFixtures(list.filter(f => f.status === 'SCHEDULED')); // garante só abertos
      } catch (e: any) {
        if (!abort) setError(e?.message ?? 'Erro a carregar jogos');
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, []);

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
    <main className="p-10 ">
      <Toaster position="top-center" />

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
       <h1 className="text-2xl font-bold">Jogos em aberto</h1>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <FixtureSkeleton key={i} />
            ))}
          </div>
        ) : fixtures.length === 0 ? (
          <div className="opacity-70">Sem jogos disponíveis.</div>
        ) : (
          <div className="space-y-4">
            {fixtures.map((f) => (
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
                // locks
                is_locked={f.is_locked || f.status === 'FINISHED'}
                lock_at_utc={f.lock_at_utc}
                // se o teu FixtureCard já mostra pill/leg/round, passa estes também
                // competition_code={f.competition_code}
                // round_label={f.round_label}
                // leg_number={f.leg_number}
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
