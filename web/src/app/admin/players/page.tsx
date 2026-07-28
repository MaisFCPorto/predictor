'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminGate from '../_components/AdminGate';
import { adm } from '../_utils/adminClients';

type Position = 'GR' | 'D' | 'M' | 'A';

type Player = {
  id: number;
  team_id: string;
  name: string;
  position: Position;
  is_active: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type EditablePlayer = Player & {
  _team: string;
  _name: string;
  _position: Position;
  _active: boolean;
  saving?: boolean;
};

const POSITION_LABELS: Record<Position, string> = {
  GR: 'Guarda-redes',
  D: 'Defesa',
  M: 'Médio',
  A: 'Avançado',
};

function errorMessage(error: unknown) {
  const e = error as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.error ||
    e?.message ||
    'Ocorreu um erro.'
  );
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<EditablePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<'' | Position>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    team_id: 'fcp',
    name: '',
    position: 'M' as Position,
    is_active: true,
    creating: false,
  });

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1800);
  };

  async function loadPlayers() {
    setLoading(true);
    try {
      const { data } = await adm.get<Player[]>(
        '/api/admin/players?team_id=fcp&include_inactive=1',
        { headers: { 'cache-control': 'no-store' } },
      );

      setPlayers(
        (Array.isArray(data) ? data : []).map((player) => ({
          ...player,
          _team: player.team_id,
          _name: player.name,
          _position: player.position,
          _active: player.is_active === 1,
        })),
      );
    } catch (error) {
      alert(errorMessage(error));
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlayers();
  }, []);

  async function createPlayer() {
    if (!newPlayer.name.trim()) {
      alert('O nome do jogador é obrigatório.');
      return;
    }

    setNewPlayer((current) => ({ ...current, creating: true }));
    try {
      await adm.post('/api/admin/players', {
        team_id: newPlayer.team_id.trim() || 'fcp',
        name: newPlayer.name.trim(),
        position: newPlayer.position,
        is_active: newPlayer.is_active,
      });
      setNewPlayer({
        team_id: 'fcp',
        name: '',
        position: 'M',
        is_active: true,
        creating: false,
      });
      notify('Jogador criado ✅');
      await loadPlayers();
    } catch (error) {
      alert(errorMessage(error));
      setNewPlayer((current) => ({ ...current, creating: false }));
    }
  }

  async function savePlayer(player: EditablePlayer) {
    setPlayers((current) =>
      current.map((item) =>
        item.id === player.id ? { ...item, saving: true } : item,
      ),
    );

    try {
      await adm.patch(`/api/admin/players/${player.id}`, {
        team_id: player._team.trim() || 'fcp',
        name: player._name.trim(),
        position: player._position,
        is_active: player._active,
      });
      notify('Jogador atualizado ✅');
      await loadPlayers();
    } catch (error) {
      alert(errorMessage(error));
      setPlayers((current) =>
        current.map((item) =>
          item.id === player.id ? { ...item, saving: false } : item,
        ),
      );
    }
  }

  async function toggleActive(player: EditablePlayer) {
    const next = !player._active;
    setPlayers((current) =>
      current.map((item) =>
        item.id === player.id ? { ...item, _active: next } : item,
      ),
    );

    try {
      await adm.patch(`/api/admin/players/${player.id}`, { is_active: next });
      notify(next ? 'Jogador ativado ✅' : 'Jogador desativado');
      await loadPlayers();
    } catch (error) {
      alert(errorMessage(error));
      await loadPlayers();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesQuery =
        !q ||
        player._name.toLowerCase().includes(q) ||
        player._team.toLowerCase().includes(q) ||
        String(player.id).includes(q);
      const matchesPosition =
        !positionFilter || player._position === positionFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? player._active : !player._active);
      return matchesQuery && matchesPosition && matchesStatus;
    });
  }, [players, query, positionFilter, statusFilter]);

  const activeCount = players.filter((player) => player._active).length;
  const inactiveCount = players.length - activeCount;

  return (
    <AdminGate>
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <title>+Predictor - Admin Jogadores</title>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Jogadores</h1>
          <p className="max-w-3xl text-sm text-white/65">
            Gere o plantel disponível no seletor de marcadores. Desativar um
            jogador preserva todos os palpites e marcadores históricos.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Total" value={players.length} />
          <SummaryCard label="Ativos" value={activeCount} />
          <SummaryCard label="Inativos" value={inactiveCount} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Adicionar jogador</h2>
            <p className="text-xs text-white/55">
              O ID é gerado automaticamente pela base de dados.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[130px_1fr_170px_140px_auto] md:items-end">
            <Field label="Equipa">
              <input
                className="admin-input"
                value={newPlayer.team_id}
                onChange={(event) =>
                  setNewPlayer((current) => ({
                    ...current,
                    team_id: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Nome">
              <input
                className="admin-input"
                placeholder="Nome do jogador"
                value={newPlayer.name}
                onChange={(event) =>
                  setNewPlayer((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Posição">
              <PositionSelect
                value={newPlayer.position}
                onChange={(position) =>
                  setNewPlayer((current) => ({ ...current, position }))
                }
              />
            </Field>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-sm">
              <input
                type="checkbox"
                checked={newPlayer.is_active}
                onChange={(event) =>
                  setNewPlayer((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              Ativo
            </label>
            <button
              type="button"
              className="primary-button h-10"
              disabled={newPlayer.creating}
              onClick={() => void createPlayer()}
            >
              {newPlayer.creating ? 'A criar…' : 'Adicionar'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
            <input
              className="admin-input min-w-[220px] flex-1"
              placeholder="Pesquisar jogador…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="admin-input w-auto"
              value={positionFilter}
              onChange={(event) =>
                setPositionFilter(event.target.value as '' | Position)
              }
            >
              <option value="">Todas as posições</option>
              {Object.entries(POSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="admin-input w-auto"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as 'all' | 'active' | 'inactive',
                )
              }
            >
              <option value="all">Todos os estados</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">
              A carregar jogadores…
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Sem jogadores para mostrar.</strong>
                <span>Altera os filtros ou adiciona um novo jogador.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((player) => (
                <article
                  key={player.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 md:grid-cols-[70px_120px_1fr_180px_130px_auto] md:items-end"
                >
                  <div>
                    <div className="admin-field-label">ID</div>
                    <div className="flex h-10 items-center font-mono text-sm text-white/60">
                      {player.id}
                    </div>
                  </div>
                  <Field label="Equipa">
                    <input
                      className="admin-input"
                      value={player._team}
                      onChange={(event) =>
                        setPlayers((current) =>
                          current.map((item) =>
                            item.id === player.id
                              ? { ...item, _team: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Nome">
                    <input
                      className="admin-input"
                      value={player._name}
                      onChange={(event) =>
                        setPlayers((current) =>
                          current.map((item) =>
                            item.id === player.id
                              ? { ...item, _name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Posição">
                    <PositionSelect
                      value={player._position}
                      onChange={(position) =>
                        setPlayers((current) =>
                          current.map((item) =>
                            item.id === player.id
                              ? { ...item, _position: position }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => void toggleActive(player)}
                    className={
                      player._active
                        ? 'h-10 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-sm text-emerald-100'
                        : 'h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/55'
                    }
                  >
                    {player._active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button h-10"
                    disabled={player.saving || !player._name.trim()}
                    onClick={() => void savePlayer(player)}
                  >
                    {player.saving ? 'A guardar…' : 'Guardar'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {message && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/95 px-4 py-2 text-sm shadow-xl">
            {message}
          </div>
        )}
      </main>
    </AdminGate>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-xs uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  );
}

function PositionSelect({
  value,
  onChange,
}: {
  value: Position;
  onChange: (position: Position) => void;
}) {
  return (
    <select
      className="admin-input"
      value={value}
      onChange={(event) => onChange(event.target.value as Position)}
    >
      {Object.entries(POSITION_LABELS).map(([position, label]) => (
        <option key={position} value={position}>
          {position} · {label}
        </option>
      ))}
    </select>
  );
}
