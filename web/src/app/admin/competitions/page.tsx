'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminGate from '../_components/AdminGate';
import { adm } from '../_utils/adminClients';

type Competition = {
  id: string;
  code: string;
  name: string;
  accent_color: string;
  pill_color: string;
  watermark_url: string | null;
};

type EditableCompetition = Competition & {
  _code: string;
  _name: string;
  _accent: string;
  _pill: string;
  _watermark: string;
  saving?: boolean;
};

const DEFAULT_ACCENT = '#1559E8';
const DEFAULT_PILL = '#2878FF';

function errorMessage(error: unknown) {
  const e = error as any;
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.error ||
    e?.message ||
    'Ocorreu um erro.'
  );
}

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 20);
}

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<EditableCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [newCompetition, setNewCompetition] = useState({
    id: '',
    code: '',
    name: '',
    accent_color: DEFAULT_ACCENT,
    pill_color: DEFAULT_PILL,
    watermark_url: '',
    creating: false,
  });

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 1800);
  };

  async function loadCompetitions() {
    setLoading(true);
    try {
      const { data } = await adm.get<Competition[]>('/api/admin/competitions', {
        headers: { 'cache-control': 'no-store' },
      });
      setCompetitions(
        (Array.isArray(data) ? data : []).map((competition) => ({
          ...competition,
          _code: competition.code,
          _name: competition.name,
          _accent: competition.accent_color || DEFAULT_ACCENT,
          _pill: competition.pill_color || DEFAULT_PILL,
          _watermark: competition.watermark_url || '',
        })),
      );
    } catch (error) {
      alert(errorMessage(error));
      setCompetitions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCompetitions();
  }, []);

  async function createCompetition() {
    const id = normalizeCode(newCompetition.id || newCompetition.code);
    const code = normalizeCode(newCompetition.code || newCompetition.id);
    const name = newCompetition.name.trim();

    if (!id || !code || !name) {
      alert('ID, código e nome são obrigatórios.');
      return;
    }

    setNewCompetition((current) => ({ ...current, creating: true }));
    try {
      await adm.post('/api/admin/competitions', {
        id,
        code,
        name,
        accent_color: newCompetition.accent_color,
        pill_color: newCompetition.pill_color,
        watermark_url: newCompetition.watermark_url.trim() || null,
      });
      setNewCompetition({
        id: '',
        code: '',
        name: '',
        accent_color: DEFAULT_ACCENT,
        pill_color: DEFAULT_PILL,
        watermark_url: '',
        creating: false,
      });
      notify('Competição criada ✅');
      await loadCompetitions();
    } catch (error) {
      alert(errorMessage(error));
      setNewCompetition((current) => ({ ...current, creating: false }));
    }
  }

  async function saveCompetition(competition: EditableCompetition) {
    setCompetitions((current) =>
      current.map((item) =>
        item.id === competition.id ? { ...item, saving: true } : item,
      ),
    );

    try {
      await adm.patch(`/api/admin/competitions/${competition.id}`, {
        code: normalizeCode(competition._code),
        name: competition._name.trim(),
        accent_color: competition._accent,
        pill_color: competition._pill,
        watermark_url: competition._watermark.trim() || null,
      });
      notify('Competição atualizada ✅');
      await loadCompetitions();
    } catch (error) {
      alert(errorMessage(error));
      setCompetitions((current) =>
        current.map((item) =>
          item.id === competition.id ? { ...item, saving: false } : item,
        ),
      );
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter(
      (competition) =>
        competition.id.toLowerCase().includes(q) ||
        competition._code.toLowerCase().includes(q) ||
        competition._name.toLowerCase().includes(q),
    );
  }, [competitions, query]);

  return (
    <AdminGate>
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <title>+Predictor - Admin Competições</title>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Competições</h1>
          <p className="max-w-3xl text-sm text-white/65">
            Define o nome, as cores e a imagem de fundo usada como watermark nos
            cartões de jogo. A imagem mantém o tratamento visual global do site.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Criar competição</h2>
            <p className="text-xs text-white/55">
              O ID é usado como chave na base de dados e não pode ser alterado
              depois da criação.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[120px_120px_1fr_150px_150px_auto] lg:items-end">
            <Field label="ID">
              <input
                className="admin-input font-mono uppercase"
                placeholder="LP"
                value={newCompetition.id}
                onChange={(event) =>
                  setNewCompetition((current) => ({
                    ...current,
                    id: normalizeCode(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Código">
              <input
                className="admin-input font-mono uppercase"
                placeholder="LP"
                value={newCompetition.code}
                onChange={(event) =>
                  setNewCompetition((current) => ({
                    ...current,
                    code: normalizeCode(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Nome">
              <input
                className="admin-input"
                placeholder="Liga Portugal"
                value={newCompetition.name}
                onChange={(event) =>
                  setNewCompetition((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <ColorField
              label="Cor principal"
              value={newCompetition.accent_color}
              onChange={(color) =>
                setNewCompetition((current) => ({
                  ...current,
                  accent_color: color,
                }))
              }
            />
            <ColorField
              label="Pill"
              value={newCompetition.pill_color}
              onChange={(color) =>
                setNewCompetition((current) => ({
                  ...current,
                  pill_color: color,
                }))
              }
            />
            <button
              type="button"
              className="primary-button h-10"
              disabled={newCompetition.creating}
              onClick={() => void createCompetition()}
            >
              {newCompetition.creating ? 'A criar…' : 'Criar'}
            </button>
          </div>

          <div className="mt-3">
            <Field label="PNG/SVG de fundo (URL)">
              <input
                className="admin-input"
                placeholder="https://…/competicao.png"
                value={newCompetition.watermark_url}
                onChange={(event) =>
                  setNewCompetition((current) => ({
                    ...current,
                    watermark_url: event.target.value,
                  }))
                }
              />
              <span className="mt-1 block text-[11px] text-white/45">
                Fica como watermark com baixa opacidade. Deixa vazio para não mostrar imagem.
              </span>
            </Field>
          </div>

          <div className="mt-4">
            <CompetitionPreview
              code={newCompetition.code || newCompetition.id || 'COD'}
              name={newCompetition.name || 'Nova competição'}
              accent={newCompetition.accent_color}
              pill={newCompetition.pill_color}
              watermark={newCompetition.watermark_url}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <input
              className="admin-input flex-1"
              placeholder="Pesquisar competição…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="text-xs text-white/50">
              {filtered.length} de {competitions.length}
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">
              A carregar competições…
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div>
                <strong>Sem competições para mostrar.</strong>
                <span>Altera a pesquisa ou cria uma nova competição.</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filtered.map((competition) => (
                <article
                  key={competition.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
                  style={{
                    borderTopColor: competition._accent,
                    borderTopWidth: 3,
                  }}
                >
                  <div className="space-y-4 p-4">
                    <CompetitionPreview
                      code={competition._code}
                      name={competition._name}
                      accent={competition._accent}
                      pill={competition._pill}
                      watermark={competition._watermark}
                    />

                    <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
                      <div>
                        <div className="admin-field-label">ID</div>
                        <div className="flex h-10 items-center rounded-xl border border-white/10 bg-black/20 px-3 font-mono text-sm text-white/60">
                          {competition.id}
                        </div>
                      </div>
                      <Field label="Código">
                        <input
                          className="admin-input font-mono uppercase"
                          value={competition._code}
                          onChange={(event) =>
                            setCompetitions((current) =>
                              current.map((item) =>
                                item.id === competition.id
                                  ? {
                                      ...item,
                                      _code: normalizeCode(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Nome">
                      <input
                        className="admin-input"
                        value={competition._name}
                        onChange={(event) =>
                          setCompetitions((current) =>
                            current.map((item) =>
                              item.id === competition.id
                                ? { ...item, _name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ColorField
                        label="Cor principal"
                        value={competition._accent}
                        onChange={(color) =>
                          setCompetitions((current) =>
                            current.map((item) =>
                              item.id === competition.id
                                ? { ...item, _accent: color }
                                : item,
                            ),
                          )
                        }
                      />
                      <ColorField
                        label="Cor da pill"
                        value={competition._pill}
                        onChange={(color) =>
                          setCompetitions((current) =>
                            current.map((item) =>
                              item.id === competition.id
                                ? { ...item, _pill: color }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>

                    <Field label="PNG/SVG de fundo (URL)">
                      <input
                        className="admin-input"
                        placeholder="https://…/competicao.png"
                        value={competition._watermark}
                        onChange={(event) =>
                          setCompetitions((current) =>
                            current.map((item) =>
                              item.id === competition.id
                                ? { ...item, _watermark: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <span className="mt-1 block text-[11px] text-white/45">
                        Podes usar PNG ou SVG. Vazio remove a imagem do cartão.
                      </span>
                    </Field>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="secondary-button h-10"
                        disabled={competition.saving || !competition._name.trim()}
                        onClick={() => void saveCompetition(competition)}
                      >
                        {competition.saving ? 'A guardar…' : 'Guardar alterações'}
                      </button>
                    </div>
                  </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex h-10 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <input
          type="color"
          className="h-full w-12 cursor-pointer border-0 bg-transparent p-1"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={label}
        />
        <input
          className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs uppercase outline-none"
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
    </Field>
  );
}

function CompetitionPreview({
  code,
  name,
  accent,
  pill,
  watermark,
}: {
  code: string;
  name: string;
  accent: string;
  pill: string;
  watermark: string;
}) {
  const watermarkUrl = watermark.trim();

  return (
    <div className="relative min-h-28 overflow-hidden rounded-xl border border-white/10 bg-[#07132f] p-4">
      <div
        className="absolute inset-x-0 top-0 z-20 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${accent}, ${pill}, transparent 82%)`,
        }}
      />

      {watermarkUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-contain bg-center bg-no-repeat opacity-5"
          style={{
            backgroundImage: `url('${watermarkUrl.replace(/'/g, "%27")}')`,
            filter: 'grayscale(1) brightness(0) invert(1)',
            transform: 'rotate(-8deg) scale(1.02)',
            transformOrigin: 'center',
          }}
        />
      )}

      <div className="relative z-10 flex min-h-20 flex-wrap items-start justify-between gap-3">
        <span
          className="inline-flex min-h-7 items-center rounded-lg border px-3 text-xs font-semibold text-white"
          style={{
            background: `linear-gradient(90deg, ${accent}, ${pill})`,
            borderColor: `${accent}AA`,
          }}
        >
          {name || code}
        </span>
        <span className="font-mono text-xs text-white/45">{code || 'COD'}</span>
        <div className="basis-full self-end text-[11px] text-white/40">
          Preview da barra, pill e watermark do cartão
        </div>
      </div>
    </div>
  );
}
