'use client';

import { useEffect, useMemo, useState } from 'react';
import axios, { AxiosError } from 'axios';
import AdminGate from '../_components/AdminGate';
import Link from 'next/link';

/**
 * IMPORTANTE
 * ----------
 * Este cliente usa apenas rotas relativas do Next:
 *   /api/admin/fixtures, /api/admin/teams, /api/admin/competitions, ...
 * O nosso proxy (no servidor do Next) acrescenta a X-Admin-Key e fala com o Worker.
 * Não uses NEXT_PUBLIC_ADMIN_KEY aqui (nunca exponhas a secret no browser).
 */
const adm = axios.create({
  baseURL: '', // relativo ao mesmo host
});

adm.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) alert('Sessão expirada ou em falta. Faz login novamente.');
    if (status === 403) alert('Acesso negado (precisas de ser admin).');
    return Promise.reject(error);
  }
);

/* -------------------- Tipos -------------------- */
type Team = { id: string; name: string };
type Competition = { id: string; code: string; name: string };

type PortoAPIMatch = {
  utcDate?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  competition?: { code?: string };
  matchday?: number | string;
};

type Fx = {
  id: string;
  competition_id?: string | null; // <- ID (UUID) da competition
  competition_code?: string | null; // <- pode vir da API (fallback)
  round_label?: string | null;
  leg_number?: number | null | '';
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string; // UTC (YYYY-MM-DD HH:mm:ss)
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_score?: number | null;
  away_score?: number | null;
  home_name?: string;
  away_name?: string;
  _hs?: number | '';
  _as?: number | '';
};

