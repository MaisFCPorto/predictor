'use client';

import { useEffect, useState } from 'react';
import {
  fanRequest, fixtureMeta, fixtureTitle, positionName,
  type FanPlayer, type MatchBallot, type RatingRank, type RatingsData,
} from '@/features/hub/fan-data';
import { FanTool } from '@/features/hub/fan-tool';
import styles from '@/features/hub/fan-tools.module.css';

const scoreFormat = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const voteFormat = new Intl.NumberFormat('pt-PT');
const scores = Array.from({ length: 10 }, (_, index) => index + 1);
const maxPlayers = 23;

function Ranking({ season, players }: { season: string; players: RatingRank[] }) {
  const [sort, setSort] = useState<'adjusted' | 'average'>('adjusted');
  const ranking = [...players].sort((a, b) => b[sort] - a[sort] || b.matches - a.matches || a.name.localeCompare(b.name, 'pt'));
  const leader = ranking[0];

  return (
    <section aria-labelledby="ranking-heading">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.eyebrow}>{season}</p>
          <h2 id="ranking-heading">Ranking da época</h2>
        </div>
        <label className={styles.fieldLabel}>
          Ordenar por
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="adjusted">Média ajustada</option>
            <option value="average">Média dos adeptos</option>
          </select>
        </label>
      </div>
      {leader ? (
        <>
          <div className={styles.leader}>
            <div>
              <p className={styles.eyebrow}>Líder da época</p>
              <h3>{leader.name}</h3>
              <p className={styles.muted}>{leader.matches} {leader.matches === 1 ? 'jogo avaliado' : 'jogos avaliados'}</p>
            </div>
            <strong>{scoreFormat.format(leader[sort])}<small>/10</small></strong>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" aria-label="Lugar">#</th>
                <th scope="col">Jogador</th>
                <th scope="col">Jogos</th>
                <th scope="col">Nota</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <th scope="row">{player.name}<small>{positionName(player.position)}</small></th>
                  <td>{player.matches}<small>{voteFormat.format(player.votes)} {player.votes === 1 ? 'voto' : 'votos'}</small></td>
                  <td className={styles.score}>{scoreFormat.format(player[sort])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details className={styles.method}>
            <summary>Como se calcula a média ajustada?</summary>
            <p>Cada jogo conta uma vez na média do jogador. Na nota ajustada, a média global da época pesa o equivalente a cinco jogos. Quanto mais jogos o jogador tiver, mais pesa a sua própria média.</p>
          </details>
        </>
      ) : (
        <p className={styles.empty}>O ranking aparece assim que forem registadas as primeiras notas.</p>
      )}
    </section>
  );
}

type Save = (method: 'POST' | 'PUT', body: unknown) => Promise<void>;

