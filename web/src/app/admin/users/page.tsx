'use client';

import { useEffect, useMemo, useState } from 'react';
import axios, { AxiosError } from 'axios';
import AdminGate from '../_components/AdminGate';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const adm = axios.create({
  baseURL: '',
});

adm.interceptors.request.use((config) => {
  if (ADMIN_KEY) {
    config.headers = config.headers ?? {};
    (config.headers as any)['x-admin-key'] = ADMIN_KEY;
  }
  return config;
});

adm.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) alert('Sessão expirada ou em falta. Faz login novamente.');
    if (status === 403) alert('Acesso negado (precisas de ser admin).');
    return Promise.reject(error);
  },
);

/* -------------------- Tipos -------------------- */

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_login: string | null;
};

type EditableUser = {
  name: string;
  email: string;
  avatar_url: string;
  role: string;
};

/* -------------------- Utils -------------------- */

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro';
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* =============================================================== */

function AdminUsersInner() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditableUser | null>(null);

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1500);
  };

  /* -------------------- Loaders -------------------- */

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await adm.get<UserRow[]>('/api/admin/users', {
        headers: { 'cache-control': 'no-store' },
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(errorMessage(e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  /* -------------------- Mutations -------------------- */

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditDraft({
      name: user.name ?? '',
      email: user.email ?? '',
      avatar_url: user.avatar_url ?? '',
      role: user.role ?? 'user',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    try {
      await adm.patch(
        `/api/admin/users/${id}`,
        {
          name: editDraft.name.trim() || null,
          email: editDraft.email.trim() || null,
          avatar_url: editDraft.avatar_url.trim() || null,
          role: editDraft.role.trim() || null,
        },
        { headers: { 'cache-control': 'no-store' } },
      );
      notify('Utilizador atualizado ✅');
      setEditingId(null);
      setEditDraft(null);
      await loadUsers();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function toggleRole(user: UserRow) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await adm.patch(
        `/api/admin/users/${user.id}`,
        { role: nextRole },
        { headers: { 'cache-control': 'no-store' } },
      );
      notify(
        nextRole === 'admin'
          ? 'Utilizador promovido a admin ✅'
          : 'Utilizador definido como user ✅',
      );
      await loadUsers();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function deleteUser(user: UserRow) {
    const confirm = prompt(
      `Para apagar o utilizador "${user.name ?? user.email ?? user.id}" escreve: APAGAR`,
    );
    if (confirm !== 'APAGAR') return;

    try {
      await adm.delete(`/api/admin/users/${user.id}`, {
        headers: { 'cache-control': 'no-store' },
      });
      notify('Utilizador apagado ✅');
      await loadUsers();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  /* -------------------- Filtragem -------------------- */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const inRole = !roleFilter || (u.role ?? 'user') === roleFilter;
      const inQuery =
        !q ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);
      return inRole && inQuery;
    });
  }, [users, query, roleFilter]);

  const totalAdmins = useMemo(
    () => users.filter((u) => (u.role ?? 'user') === 'admin').length,
    [users],
  );

  const totalUsers = users.length;

  /* -------------------- Render -------------------- */

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <title>+Predictor - Admin Utilizadores</title>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Backoffice — Utilizadores</h1>
          <p className="text-sm text-white/60">
            Lista e gestão de contas (nome, email, role, últimos acessos).
          </p>
        </div>
      </div>

      {/* Erro global */}
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Erro: {error}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Total de contas
          </div>
          <div className="text-xl font-semibold">{totalUsers}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Admins
          </div>
          <div className="text-xl font-semibold">{totalAdmins}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Filtro atual
          </div>
          <div className="text-sm font-medium">
            {roleFilter
              ? roleFilter === 'admin'
                ? 'Apenas admins'
                : 'Apenas users'
              : 'Todos'}
          </div>
        </div>
      </div>

      {/* Filtros topo (mesma vibe dos fixtures) */}
      <div className="flex flex-wrap items-center gap-2 bg-card/15 border border-white/10 rounded-2xl p-3">
        <select
          className="rounded border border-white/10 bg-black/20 px-2 py-1 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Todos os roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>

        <div className="flex-1" />

        <input
          className="rounded border border-white/10 bg-black/20 px-3 py-2 w-full max-w-xs text-sm"
          placeholder="Pesquisar por nome, email ou ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          onClick={() => {
            setQuery('');
            setRoleFilter('');
          }}
        >
          Limpar filtros
        </button>
      </div>

      {/* Tabela de utilizadores */}
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Lista de utilizadores</h2>
          {loading && (
            <span className="text-xs text-white/60">A carregar…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-black/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Nome
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Email
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Role
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Último login
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Criado em
                </th>
                <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-white/50">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-white/60"
                  >
                    Nenhum utilizador corresponde aos filtros.
                  </td>
                </tr>
              )}

              {filtered.map((u, idx) => {
                const isEditing = editingId === u.id;
                const draft = editDraft || {
                  name: u.name ?? '',
                  email: u.email ?? '',
                  avatar_url: u.avatar_url ?? '',
                  role: u.role ?? 'user',
                };

                return (
                  <tr
                    key={u.id}
                    className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/10'}
                  >
                    {/* Nome */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          className="rounded border border-white/10 bg-black/30 px-2 py-1 text-sm w-full"
                          value={draft.name}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...(prev ?? draft),
                              name: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span>{u.name || <span className="opacity-60">Sem nome</span>}</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          className="rounded border border-white/10 bg-black/30 px-2 py-1 text-sm w-full"
                          value={draft.email}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...(prev ?? draft),
                              email: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span>{u.email || <span className="opacity-60">Sem email</span>}</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                          value={draft.role}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...(prev ?? draft),
                              role: e.target.value,
                            }))
                          }
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                            ((u.role ?? 'user') === 'admin'
                              ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/40'
                              : 'bg-white/5 text-white/80 border border-white/10')
                          }
                        >
                          {u.role ?? 'user'}
                        </span>
                      )}
                    </td>

                    {/* Último login */}
                    <td className="px-3 py-2 whitespace-nowrap text-white/70">
                      {formatDateTime(u.last_login)}
                    </td>

                    {/* Criado em */}
                    <td className="px-3 py-2 whitespace-nowrap text-white/70">
                      {formatDateTime(u.created_at)}
                    </td>

                    {/* Ações */}
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="rounded-full bg-emerald-500/80 px-3 py-1 text-xs hover:bg-emerald-500"
                            onClick={() => void saveEdit(u.id)}
                          >
                            Guardar
                          </button>
                          <button
                            className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
                            onClick={cancelEdit}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
                            onClick={() => startEdit(u)}
                          >
                            Editar
                          </button>
                          <button
                            className="rounded-full bg-sky-500/80 px-3 py-1 text-xs hover:bg-sky-500"
                            onClick={() => void toggleRole(u)}
                          >
                            {(u.role ?? 'user') === 'admin'
                              ? 'Tornar user'
                              : 'Tornar admin'}
                          </button>
                          <button
                            className="rounded-full bg-red-500/80 px-3 py-1 text-xs hover:bg-red-500"
                            onClick={() => void deleteUser(u)}
                          >
                            Apagar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast simples */}
      {msg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm shadow-lg">
          {msg}
        </div>
      )}
    </main>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGate>
      <AdminUsersInner />
    </AdminGate>
  );
}