/* -------------------- Utils datas -------------------- */
function toLocalDTValue(isoOrSqlUTC: string) {
  if (!isoOrSqlUTC) return '';
  const asISO = isoOrSqlUTC.includes('T')
    ? isoOrSqlUTC
    : isoOrSqlUTC.replace(' ', 'T') + 'Z';
  const d = new Date(asISO);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDTValue(localValue: string) {
  if (!localValue) return '';
  const d = new Date(localValue);
  const y = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mm}-${dd} ${hh}:${mi}:00`;
}

function splitLocal(dt: string | undefined) {
  if (!dt) return { date: '', time: '' };
  const [d, t = ''] = dt.split('T');
  return { date: d, time: t.slice(0, 5) };
}

function joinLocal(date: string, time: string) {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

// Data/hora legível tipo: "domingo, 9 de fevereiro · 18:00"
function formatReadableLocal(isoOrSqlUTC: string) {
  if (!isoOrSqlUTC) return '—';
  const asISO = isoOrSqlUTC.includes('T')
    ? isoOrSqlUTC
    : isoOrSqlUTC.replace(' ', 'T') + 'Z';
  const d = new Date(asISO);
  if (Number.isNaN(d.getTime())) return '—';

  const weekday = d.toLocaleDateString('pt-PT', { weekday: 'long' }); // já vem em minúsculas
  const day = d.getDate(); // sem zero à esquerda
  const month = d.toLocaleDateString('pt-PT', { month: 'long' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');

  return `${weekday}, ${day} de ${month} · ${hh}:${mi}`;
}

/* -------------------- Utils mensagens/erros -------------------- */
function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro';
}

/* =============================================================== */

export default function AdminFixtures() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [fixtures, setFixtures] = useState<Fx[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [compFilter, setCompFilter] = useState<string>(''); // competition code filter
  const [sortField, setSortField] = useState<'comp' | 'ronda' | 'kickoff' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [portoSuggest, setPortoSuggest] = useState<{
    utcDate: string;
    home: string;
    away: string;
    comp?: string;
    round?: string;
  }[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newFx, setNewFx] = useState<{
    competition_id?: string | null; // <- guarda o ID (não o code)
    round_label?: string | null;
    leg_number?: number | null;
    home_team_id: string;
    away_team_id: string;
    kickoff_local: string;
    status: 'SCHEDULED' | 'FINISHED';
  }>({
    competition_id: '',
    round_label: '',
    leg_number: null,
    home_team_id: '',
    away_team_id: '',
    kickoff_local: '',
    status: 'SCHEDULED',
  });

  // texto dos campos com auto-complete
  const [homeSearch, setHomeSearch] = useState('');
  const [awaySearch, setAwaySearch] = useState('');

  // sincroniza texto dos campos com o ID atual (+ equipas carregadas)
  useEffect(() => {
    const homeName =
      teams.find((t) => t.id === newFx.home_team_id)?.name ?? '';
    const awayName =
      teams.find((t) => t.id === newFx.away_team_id)?.name ?? '';
    setHomeSearch(homeName);
    setAwaySearch(awayName);
  }, [teams, newFx.home_team_id, newFx.away_team_id]);

  // validação: tudo obrigatório excepto Mão (leg_number)
  const createErrors = useMemo(() => {
    const errs: Record<string, string | null> = {};
    errs.comp = newFx.competition_id ? null : 'Obrigatório';
    errs.ronda = newFx.round_label ? null : 'Obrigatório';
    errs.home = newFx.home_team_id ? null : 'Obrigatório';
    errs.away = newFx.away_team_id ? null : 'Obrigatório';
    if (
      newFx.home_team_id &&
      newFx.away_team_id &&
      newFx.home_team_id === newFx.away_team_id
    ) {
      errs.away = 'Equipas não podem ser iguais';
    }
    errs.ko = newFx.kickoff_local ? null : 'Obrigatório';
    return errs;
  }, [newFx]);
  const hasCreateErrors = useMemo(
    () => Object.values(createErrors).some(Boolean),
    [createErrors]
  );

  // valor inicial: hoje às 21:00
  useEffect(() => {
    if (!newFx.kickoff_local) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setNewFx((v) => ({
        ...v,
        kickoff_local: `${yyyy}-${mm}-${dd}T21:00`,
      }));
    }
  }, [newFx.kickoff_local]);

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1500);
  };

  /* -------------------- Loaders -------------------- */
  async function loadTeams() {
    const { data } = await adm.get<Team[]>('/api/admin/teams', {
      headers: { 'cache-control': 'no-store' },
    });
    setTeams(data);
  }

  async function loadCompetitions() {
    try {
      const { data } = await adm.get<Competition[]>(
        '/api/admin/competitions',
        { headers: { 'cache-control': 'no-store' } }
      );
      setCompetitions(data ?? []);
    } catch {
      setCompetitions([]);
    }
  }

  async function loadFixtures() {
    setLoading(true);
    try {
      const { data } = await adm.get('/api/admin/fixtures', {
        headers: { 'cache-control': 'no-store' },
      });

      // garante array
      const arr: any[] = Array.isArray(data) ? data : [];
      if (!Array.isArray(data)) {
        console.warn('Expected array from /api/admin/fixtures, got:', data);
        if (data?.error) {
          throw new Error(data.error);
        }
      }

      // mapa code -> id para fallback
      const byCode = new Map(competitions.map((c) => [c.code, c.id]));

      const list: Fx[] = arr.map((x: any) => ({
        ...x,
        // se a API devolver competition_code, converte para competition_id (id)
        competition_id:
          x.competition_id ??
          (x.competition_code ? byCode.get(x.competition_code) ?? null : null),
        _hs: x.home_score ?? '',
        _as: x.away_score ?? '',
      }));

      setFixtures(list);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'Falha a carregar jogos (podes não ter permissões).';
      alert(msg);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPortoSuggestions() {
    setLoadingSuggest(true);
    try {
      const { data } = await adm.get('/api/admin/fixtures/porto', {
        headers: { 'cache-control': 'no-store' },
      });
      const matches: PortoAPIMatch[] = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data)
        ? data
        : [];
      const items = matches
        .map((m) => ({
          utcDate: m.utcDate || '',
          home: m.homeTeam?.name || '',
          away: m.awayTeam?.name || '',
          comp: m.competition?.code,
          round: m.matchday != null ? String(m.matchday) : undefined,
        }))
        // exclui jogos sem data/equipas e jogos com hora exatamente 00:00:00
        .filter((m) => {
          if (!m.utcDate || !m.home || !m.away) return false;
          const d = new Date(m.utcDate);
          return !(
            d.getUTCHours() === 0 &&
            d.getUTCMinutes() === 0 &&
            d.getUTCSeconds() === 0
          );
        })
        .sort(
          (a, b) =>
            new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
        )
        .slice(0, 4);
      setPortoSuggest(items);
    } catch {
      setPortoSuggest([]);
    } finally {
      setLoadingSuggest(false);
    }
  }

  useEffect(() => {
    void loadTeams();
    void loadCompetitions();
    void loadFixtures();
    void loadPortoSuggestions();
  }, []);

  /* -------------------- Mutations -------------------- */
  async function updateField(id: string, patch: Partial<Fx>) {
    try {
      await adm.patch(`/api/admin/fixtures/${id}`, patch);
      notify('Atualizado ✅');
      await loadFixtures();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function finishFixture(id: string, hs: number, as: number) {
    try {
      await adm.patch(`/api/admin/fixtures/${id}/result`, {
        home_score: Number(hs || 0),
        away_score: Number(as || 0),
      });
      notify('Fechado ✅');
      await loadFixtures();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function reopenFixture(id: string) {
    try {
      await adm.patch(`/api/admin/fixtures/${id}/reopen`, {});
      notify('Reaberto ✅');
      await loadFixtures();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function deleteFixture(id: string) {
    try {
      const ok = prompt('Para confirmar a eliminação escreve: APAGAR');
      if (ok !== 'APAGAR') return;
      await adm.delete(`/api/admin/fixtures/${id}`);
      notify('Apagado ✅');
      await loadFixtures();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function createFixture() {
    try {
      setCreating(true);
      const {
        competition_id,
        round_label,
        leg_number,
        home_team_id,
        away_team_id,
        kickoff_local,
        status,
      } = newFx;
      if (!home_team_id || !away_team_id)
        throw new Error('Escolhe as duas equipas.');
      if (home_team_id === away_team_id)
        throw new Error('Equipas não podem ser iguais.');
      if (!kickoff_local) throw new Error('Kickoff em falta.');

      const kickoff_at = fromLocalDTValue(kickoff_local);

      // 👇 Enquanto a API exige matchday_id, envia md1 por defeito
      const matchday_id = 'md1';

      await adm.post('/api/admin/fixtures', {
        matchday_id,
        competition_id: competition_id || null, // <- ENVIA O ID
        round_label: round_label
          ? round_label.toUpperCase().slice(0, 3)
          : null,
        leg_number: leg_number ? Number(leg_number) : null,
        home_team_id,
        away_team_id,
        kickoff_at,
        status,
      });

      notify('Criado ✅');
      setNewFx({
        competition_id: '',
        round_label: '',
        leg_number: null,
        home_team_id: '',
        away_team_id: '',
        kickoff_local: '',
        status: 'SCHEDULED',
      });
      setHomeSearch('');
      setAwaySearch('');
      await loadFixtures();
    } catch (e: unknown) {
      alert(errorMessage(e) || 'Falha a criar jogo');
    } finally {
      setCreating(false);
    }
  }

  /* -------------------- Filtro + Ordenação + Paginação -------------------- */
  const totalCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byIdToCode = new Map(competitions.map((c) => [c.id, c.code]));
    return fixtures.filter((f) => {
      const inQuery =
        !q ||
        (f.home_name ?? '').toLowerCase().includes(q) ||
        (f.away_name ?? '').toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.round_label ?? '').toLowerCase().includes(q);
      const fxCode =
        f.competition_code ??
        (f.competition_id ? byIdToCode.get(f.competition_id) ?? '' : '');
      const inComp = !compFilter || fxCode === compFilter;
      const inStatus =
        !statusFilter || (f.status ?? '').toUpperCase() === statusFilter;
      return inQuery && inComp && inStatus;
    }).length;
  }, [fixtures, competitions, query, compFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byIdToCode = new Map(competitions.map((c) => [c.id, c.code]));
    const base = fixtures.filter((f) => {
      const inQuery =
        !q ||
        (f.home_name ?? '').toLowerCase().includes(q) ||
        (f.away_name ?? '').toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.round_label ?? '').toLowerCase().includes(q);
      const fxCode =
        f.competition_code ??
        (f.competition_id ? byIdToCode.get(f.competition_id) ?? '' : '');
      const inComp = !compFilter || fxCode === compFilter;
      const inStatus =
        !statusFilter || (f.status ?? '').toUpperCase() === statusFilter;
      return inQuery && inComp && inStatus;
    });

    const cmp = (a: Fx, b: Fx) => {
      if (!sortField) return 0;
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'comp') {
        const ac = (
          a.competition_code ??
          (a.competition_id ? byIdToCode.get(a.competition_id) ?? '' : '')
        ).toUpperCase();
        const bc = (
          b.competition_code ??
          (b.competition_id ? byIdToCode.get(b.competition_id) ?? '' : '')
        ).toUpperCase();
        return ac.localeCompare(bc) * dir;
      }
      if (sortField === 'ronda') {
        const norm = (s?: string | null) => (s ?? '').toUpperCase();
        const ar = norm(a.round_label);
        const br = norm(b.round_label);
        const aj = /^J(\d+)$/i.exec(ar);
        const bj = /^J(\d+)$/i.exec(br);
        if (aj && bj) return (Number(aj[1]) - Number(bj[1])) * dir;
        return ar.localeCompare(br) * dir;
      }
      if (sortField === 'kickoff') {
        const at = new Date(a.kickoff_at).getTime();
        const bt = new Date(b.kickoff_at).getTime();
        return (at - bt) * dir;
      }
      return 0;
    };

    const sorted = sortField ? [...base].sort(cmp) : base;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return sorted.slice(start, end);
  }, [
    fixtures,
    competitions,
    query,
    compFilter,
    statusFilter,
    sortField,
    sortDir,
    page,
    pageSize,
  ]);

  useEffect(() => {
    setPage(1);
  }, [query, compFilter, statusFilter, sortField, sortDir]);

  /* -------------------- Helpers -------------------- */
  function findTeamIdByName(name: string): string {
    const norm = (s: string) =>
      s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const n = norm(name);
    const exact = teams.find((t) => norm(t.name) === n)?.id;
    if (exact) return exact;
    const contains = teams.find(
      (t) => norm(t.name).includes(n) || n.includes(norm(t.name))
    )?.id;
    return contains || '';
  }

  function prefillFromSuggestion(s: {
    utcDate: string;
    home: string;
    away: string;
    comp?: string;
    round?: string;
  }) {
    const home_team_id = findTeamIdByName(s.home);
    const away_team_id = findTeamIdByName(s.away);
    const kickoff_local = toLocalDTValue(s.utcDate);
    setNewFx((v) => ({
      ...v,
      competition_id: competitions.find((c) => c.code === 'LP')?.id || '',
      round_label: s.round
        ? `J${String(s.round)}`.toUpperCase().slice(0, 3)
        : '',
      leg_number: null,
      home_team_id,
      away_team_id,
      kickoff_local,
      status: 'SCHEDULED',
    }));
    setHomeSearch(s.home);
    setAwaySearch(s.away);
  }

  const newLocal = splitLocal(newFx.kickoff_local || '');

  /* -------------------- Render -------------------- */
  return (
    <AdminGate>
      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Backoffice — Jogos</h1>

        {/* datalist global para auto-complete das equipas */}
        <datalist id="teams-list">
          {teams.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>

        {/* Sugestões próximos jogos do FC Porto */}
        <div className="rounded-2xl border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg">
              Sugestões — Próximos jogos do FC Porto
            </h2>
            <button
              className="rounded bg-white/10 px-2 py-1 hover:bg-white/15"
              onClick={() => void loadPortoSuggestions()}
              disabled={loadingSuggest}
            >
              {loadingSuggest ? 'A atualizar…' : 'Atualizar'}
            </button>
          </div>
          {portoSuggest.length === 0 ? (
            <div className="opacity-70">Sem sugestões disponíveis.</div>
          ) : (
            <ul className="grid md:grid-cols-2 gap-2">
              {portoSuggest.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">
                      {s.home} vs {s.away}
                    </div>
                    <div className="text-xs opacity-70">
                      {formatReadableLocal(s.utcDate)}{' '}
                      {s.comp ? `· ${s.comp}` : ''}{' '}
                      {s.round ? `· MD ${s.round}` : ''}
                    </div>
                  </div>
                  <button
                    className="rounded bg-white/10 px-2 py-1 hover:bg-white/15"
                    onClick={() => prefillFromSuggestion(s)}
                  >
                    Preencher
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Criar novo jogo */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Criar novo jogo</h2>
            {hasCreateErrors && (
              <span className="text-xs text-amber-300">
                Preenche os campos obrigatórios
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {/* Competição */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Competição *
              </label>
              <select
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                value={newFx.competition_id ?? ''}
                onChange={(e) =>
                  setNewFx((v) => ({
                    ...v,
                    competition_id: e.target.value || '',
                  }))
                }
              >
                <option value="">Selecionar…</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ronda */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Ronda (ex: J11) *
              </label>
              <input
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm uppercase"
                maxLength={3}
                value={newFx.round_label ?? ''}
                onChange={(e) =>
                  setNewFx((v) => ({
                    ...v,
                    round_label: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            {/* Mão */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Mão
              </label>
              <select
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                value={newFx.leg_number ?? ''}
                onChange={(e) =>
                  setNewFx((v) => ({
                    ...v,
                    leg_number:
                      e.target.value === ''
                        ? null
                        : Number(e.target.value),
                  }))
                }
              >
                <option value="">—</option>
                <option value="1">1ª mão</option>
                <option value="2">2ª mão</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Status
              </label>
              <select
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                value={newFx.status}
                onChange={(e) =>
                  setNewFx((v) => ({
                    ...v,
                    status: e.target.value as 'SCHEDULED' | 'FINISHED',
                  }))
                }
              >
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="FINISHED">FINISHED</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {/* Home com auto-complete */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Equipa da casa *
              </label>
              <input
                list="teams-list"
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                placeholder="Começa a escrever..."
                value={homeSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setHomeSearch(val);
                  const t = teams.find(
                    (tm) =>
                      tm.name.toLowerCase() === val.toLowerCase()
                  );
                  setNewFx((v) => ({
                    ...v,
                    home_team_id: t?.id ?? '',
                  }));
                }}
              />
            </div>

            {/* Away com auto-complete */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Equipa visitante *
              </label>
              <input
                list="teams-list"
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                placeholder="Começa a escrever..."
                value={awaySearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setAwaySearch(val);
                  const t = teams.find(
                    (tm) =>
                      tm.name.toLowerCase() === val.toLowerCase()
                  );
                  setNewFx((v) => ({
                    ...v,
                    away_team_id: t?.id ?? '',
                  }));
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
            {/* Data */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Data (local) *
              </label>
              <input
                type="date"
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                value={newLocal.date}
                onChange={(e) => {
                  const date = e.target.value;
                  const time = newLocal.time || '21:00';
                  const local = joinLocal(date, time);
                  setNewFx((v) => ({ ...v, kickoff_local: local }));
                }}
              />
            </div>

            {/* Hora */}
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Hora (local) *
              </label>
              <input
                type="time"
                step={60}
                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-sm"
                value={newLocal.time}
                onChange={(e) => {
                  const time = e.target.value;
                  const date =
                    newLocal.date ||
                    new Date().toISOString().slice(0, 10);
                  const local = joinLocal(date, time);
                  setNewFx((v) => ({ ...v, kickoff_local: local }));
                }}
              />
            </div>

            {/* Botão criar */}
            <button
              onClick={() => void createFixture()}
              disabled={creating || hasCreateErrors}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500"
            >
              {creating ? 'A criar…' : 'Criar jogo'}
            </button>
          </div>
        </div>

        {/* Filtros topo */}
        <div className="flex flex-wrap items-center gap-2 bg-card/15 border border-white/10 rounded-2xl p-3">
          <Link
            href="/admin/teams"
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            Equipas
          </Link>
          <select
            className="rounded border border-white/10 bg-black/20 px-2 py-1"
            value={compFilter}
            onChange={(e) => setCompFilter(e.target.value)}
            title="Filtrar por competição"
          >
            <option value="">Todas as competições</option>
            {Array.from(new Set(competitions.map((c) => c.code))).map(
              (code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              )
            )}
          </select>
          <select
            className="rounded border border-white/10 bg-black/20 px-2 py-1"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value.toUpperCase())
            }
            title="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="FINISHED">FINISHED</option>
          </select>
          <div className="flex-1" />
          <input
            className="rounded border border-white/10 bg-black/20 px-3 py-2 w-64"
            placeholder="Pesquisar equipa / id / ronda..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="rounded bg-white/10 px-3 py-2 hover:bg-white/15"
            onClick={() => {
              setQuery('');
              setCompFilter('');
              setSortField('');
              setSortDir('asc');
              setPage(1);
            }}
            title="Limpar filtros"
          >
            Limpar filtros
          </button>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="opacity-70">A carregar…</div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-2 text-left">
                      <button
                        className="hover:underline"
                        onClick={() => {
                          setSortField(() => 'comp');
                          setSortDir((d) =>
                            sortField === 'comp'
                              ? d === 'asc'
                                ? 'desc'
                                : 'asc'
                              : 'asc'
                          );
                        }}
                        title="Ordenar por competição"
                      >
                        Comp{' '}
                        {sortField === 'comp'
                          ? sortDir === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </button>
                    </th>
                    <th className="p-2 text-left">
                      <button
                        className="hover:underline"
                        onClick={() => {
                          setSortField(() => 'ronda');
                          setSortDir((d) =>
                            sortField === 'ronda'
                              ? d === 'asc'
                                ? 'desc'
                                : 'asc'
                              : 'asc'
                          );
                        }}
                        title="Ordenar por ronda"
                      >
                        Ronda{' '}
                        {sortField === 'ronda'
                          ? sortDir === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </button>
                    </th>
                    <th className="p-2 text-left">Mão</th>
                    <th className="p-2 text-left">Home</th>
                    <th className="p-2 text-left">Away</th>
                    <th className="p-2 text-left">
                      <button
                        className="hover:underline"
                        onClick={() => {
                          setSortField(() => 'kickoff');
                          setSortDir((d) =>
                            sortField === 'kickoff'
                              ? d === 'asc'
                                ? 'desc'
                                : 'asc'
                              : 'asc'
                          );
                        }}
                        title="Ordenar por kickoff"
                      >
                        Kickoff (local){' '}
                        {sortField === 'kickoff'
                          ? sortDir === 'asc'
                            ? '▲'
                            : '▼'
                          : ''}
                      </button>
                    </th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Resultado</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => {
                    const isFinished = f.status === 'FINISHED';
                    const lockCls = isFinished
                      ? 'opacity-60 cursor-not-allowed'
                      : '';
                    const resultOK =
                      f._hs !== '' &&
                      f._as !== '' &&
                      !Number.isNaN(Number(f._hs)) &&
                      !Number.isNaN(Number(f._as));

                    const local = splitLocal(toLocalDTValue(f.kickoff_at));

                    return (
                      <tr
                        key={f.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        {/* Comp */}
                        <td className="p-2 w-16">
                          <select
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${lockCls}`}
                            value={f.competition_id ?? ''}
                            disabled={isFinished}
                            onChange={(e) =>
                              updateField(f.id, {
                                competition_id: e.target.value || null,
                              })
                            }
                          >
                            <option value="">—</option>
                            {competitions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Ronda */}
                        <td className="p-2 w-16">
                          <input
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 uppercase w-16 ${lockCls}`}
                            defaultValue={f.round_label ?? ''}
                            maxLength={3}
                            disabled={isFinished}
                            onBlur={(e) =>
                              updateField(f.id, {
                                round_label: e.target.value
                                  ? e.target.value
                                      .toUpperCase()
                                      .slice(0, 3)
                                  : null,
                              })
                            }
                          />
                        </td>

                        {/* Mão */}
                        <td className="p-2 w-16">
                          <select
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 text-center w-16 ${lockCls}`}
                            value={f.leg_number ?? ''}
                            disabled={isFinished}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateField(f.id, {
                                leg_number:
                                  v === '' ? null : Number(v),
                              });
                            }}
                          >
                            <option value="">—</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>

                        {/* Home */}
                        <td className="p-2">
                          <select
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${lockCls}`}
                            value={f.home_team_id}
                            disabled={isFinished}
                            onChange={(e) =>
                              updateField(f.id, {
                                home_team_id: e.target.value,
                              })
                            }
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Away */}
                        <td className="p-2">
                          <select
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${lockCls}`}
                            value={f.away_team_id}
                            disabled={isFinished}
                            onChange={(e) =>
                              updateField(f.id, {
                                away_team_id: e.target.value,
                              })
                            }
                          >
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Kickoff – linha legível + inputs */}
                        <td className="p-2 align-top">
                          <div className="flex flex-col gap-1">
                            <div className="text-[11px] text-white/60">
                              {formatReadableLocal(f.kickoff_at)}
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-2 gap-2 items-center">
                              <input
                                type="date"
                                defaultValue={local.date}
                                disabled={isFinished}
                                className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${lockCls}`}
                                onBlur={(e) => {
                                  const date =
                                    e.currentTarget.value ||
                                    local.date;
                                  const time =
                                    (
                                      e.currentTarget.parentElement?.querySelector(
                                        'input[type="time"]'
                                      ) as HTMLInputElement
                                    )?.value || local.time;
                                  const localDT =
                                    joinLocal(date, time);
                                  const utc =
                                    fromLocalDTValue(localDT);
                                  if (
                                    utc &&
                                    utc !== f.kickoff_at
                                  )
                                    updateField(f.id, {
                                      kickoff_at: utc,
                                    });
                                }}
                              />
                              <input
                                type="time"
                                step={60}
                                defaultValue={local.time}
                                disabled={isFinished}
                                className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${lockCls}`}
                                onBlur={(e) => {
                                  const time =
                                    e.currentTarget.value ||
                                    local.time;
                                  const date =
                                    (
                                      e.currentTarget.parentElement?.querySelector(
                                        'input[type="date"]'
                                      ) as HTMLInputElement
                                    )?.value || local.date;
                                  const localDT =
                                    joinLocal(date, time);
                                  const utc =
                                    fromLocalDTValue(localDT);
                                  if (
                                    utc &&
                                    utc !== f.kickoff_at
                                  )
                                    updateField(f.id, {
                                      kickoff_at: utc,
                                    });
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-2">
                          <select
                            className={`rounded border border-white/10 bg-black/20 px-2 py-1 ${
                              isFinished
                                ? 'opacity-60 cursor-not-allowed'
                                : ''
                            }`}
                            value={f.status}
                            disabled={isFinished}
                            onChange={async (e) => {
                              const v =
                                e.target.value as Fx['status'];
                              if (v === 'FINISHED') {
                                const hs = f._hs,
                                  as = f._as;
                                if (!resultOK) {
                                  e.currentTarget.value =
                                    f.status;
                                  alert(
                                    'Para fechar um jogo tens de preencher H e A.'
                                  );
                                  return;
                                }
                                await finishFixture(
                                  f.id,
                                  Number(hs),
                                  Number(as)
                                );
                                return;
                              }
                              await updateField(f.id, {
                                status: v,
                              });
                            }}
                          >
                            <option value="SCHEDULED">
                              SCHEDULED
                            </option>
                            <option value="FINISHED">
                              FINISHED
                            </option>
                          </select>
                        </td>

                        {/* Resultado */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              className={`w-14 rounded border border-white/10 bg-black/20 px-2 py-1 text-center ${lockCls}`}
                              placeholder="H"
                              defaultValue={
                                f._hs === ''
                                  ? ''
                                  : String(f._hs ?? '')
                              }
                              disabled={isFinished}
                              onChange={(e) => {
                                f._hs =
                                  e.target.value === ''
                                    ? ''
                                    : Number(e.target.value);
                              }}
                              onBlur={async (e) => {
                                const v = e.target.value;
                                const val =
                                  v === ''
                                    ? null
                                    : Number(v);
                                if (
                                  val === null ||
                                  Number.isNaN(val)
                                )
                                  return;
                                await updateField(f.id, {
                                  home_score: val,
                                });
                              }}
                            />
                            <span className="opacity-60">
                              –
                            </span>
                            <input
                              className={`w-14 rounded border border-white/10 bg-black/20 px-2 py-1 text-center ${lockCls}`}
                              placeholder="A"
                              defaultValue={
                                f._as === ''
                                  ? ''
                                  : String(f._as ?? '')
                              }
                              disabled={isFinished}
                              onChange={(e) => {
                                f._as =
                                  e.target.value === ''
                                    ? ''
                                    : Number(e.target.value);
                              }}
                              onBlur={async (e) => {
                                const v = e.target.value;
                                const val =
                                  v === ''
                                    ? null
                                    : Number(v);
                                if (
                                  val === null ||
                                  Number.isNaN(val)
                                )
                                  return;
                                await updateField(f.id, {
                                  away_score: val,
                                });
                              }}
                            />
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              title="Reabrir"
                              className={`rounded px-2 py-1 hover:bg-white/10 ${
                                !isFinished
                                  ? 'opacity-40 cursor-not-allowed'
                                  : ''
                              }`}
                              disabled={!isFinished}
                              onClick={() =>
                                reopenFixture(f.id)
                              }
                            >
                              ↺
                            </button>
                            <button
                              title="Apagar"
                              className="rounded px-2 py-1 hover:bg-white/10"
                              onClick={() =>
                                deleteFixture(f.id)
                              }
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        className="p-4 opacity-60"
                        colSpan={9}
                      >
                        Sem jogos para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="opacity-70 text-sm">
                Página {page} de{' '}
                {Math.max(
                  1,
                  Math.ceil(totalCount / pageSize)
                )}
              </span>
              <button
                className="rounded bg-white/10 px-3 py-1 hover:bg-white/15 disabled:opacity-50"
                onClick={() =>
                  setPage((p) => Math.max(1, p - 1))
                }
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded bg-white/10 px-3 py-1 hover:bg-white/15 disabled:opacity-50"
                onClick={() =>
                  setPage((p) =>
                    p * pageSize < totalCount ? p + 1 : p
                  )
                }
                disabled={page * pageSize >= totalCount}
              >
                Seguinte
              </button>
              <select
                className="rounded border border-white/10 bg-black/20 px-2 py-1"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 20);
                  setPage(1);
                }}
                title="Itens por página"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}/pág
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Toast simples */}
        {msg && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm shadow-lg">
            {msg}
          </div>
        )}
      </main>
    </AdminGate>
  );
}