function SelectParticipants({ roster, saving, save }: { roster: FanPlayer[]; saving: boolean; save: Save }) {
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); void save('POST', { players: selected }); }}>
      <fieldset disabled={saving}>
        <legend>Quem jogou?</legend>
        <p className={styles.muted}>Marca os titulares e os suplentes que entraram em campo. A votação abre para estes jogadores.</p>
        <div className={styles.participants}>
          {roster.map((player) => (
            <label key={player.id}>
              <input type="checkbox" checked={selected.includes(player.id)}
                disabled={selected.length >= maxPlayers && !selected.includes(player.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((current) => checked ? [...current, player.id] : current.filter((id) => id !== player.id));
                }}
              />
              <span>{player.name}<small>{positionName(player.position)}</small></span>
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={selected.length < 11}>Abrir votação</button>
          <span className={styles.muted}>{selected.length} escolhidos · mínimo 11</span>
        </div>
      </fieldset>
    </form>
  );
}

function MatchVotes({ eligible, saving, save }: { eligible: MatchBallot['eligible']; saving: boolean; save: Save }) {
  const [draft, setDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(eligible.map((player) => [player.id, String(player.mine ?? '')])));
  const changed = eligible.some((player) => draft[player.id] !== String(player.mine ?? ''));

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const ratings = eligible.filter((player) => draft[player.id]).map((player) => ({
        playerId: player.id, rating: Number(draft[player.id]),
      }));
      void save('PUT', { ratings });
    }}>
      <fieldset disabled={saving}>
        <legend>As tuas notas</legend>
        <p className={styles.muted}>Dá uma nota de 1 a 10 aos jogadores que quiseres avaliar.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Jogador</th>
              <th scope="col">Tua nota</th>
              <th scope="col">Média</th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((player) => (
              <tr key={player.id}>
                <th scope="row">{player.name}<small>{positionName(player.position)}</small></th>
                <td>
                  <select aria-label={`Nota para ${player.name}`} value={draft[player.id]}
                    onChange={(event) => setDraft({ ...draft, [player.id]: event.target.value })}>
                    <option value="">–</option>
                    {scores.map((rating) => <option key={rating}>{rating}</option>)}
                  </select>
                </td>
                <td className={styles.score}>
                  {player.average === null ? '–' : scoreFormat.format(player.average)}
                  {player.votes > 0 && <small>{voteFormat.format(player.votes)} {player.votes === 1 ? 'voto' : 'votos'}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className={styles.primary} type="submit" disabled={!changed}>Guardar notas</button>
      </fieldset>
    </form>
  );
}

function MatchPanel({ fixtureId, onSave }: { fixtureId: string; onSave: () => Promise<void> }) {
  const suffix = `/notas?${new URLSearchParams({ jogo: fixtureId })}`;
  const [ballot, setBallot] = useState<MatchBallot>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fanRequest<MatchBallot>(suffix, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setBallot(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [suffix, retry]);

  const save: Save = async (method, body) => {
    setSaving(true);
    setMessage('');
    try {
      await fanRequest(suffix, { method, body });
      const [match, ranking] = await Promise.allSettled([fanRequest<MatchBallot>(suffix), onSave()]);
      if (match.status === 'fulfilled') setBallot(match.value);
      setMessage(match.status === 'rejected' || ranking.status === 'rejected'
        ? 'Guardado. Recarrega a página para ver os dados atualizados.'
        : method === 'POST' ? 'Votação aberta.' : 'Notas guardadas.');
    } catch (err) {
      if (err instanceof Error && err.message === 'already_open') {
        setMessage('A votação já foi aberta. Recarrega a página para ver os jogadores.');
      } else {
        setMessage('Houve um erro ao guardar. Tenta novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (error) return (
    <div className={styles.empty}>
      <p>Houve um erro ao carregar o jogo.</p>
      <button className={styles.plain} type="button" onClick={() => { setError(false); setRetry(retry + 1); }}>Tentar de novo</button>
    </div>
  );
  if (!ballot) return <p className={styles.empty} role="status">A carregar o jogo…</p>;

  return (
    <div className={styles.ballot}>
      <div className={styles.matchHeading}>
        <h3>{fixtureTitle(ballot.fixture)}</h3>
        <p className={styles.muted}>{fixtureMeta(ballot.fixture)}</p>
      </div>
      {ballot.eligible.length
        ? <MatchVotes eligible={ballot.eligible} saving={saving} save={save} />
        : <SelectParticipants roster={ballot.roster} saving={saving} save={save} />}
      <p className={styles.message} role="status">{saving ? 'A guardar…' : message}</p>
    </div>
  );
}

function RatingsBoard({ initial }: { initial: RatingsData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<'ranking' | 'vote'>('ranking');
  const [fixture, setFixture] = useState(() => initial.fixtures.find((game) => game.opened)?.id ?? initial.fixtures[0]?.id ?? '');

  async function refresh() {
    setData(await fanRequest<RatingsData>('/notas'));
  }

  return (
    <>
      <div className={styles.tabs} role="group" aria-label="Área de notas">
        <button type="button" aria-pressed={view === 'ranking'} onClick={() => setView('ranking')}>Ranking</button>
        <button type="button" aria-pressed={view === 'vote'} onClick={() => setView('vote')}>Votar num jogo</button>
      </div>
      {view === 'ranking' ? <Ranking season={data.season} players={data.ranking} /> : (
        <section aria-labelledby="vote-heading">
          <div className={styles.sectionHead}>
            <h2 id="vote-heading">Notas por jogo</h2>
            {data.fixtures.length > 0 && (
              <label className={styles.fieldLabel}>
                Jogo terminado
                <select value={fixture} onChange={(event) => setFixture(event.target.value)}>
                  {data.fixtures.map((game) => <option key={game.id} value={game.id}>{fixtureTitle(game)}</option>)}
                </select>
              </label>
            )}
          </div>
          {fixture
            ? <MatchPanel key={fixture} fixtureId={fixture} onSave={refresh} />
            : <p className={styles.empty}>Os jogos do FC Porto ficam disponíveis aqui quando terminam no Predictor.</p>}
        </section>
      )}
    </>
  );
}

export default function Ratings() {
  return (
    <FanTool<RatingsData> area="notas" title="Notas dos adeptos" description="Avalia os jogadores do FC Porto após cada jogo e acompanha o ranking da época.">
      {(data) => <RatingsBoard initial={data} />}
    </FanTool>
  );
}
