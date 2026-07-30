'use client';

import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import axios, { AxiosError } from 'axios';
import Link from 'next/link';
import AdminGate from '../_components/AdminGate';
import { adm } from '../_utils/adminClients';
import { localDateTimeToUtcIso } from '@/utils/dates';

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
  competition_id?: string | null;
  competition_code?: string | null;
  round_label?: string | null;
  leg_number?: number | null | '';
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  status: 'SCHEDULED' | 'FINISHED' | string;
  home_score?: number | null;
  away_score?: number | null;
  home_name?: string;
  away_name?: string;
  _hs?: number | '';
  _as?: number | '';
};

type Player = {
  id: string;
  team_id: string;
  name: string;
  position: 'GR' | 'D' | 'M' | 'A' | string;
};

type FixtureScorerSummary = {
  fixture_id: string;
  player_id: string | number;
  name: string;
  position?: string | null;
};

type Suggestion = {
  utcDate: string;
  home: string;
  away: string;
  comp?: string;
  round?: string;
};

/* -------------------- Componentes de UI -------------------- */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-white/45">{hint}</span> : null}
    </label>
  );
}

function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClass = 'max-w-2xl',
  zClass = 'z-[90]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  zClass?: string;
}) {
  if (!open) return null;

  return (
    <div className={`fixed inset-0 ${zClass} flex justify-end`} role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fechar painel"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        className={`relative flex h-full w-full ${widthClass} flex-col border-l border-white/10 bg-[#06102b] shadow-2xl`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#06102b]/95 px-4 py-4 backdrop-blur md:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-white/55">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-white/75 hover:bg-white/10"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">{children}</div>

        {footer ? (
          <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-[#06102b]/95 px-4 py-3 backdrop-blur md:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

/* -------------------- Utils datas -------------------- */
function toLocalDTValue(isoOrSqlUTC: string) {
  if (!isoOrSqlUTC) return '';

  const asISO = isoOrSqlUTC.includes('T')
    ? isoOrSqlUTC
    : isoOrSqlUTC.replace(' ', 'T');

  const d = new Date(asISO);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDTValue(localValue: string) {
  return localDateTimeToUtcIso(localValue);
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

function fixtureDateLabel(value: string) {
  if (!value) return 'Data por definir';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(d)
    .replace(',', ' ·');
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro';
}

function statusLabel(status: string) {
  return status === 'FINISHED' ? 'Terminado' : 'Agendado';
}

function statusClass(status: string) {
  return status === 'FINISHED'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
    : 'border-sky-400/25 bg-sky-400/10 text-sky-200';
}

function normalizePlayerId(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric >= 0 ? String(numeric) : raw;
}

function normalizePlayerIds(values: unknown[]): string[] {
  return [...new Set(values.map(normalizePlayerId).filter(Boolean))];
}

/* =============================================================== */

export default function AdminFixtures() {
  const initialLoadStarted = useRef(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [fixtures, setFixtures] = useState<Fx[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [compFilter, setCompFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<'comp' | 'ronda' | 'kickoff' | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [showCreate, setShowCreate] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);

  const [portoSuggest, setPortoSuggest] = useState<Suggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newFx, setNewFx] = useState<{
    competition_id?: string | null;
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

  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('21:00');
  const [homeSearch, setHomeSearch] = useState('');
  const [awaySearch, setAwaySearch] = useState('');

  const [players, setPlayers] = useState<Player[]>([]);
  const [scorersByFixture, setScorersByFixture] = useState<Record<string, string[]>>({});
  const [scorerNamesByFixture, setScorerNamesByFixture] = useState<Record<string, string[]>>({});
  const [scorerTargetId, setScorerTargetId] = useState<string | null>(null);
  const [scorerDraft, setScorerDraft] = useState<string[]>([]);
  const [scorerSearch, setScorerSearch] = useState('');
  const [scorerPosition, setScorerPosition] = useState('');
  const [loadingScorers, setLoadingScorers] = useState(false);
  const [savingScorers, setSavingScorers] = useState(false);

  useEffect(() => {
    const homeName = teams.find((t) => t.id === newFx.home_team_id)?.name ?? '';
    const awayName = teams.find((t) => t.id === newFx.away_team_id)?.name ?? '';
    setHomeSearch(homeName);
    setAwaySearch(awayName);
  }, [teams, newFx.home_team_id, newFx.away_team_id]);

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
    [createErrors],
  );

  useEffect(() => {
    if (!newDate || !newTime) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setNewDate(`${yyyy}-${mm}-${dd}`);
      setNewTime('21:00');
    }
  }, [newDate, newTime]);

  useEffect(() => {
    if (!newDate || !newTime) return;
    setNewFx((v) => ({ ...v, kickoff_local: joinLocal(newDate, newTime) }));
  }, [newDate, newTime]);

  useEffect(() => {
    const modalOpen = Boolean(
      showCreate || showFilters || editingFixtureId || scorerTargetId,
    );
    if (!modalOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showCreate, showFilters, editingFixtureId, scorerTargetId]);

  const notify = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 1800);
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
      const { data } = await adm.get<Competition[]>('/api/admin/competitions', {
        headers: { 'cache-control': 'no-store' },
      });
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

      const arr: unknown[] = Array.isArray(data) ? data : [];
      if (!Array.isArray(data)) {
        console.warn('Expected array from /api/admin/fixtures, got:', data);
        if ((data as { error?: string } | null)?.error) {
          throw new Error((data as { error: string }).error);
        }
      }

      const byCode = new Map(competitions.map((c) => [c.code, c.id]));
      const list: Fx[] = arr.map((raw) => {
        const x = raw as Fx;
        return {
          ...x,
          competition_id:
            x.competition_id ??
            (x.competition_code ? byCode.get(x.competition_code) ?? null : null),
          _hs: x.home_score ?? '',
          _as: x.away_score ?? '',
        };
      });

      setFixtures(list);
    } catch (e: unknown) {
      alert(errorMessage(e) || 'Falha a carregar jogos.');
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
          (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
        )
        .slice(0, 4);
      setPortoSuggest(items);
    } catch {
      setPortoSuggest([]);
    } finally {
      setLoadingSuggest(false);
    }
  }

  async function loadPlayers() {
    try {
      const { data } = await adm.get<Player[]>('/api/admin/players', {
        headers: { 'cache-control': 'no-store' },
      });
      setPlayers(
        (data ?? []).map((player) => ({
          ...player,
          id: normalizePlayerId(player.id),
        })),
      );
    } catch {
      setPlayers([]);
    }
  }

  async function loadFixtureScorers(fixtureId: string): Promise<string[]> {
    try {
      const { data } = await adm.get<
        { player_id: string | number; name?: string | null }[]
      >(
        `/api/admin/fixtures/${fixtureId}/scorers`,
        { headers: { 'cache-control': 'no-store' } },
      );
      const rows = Array.isArray(data) ? data : [];
      const ids = normalizePlayerIds(rows.map((row) => row.player_id));
      const names = [
        ...new Set(
          rows
            .map((row) => row.name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      setScorersByFixture((prev) => ({ ...prev, [fixtureId]: ids }));
      setScorerNamesByFixture((prev) => ({ ...prev, [fixtureId]: names }));
      return ids;
    } catch {
      const current = scorersByFixture[fixtureId] ?? [];
      setScorersByFixture((prev) => ({ ...prev, [fixtureId]: current }));
      return current;
    }
  }

  async function loadFixtureScorerSummaries(fixtureIds: string[]) {
    const ids = [...new Set(fixtureIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return;

    try {
      const { data } = await adm.get<FixtureScorerSummary[]>(
        '/api/admin/fixtures/scorers-summary',
        {
          params: { fixture_ids: ids.join(',') },
          headers: { 'cache-control': 'no-store' },
        },
      );

      const next: Record<string, string[]> = Object.fromEntries(
        ids.map((id) => [id, []]),
      );

      for (const row of Array.isArray(data) ? data : []) {
        const fixtureId = String(row.fixture_id ?? '').trim();
        const name = row.name?.trim();
        if (!fixtureId || !name || !(fixtureId in next)) continue;
        if (!next[fixtureId].includes(name)) next[fixtureId].push(name);
      }

      setScorerNamesByFixture((prev) => ({ ...prev, ...next }));
    } catch {
      // A lista de jogos continua utilizável mesmo que este resumo falhe.
    }
  }

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;

    void loadTeams();
    void loadCompetitions();
    void loadFixtures();
    void loadPortoSuggestions();
    void loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portoTeam = useMemo(() => {
    const norm = (s: string) =>
      s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    return teams.find((t) => norm(t.name).includes('porto'));
  }, [teams]);

  const orderedTeams = useMemo(() => {
    if (!portoTeam) return teams;
    return [portoTeam, ...teams.filter((t) => t.id !== portoTeam.id)];
  }, [teams, portoTeam]);

  const competitionById = useMemo(
    () => new Map(competitions.map((c) => [c.id, c])),
    [competitions],
  );

  const competitionByCode = useMemo(
    () => new Map(competitions.map((c) => [c.code, c])),
    [competitions],
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const editingFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === editingFixtureId) ?? null,
    [fixtures, editingFixtureId],
  );

  const scorerTargetFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === scorerTargetId) ?? null,
    [fixtures, scorerTargetId],
  );

  const filteredPlayers = useMemo(() => {
    const q = scorerSearch.trim().toLowerCase();
    return players.filter((player) => {
      const matchesQuery = !q || player.name.toLowerCase().includes(q);
      const matchesPosition = !scorerPosition || player.position === scorerPosition;
      return matchesQuery && matchesPosition;
    });
  }, [players, scorerSearch, scorerPosition]);

  /* -------------------- Mutations -------------------- */
  async function updateField(id: string, patch: Partial<Fx>) {
    try {
      await adm.patch(`/api/admin/fixtures/${id}`, patch);
      notify('Alteração guardada');
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
      notify('Jogo terminado');
      await loadFixtures();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function reopenFixture(id: string) {
    try {
      await adm.patch(`/api/admin/fixtures/${id}/reopen`, {});
      notify('Jogo reaberto');
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
      setEditingFixtureId(null);
      notify('Jogo apagado');
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

      if (!home_team_id || !away_team_id) throw new Error('Escolhe as duas equipas.');
      if (home_team_id === away_team_id) throw new Error('Equipas não podem ser iguais.');
      if (!kickoff_local) throw new Error('Kickoff em falta.');

      await adm.post('/api/admin/fixtures', {
        competition_id: competition_id || null,
        round_label: round_label ? round_label.toUpperCase().slice(0, 3) : null,
        leg_number: leg_number ? Number(leg_number) : null,
        home_team_id,
        away_team_id,
        kickoff_at: fromLocalDTValue(kickoff_local),
        status,
      });

      notify('Jogo criado');
      setShowCreate(false);
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
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setNewDate(`${yyyy}-${mm}-${dd}`);
      setNewTime('21:00');
      await loadFixtures();
    } catch (e: unknown) {
      alert(errorMessage(e) || 'Falha a criar jogo');
    } finally {
      setCreating(false);
    }
  }

  function setLocalScore(id: string, key: '_hs' | '_as', raw: string) {
    setFixtures((current) =>
      current.map((fixture) =>
        fixture.id === id
          ? { ...fixture, [key]: raw === '' ? '' : Number(raw) }
          : fixture,
      ),
    );
  }

  async function openFixtureEditor(fixtureId: string) {
    setEditingFixtureId(fixtureId);
    if (scorersByFixture[fixtureId] === undefined) {
      await loadFixtureScorers(fixtureId);
    }
  }

  async function openScorerEditor(fixtureId: string) {
    setScorerTargetId(fixtureId);
    setScorerSearch('');
    setScorerPosition('');
    setLoadingScorers(true);
    const ids = await loadFixtureScorers(fixtureId);
    setScorerDraft(ids);
    setLoadingScorers(false);
  }

  function toggleDraftScorer(playerId: string) {
    const normalizedId = normalizePlayerId(playerId);
    if (!normalizedId) return;

    setScorerDraft((current) => {
      const normalizedCurrent = normalizePlayerIds(current);
      return normalizedCurrent.includes(normalizedId)
        ? normalizedCurrent.filter((id) => id !== normalizedId)
        : [...normalizedCurrent, normalizedId];
    });
  }

  async function saveScorerDraft() {
    if (!scorerTargetId) return;

    const fixtureId = scorerTargetId;
    const idsToSave = normalizePlayerIds(scorerDraft);

    setSavingScorers(true);
    try {
      const { data } = await adm.put<{ player_ids?: unknown[] }>(
        `/api/admin/fixtures/${fixtureId}/scorers`,
        { player_ids: idsToSave.map(Number) },
        { headers: { 'cache-control': 'no-store' } },
      );

      const savedIds = normalizePlayerIds(data?.player_ids ?? idsToSave);
      setScorersByFixture((prev) => ({ ...prev, [fixtureId]: savedIds }));
      setScorerDraft(savedIds);

      // Confirma o estado real guardado na D1 antes de fechar o painel.
      await loadFixtureScorers(fixtureId);

      setScorerTargetId(null);
      notify('Marcadores atualizados');
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setSavingScorers(false);
    }
  }

  /* -------------------- Filtro + Ordenação + Paginação -------------------- */
  const matchingFixtures = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byIdToCode = new Map(competitions.map((c) => [c.id, c.code]));

    return fixtures.filter((fixture) => {
      const inQuery =
        !q ||
        (fixture.home_name ?? '').toLowerCase().includes(q) ||
        (fixture.away_name ?? '').toLowerCase().includes(q) ||
        fixture.id.toLowerCase().includes(q) ||
        (fixture.round_label ?? '').toLowerCase().includes(q);
      const fxCode =
        fixture.competition_code ??
        (fixture.competition_id ? byIdToCode.get(fixture.competition_id) ?? '' : '');
      const inComp = !compFilter || fxCode === compFilter;
      const inStatus =
        !statusFilter || (fixture.status ?? '').toUpperCase() === statusFilter;
      return inQuery && inComp && inStatus;
    });
  }, [fixtures, competitions, query, compFilter, statusFilter]);

  const sortedFixtures = useMemo(() => {
    if (!sortField) return matchingFixtures;
    const byIdToCode = new Map(competitions.map((c) => [c.id, c.code]));
    const dir = sortDir === 'asc' ? 1 : -1;

    return [...matchingFixtures].sort((a, b) => {
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
        const ar = (a.round_label ?? '').toUpperCase();
        const br = (b.round_label ?? '').toUpperCase();
        const aj = /^J(\d+)$/i.exec(ar);
        const bj = /^J(\d+)$/i.exec(br);
        if (aj && bj) return (Number(aj[1]) - Number(bj[1])) * dir;
        return ar.localeCompare(br) * dir;
      }

      return (
        (new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()) * dir
      );
    });
  }, [matchingFixtures, competitions, sortField, sortDir]);

  const totalCount = sortedFixtures.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const filtered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedFixtures.slice(start, start + pageSize);
  }, [sortedFixtures, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, compFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    void loadFixtureScorerSummaries(filtered.map((fixture) => fixture.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const activeFilterCount = Number(Boolean(compFilter)) + Number(Boolean(statusFilter)) + Number(Boolean(sortField));

  function clearFilters() {
    setQuery('');
    setCompFilter('');
    setStatusFilter('');
    setSortField('');
    setSortDir('asc');
    setPage(1);
  }

  function findTeamIdByName(name: string): string {
    const norm = (s: string) =>
      s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const n = norm(name);
    const exact = teams.find((t) => norm(t.name) === n)?.id;
    if (exact) return exact;
    return (
      teams.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name)))?.id ||
      ''
    );
  }

  function prefillFromSuggestion(suggestion: Suggestion) {
    const kickoffLocal = toLocalDTValue(suggestion.utcDate);
    const { date, time } = splitLocal(kickoffLocal);
    const matchedCompetition =
      competitionByCode.get(suggestion.comp ?? '') ?? competitionByCode.get('LP');

    setNewFx((current) => ({
      ...current,
      competition_id: matchedCompetition?.id ?? '',
      round_label: suggestion.round
        ? `J${String(suggestion.round)}`.toUpperCase().slice(0, 3)
        : '',
      leg_number: null,
      home_team_id: findTeamIdByName(suggestion.home),
      away_team_id: findTeamIdByName(suggestion.away),
      kickoff_local: kickoffLocal,
      status: 'SCHEDULED',
    }));
    setHomeSearch(suggestion.home);
    setAwaySearch(suggestion.away);
    setNewDate(date);
    setNewTime(time || '21:00');
    setShowCreate(true);
  }

  const inputClass =
    'w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-sky-400/55 focus:ring-2 focus:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <AdminGate>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6 md:py-8">
        <title>+Predictor - Admin Jogos</title>

        <datalist id="teams-list">
          {teams.map((team) => (
            <option key={team.id} value={team.name} />
          ))}
        </datalist>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="mb-2 inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
            >
              ← Backoffice
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Jogos</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">
              Gere calendário, resultados e marcadores sem abrir todos os jogos ao mesmo tempo.
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setShowSuggestions((value) => !value)}
              className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 sm:flex-none"
            >
              Sugestões{portoSuggest.length ? ` · ${portoSuggest.length}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/35 hover:bg-sky-400 sm:flex-none"
            >
              + Novo jogo
            </button>
          </div>
        </header>

        {showSuggestions ? (
          <section className="rounded-2xl border border-white/10 bg-black/20 p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Próximos jogos do FC Porto</h2>
                <p className="text-xs text-white/45">Usa uma sugestão para pré-preencher o novo jogo.</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
                onClick={() => void loadPortoSuggestions()}
                disabled={loadingSuggest}
              >
                {loadingSuggest ? 'A atualizar…' : 'Atualizar'}
              </button>
            </div>

            {portoSuggest.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/50">
                Sem sugestões disponíveis neste momento.
              </div>
            ) : (
              <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                {portoSuggest.map((suggestion, index) => {
                  const local = splitLocal(toLocalDTValue(suggestion.utcDate));
                  return (
                    <article
                      key={`${suggestion.utcDate}-${index}`}
                      className="min-w-[270px] snap-start rounded-xl border border-white/10 bg-white/[0.035] p-3 md:min-w-[320px]"
                    >
                      <div className="text-sm font-semibold text-white">
                        {suggestion.home} vs {suggestion.away}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {local.date} · {local.time || '--:--'}
                        {suggestion.comp ? ` · ${suggestion.comp}` : ''}
                        {suggestion.round ? ` · J${suggestion.round}` : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => prefillFromSuggestion(suggestion)}
                        className="mt-3 w-full rounded-lg bg-white/8 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/12"
                      >
                        Usar sugestão
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-white/35">⌕</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-400/45"
                placeholder="Pesquisar equipa, ronda ou ID…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="relative shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Filtros
              {activeFilterCount ? (
                <span className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-sky-400 px-1 text-[11px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-white/50">
              {totalCount} {totalCount === 1 ? 'jogo' : 'jogos'}
            </span>

            {compFilter ? (
              <button
                type="button"
                onClick={() => setCompFilter('')}
                className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100"
              >
                {compFilter} ×
              </button>
            ) : null}
            {statusFilter ? (
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100"
              >
                {statusLabel(statusFilter)} ×
              </button>
            ) : null}
            {sortField ? (
              <button
                type="button"
                onClick={() => {
                  setSortField('');
                  setSortDir('asc');
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
              >
                Ordenação ×
              </button>
            ) : null}
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
            A carregar jogos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-black/15 px-5 py-10 text-center">
            <div className="text-base font-semibold text-white">Sem jogos para mostrar</div>
            <p className="mt-1 text-sm text-white/50">Altera os filtros ou cria um novo jogo.</p>
          </div>
        ) : (
          <section className="space-y-2.5">
            {filtered.map((fixture) => {
              const competition = fixture.competition_id
                ? competitionById.get(fixture.competition_id)
                : fixture.competition_code
                  ? competitionByCode.get(fixture.competition_code)
                  : undefined;
              const homeName = fixture.home_name ?? teamById.get(fixture.home_team_id)?.name ?? 'Casa';
              const awayName = fixture.away_name ?? teamById.get(fixture.away_team_id)?.name ?? 'Visitante';
              const isFinished = fixture.status === 'FINISHED';
              const scorerNames = scorerNamesByFixture[fixture.id];
              const scorerLabel =
                scorerNames === undefined
                  ? '—'
                  : scorerNames.length > 0
                    ? scorerNames.join(', ')
                    : 'nenhum';

              return (
                <article
                  key={fixture.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:border-white/18 md:p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/75">
                          {competition?.code ?? fixture.competition_code ?? '—'}
                          {fixture.round_label ? ` · ${fixture.round_label}` : ''}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                            fixture.status,
                          )}`}
                        >
                          {statusLabel(fixture.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-semibold text-white md:text-base">{homeName}</div>
                        </div>
                        <div className="text-center">
                          {isFinished ? (
                            <div className="rounded-lg bg-white/5 px-3 py-1.5 text-base font-bold text-white">
                              {fixture.home_score ?? 0}–{fixture.away_score ?? 0}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-wider text-white/35">vs</span>
                          )}
                        </div>
                        <div className="min-w-0 text-right">
                          <div className="truncate text-sm font-semibold text-white md:text-base">{awayName}</div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-white/50">
                        {fixtureDateLabel(fixture.kickoff_at)}
                        {fixture.leg_number ? ` · ${fixture.leg_number}.ª mão` : ''}
                      </div>
                      <div
                        className="mt-1 truncate text-[11px] text-white/35"
                        title={`Marcadores: ${scorerLabel}`}
                      >
                        Marcadores: {scorerLabel}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void openFixtureEditor(fixture.id)}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                    >
                      Editar
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {totalCount > 0 ? (
          <nav className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-white/50">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 disabled:opacity-35 sm:flex-none"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 disabled:opacity-35 sm:flex-none"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Seguinte
              </button>
              <select
                className="rounded-lg border border-white/10 bg-[#08132f] px-2 py-2 text-sm text-white/70"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value) || 20);
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}/pág.
                  </option>
                ))}
              </select>
            </div>
          </nav>
        ) : null}

        {/* Criar jogo */}
        <Drawer
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Novo jogo"
          description="Preenche apenas os dados essenciais. O jogo fica imediatamente disponível no Backoffice."
          footer={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void createFixture()}
                disabled={creating || hasCreateErrors}
                className="flex-[1.4] rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? 'A criar…' : 'Criar jogo'}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {hasCreateErrors ? (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2 text-sm text-amber-100/80">
                Preenche competição, ronda, equipas e kickoff.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Competição *">
                <select
                  className={inputClass}
                  value={newFx.competition_id ?? ''}
                  onChange={(event) =>
                    setNewFx((current) => ({
                      ...current,
                      competition_id: event.target.value || '',
                    }))
                  }
                >
                  <option value="">Selecionar…</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>
                      {competition.code} — {competition.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ronda *" hint="Ex.: J1, F, SF">
                <input
                  className={`${inputClass} uppercase`}
                  maxLength={3}
                  value={newFx.round_label ?? ''}
                  onChange={(event) =>
                    setNewFx((current) => ({
                      ...current,
                      round_label: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Equipa da casa *">
                <input
                  list="teams-list"
                  className={inputClass}
                  placeholder="Começa a escrever…"
                  value={homeSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setHomeSearch(value);
                    const team = teams.find(
                      (item) => item.name.toLowerCase() === value.toLowerCase(),
                    );
                    setNewFx((current) => ({
                      ...current,
                      home_team_id: team?.id ?? '',
                    }));
                  }}
                />
              </Field>

              <Field label="Equipa visitante *">
                <input
                  list="teams-list"
                  className={inputClass}
                  placeholder="Começa a escrever…"
                  value={awaySearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAwaySearch(value);
                    const team = teams.find(
                      (item) => item.name.toLowerCase() === value.toLowerCase(),
                    );
                    setNewFx((current) => ({
                      ...current,
                      away_team_id: team?.id ?? '',
                    }));
                  }}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data *">
                <input
                  type="date"
                  className={inputClass}
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              </Field>
              <Field label="Hora *">
                <input
                  type="time"
                  step={60}
                  className={inputClass}
                  value={newTime}
                  onChange={(event) => setNewTime(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mão">
                <select
                  className={inputClass}
                  value={newFx.leg_number ?? ''}
                  onChange={(event) =>
                    setNewFx((current) => ({
                      ...current,
                      leg_number:
                        event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                >
                  <option value="">Sem mão</option>
                  <option value="1">1.ª mão</option>
                  <option value="2">2.ª mão</option>
                </select>
              </Field>
              <Field label="Estado">
                <select
                  className={inputClass}
                  value={newFx.status}
                  onChange={(event) =>
                    setNewFx((current) => ({
                      ...current,
                      status: event.target.value as 'SCHEDULED' | 'FINISHED',
                    }))
                  }
                >
                  <option value="SCHEDULED">Agendado</option>
                  <option value="FINISHED">Terminado</option>
                </select>
              </Field>
            </div>
          </div>
        </Drawer>

        {/* Filtros */}
        <Drawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          title="Filtros"
          description="Refina a lista sem ocupar espaço no ecrã principal."
          widthClass="max-w-md"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/75"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white"
              >
                Ver {totalCount} {totalCount === 1 ? 'jogo' : 'jogos'}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <Field label="Competição">
              <select
                className={inputClass}
                value={compFilter}
                onChange={(event) => setCompFilter(event.target.value)}
              >
                <option value="">Todas as competições</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.code}>
                    {competition.code} — {competition.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estado">
              <select
                className={inputClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Todos os estados</option>
                <option value="SCHEDULED">Agendados</option>
                <option value="FINISHED">Terminados</option>
              </select>
            </Field>

            <Field label="Ordenação">
              <select
                className={inputClass}
                value={sortField ? `${sortField}:${sortDir}` : ''}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setSortField('');
                    setSortDir('asc');
                    return;
                  }
                  const [field, direction] = value.split(':') as [
                    'comp' | 'ronda' | 'kickoff',
                    'asc' | 'desc',
                  ];
                  setSortField(field);
                  setSortDir(direction);
                }}
              >
                <option value="">Ordem atual</option>
                <option value="kickoff:asc">Kickoff — mais próximo</option>
                <option value="kickoff:desc">Kickoff — mais distante</option>
                <option value="comp:asc">Competição — A a Z</option>
                <option value="ronda:asc">Ronda — crescente</option>
                <option value="ronda:desc">Ronda — decrescente</option>
              </select>
            </Field>

            <Link
              href="/admin/teams"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 hover:bg-white/10"
            >
              Gerir equipas <span>→</span>
            </Link>
          </div>
        </Drawer>

        {/* Editar jogo */}
        <Drawer
          open={Boolean(editingFixture)}
          onClose={() => setEditingFixtureId(null)}
          title={
            editingFixture
              ? `${editingFixture.home_name ?? teamById.get(editingFixture.home_team_id)?.name ?? 'Casa'} vs ${editingFixture.away_name ?? teamById.get(editingFixture.away_team_id)?.name ?? 'Visitante'}`
              : 'Editar jogo'
          }
          description={editingFixture ? `${fixtureDateLabel(editingFixture.kickoff_at)} · As alterações são guardadas automaticamente.` : undefined}
          footer={
            <button
              type="button"
              onClick={() => setEditingFixtureId(null)}
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white"
            >
              Concluir edição
            </button>
          }
        >
          {editingFixture ? (() => {
            const fixture = editingFixture;
            const isFinished = fixture.status === 'FINISHED';
            const lockClass = isFinished ? 'opacity-55' : '';
            const resultOK =
              fixture._hs !== '' &&
              fixture._as !== '' &&
              !Number.isNaN(Number(fixture._hs)) &&
              !Number.isNaN(Number(fixture._as));
            const local = splitLocal(toLocalDTValue(fixture.kickoff_at));
            const selectedScorers = scorersByFixture[fixture.id] ?? [];
            const selectedNames = selectedScorers
              .map((id) => playerById.get(id)?.name)
              .filter((name): name is string => Boolean(name));

            return (
              <div className="space-y-5">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">Informação do jogo</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(fixture.status)}`}>
                      {statusLabel(fixture.status)}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Competição">
                      <select
                        className={`${inputClass} ${lockClass}`}
                        value={fixture.competition_id ?? ''}
                        disabled={isFinished}
                        onChange={(event) =>
                          void updateField(fixture.id, {
                            competition_id: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Sem competição</option>
                        {competitions.map((competition) => (
                          <option key={competition.id} value={competition.id}>
                            {competition.code} — {competition.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Ronda">
                      <input
                        className={`${inputClass} uppercase ${lockClass}`}
                        defaultValue={fixture.round_label ?? ''}
                        maxLength={3}
                        disabled={isFinished}
                        onBlur={(event) =>
                          void updateField(fixture.id, {
                            round_label: event.target.value
                              ? event.target.value.toUpperCase().slice(0, 3)
                              : null,
                          })
                        }
                      />
                    </Field>

                    <Field label="Mão">
                      <select
                        className={`${inputClass} ${lockClass}`}
                        value={fixture.leg_number ?? ''}
                        disabled={isFinished}
                        onChange={(event) =>
                          void updateField(fixture.id, {
                            leg_number:
                              event.target.value === '' ? null : Number(event.target.value),
                          })
                        }
                      >
                        <option value="">Sem mão</option>
                        <option value="1">1.ª mão</option>
                        <option value="2">2.ª mão</option>
                      </select>
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Equipa da casa">
                      <select
                        className={`${inputClass} ${lockClass}`}
                        value={fixture.home_team_id}
                        disabled={isFinished}
                        onChange={(event) =>
                          void updateField(fixture.id, {
                            home_team_id: event.target.value,
                          })
                        }
                      >
                        {orderedTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Equipa visitante">
                      <select
                        className={`${inputClass} ${lockClass}`}
                        value={fixture.away_team_id}
                        disabled={isFinished}
                        onChange={(event) =>
                          void updateField(fixture.id, {
                            away_team_id: event.target.value,
                          })
                        }
                      >
                        {orderedTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Data">
                      <input
                        key={`date-${fixture.id}-${fixture.kickoff_at}`}
                        type="date"
                        defaultValue={local.date}
                        disabled={isFinished}
                        className={`${inputClass} ${lockClass}`}
                        onBlur={(event) => {
                          const date = event.currentTarget.value || local.date;
                          const time =
                            (
                              event.currentTarget
                                .closest('section')
                                ?.querySelector(`input[data-time-for="${fixture.id}"]`) as HTMLInputElement | null
                            )?.value || local.time;
                          const kickoffAt = fromLocalDTValue(joinLocal(date, time));
                          if (kickoffAt && kickoffAt !== fixture.kickoff_at) {
                            void updateField(fixture.id, { kickoff_at: kickoffAt });
                          }
                        }}
                      />
                    </Field>
                    <Field label="Hora">
                      <input
                        key={`time-${fixture.id}-${fixture.kickoff_at}`}
                        data-time-for={fixture.id}
                        type="time"
                        step={60}
                        defaultValue={local.time}
                        disabled={isFinished}
                        className={`${inputClass} ${lockClass}`}
                        onBlur={(event) => {
                          const time = event.currentTarget.value || local.time;
                          const date =
                            (
                              event.currentTarget
                                .closest('section')
                                ?.querySelector('input[type="date"]') as HTMLInputElement | null
                            )?.value || local.date;
                          const kickoffAt = fromLocalDTValue(joinLocal(date, time));
                          if (kickoffAt && kickoffAt !== fixture.kickoff_at) {
                            void updateField(fixture.id, { kickoff_at: kickoffAt });
                          }
                        }}
                      />
                    </Field>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-white">Resultado</h3>
                    <p className="mt-1 text-xs text-white/45">
                      Preenche o resultado e termina o jogo quando estiver confirmado.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <input
                      inputMode="numeric"
                      className="h-14 w-20 rounded-xl border border-white/15 bg-black/30 text-center text-2xl font-bold text-white outline-none focus:border-sky-400/55 disabled:opacity-55"
                      placeholder="H"
                      value={fixture._hs === '' ? '' : String(fixture._hs ?? '')}
                      disabled={isFinished}
                      onChange={(event) => setLocalScore(fixture.id, '_hs', event.target.value)}
                      onBlur={(event) => {
                        const value = event.target.value;
                        if (value === '' || Number.isNaN(Number(value))) return;
                        void updateField(fixture.id, { home_score: Number(value) });
                      }}
                    />
                    <span className="text-xl text-white/35">–</span>
                    <input
                      inputMode="numeric"
                      className="h-14 w-20 rounded-xl border border-white/15 bg-black/30 text-center text-2xl font-bold text-white outline-none focus:border-sky-400/55 disabled:opacity-55"
                      placeholder="A"
                      value={fixture._as === '' ? '' : String(fixture._as ?? '')}
                      disabled={isFinished}
                      onChange={(event) => setLocalScore(fixture.id, '_as', event.target.value)}
                      onBlur={(event) => {
                        const value = event.target.value;
                        if (value === '' || Number.isNaN(Number(value))) return;
                        void updateField(fixture.id, { away_score: Number(value) });
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    {isFinished ? (
                      <button
                        type="button"
                        onClick={() => void reopenFixture(fixture.id)}
                        className="w-full rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-300/12"
                      >
                        Reabrir jogo
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!resultOK}
                        onClick={() =>
                          void finishFixture(
                            fixture.id,
                            Number(fixture._hs),
                            Number(fixture._as),
                          )
                        }
                        className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Marcar como terminado
                      </button>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">Marcadores do FC Porto</h3>
                      {selectedNames.length ? (
                        <p className="mt-1 text-sm leading-5 text-white/55">
                          {selectedNames.join(', ')}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-white/45">Nenhum marcador selecionado.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void openScorerEditor(fixture.id)}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
                    >
                      Alterar
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.035] p-4">
                  <h3 className="font-semibold text-white">Zona de risco</h3>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    A eliminação do jogo pode remover previsões e dados relacionados.
                  </p>
                  <button
                    type="button"
                    onClick={() => void deleteFixture(fixture.id)}
                    className="mt-3 rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-300/12"
                  >
                    Apagar jogo
                  </button>
                </section>
              </div>
            );
          })() : null}
        </Drawer>

        {/* Selecionar marcadores */}
        <Drawer
          open={Boolean(scorerTargetId)}
          onClose={() => setScorerTargetId(null)}
          title="Marcadores"
          description={
            scorerTargetFixture
              ? `${scorerTargetFixture.home_name ?? teamById.get(scorerTargetFixture.home_team_id)?.name ?? 'Casa'} vs ${scorerTargetFixture.away_name ?? teamById.get(scorerTargetFixture.away_team_id)?.name ?? 'Visitante'}`
              : undefined
          }
          widthClass="max-w-xl"
          zClass="z-[110]"
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setScorerTargetId(null)}
                className="flex-1 rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/75"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveScorerDraft()}
                disabled={savingScorers}
                className="flex-[1.4] rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
              >
                {savingScorers
                  ? 'A guardar…'
                  : scorerDraft.length
                    ? `Guardar ${scorerDraft.length} marcador${scorerDraft.length === 1 ? '' : 'es'}`
                    : 'Guardar sem marcadores'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <input
              className={inputClass}
              placeholder="Pesquisar jogador…"
              value={scorerSearch}
              onChange={(event) => setScorerSearch(event.target.value)}
            />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                ['', 'Todos'],
                ['GR', 'GR'],
                ['D', 'Defesas'],
                ['M', 'Médios'],
                ['A', 'Avançados'],
              ].map(([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  onClick={() => setScorerPosition(value)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
                    scorerPosition === value
                      ? 'border-sky-400/30 bg-sky-400/15 text-sky-100'
                      : 'border-white/10 bg-white/5 text-white/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scorerDraft.length ? (
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-100/65">
                  Selecionados · {scorerDraft.length}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {scorerDraft.map((id) => {
                    const player = playerById.get(id);
                    if (!player) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleDraftScorer(id)}
                        className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-50"
                      >
                        {player.name} ×
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {loadingScorers ? (
              <div className="py-8 text-center text-sm text-white/50">A carregar…</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/50">Sem jogadores encontrados.</div>
            ) : (
              <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10">
                {filteredPlayers.map((player) => {
                  const selected = scorerDraft.includes(player.id);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => toggleDraftScorer(player.id)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition ${
                        selected ? 'bg-sky-400/10' : 'bg-black/15 hover:bg-white/[0.035]'
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${
                          selected
                            ? 'border-sky-400 bg-sky-400 text-slate-950'
                            : 'border-white/20 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{player.name}</span>
                        <span className="text-xs text-white/45">{player.position}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Drawer>

        {msg ? (
          <div className="fixed bottom-5 left-1/2 z-[130] -translate-x-1/2 rounded-full border border-white/10 bg-slate-900/95 px-4 py-2 text-sm text-white shadow-xl backdrop-blur">
            {msg}
          </div>
        ) : null}
      </main>
    </AdminGate>
  );
}
