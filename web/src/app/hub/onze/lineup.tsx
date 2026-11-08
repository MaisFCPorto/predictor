'use client';

import { useRef, useState, type RefObject } from 'react';
import { fixtureMeta, fixtureTitle, positionName, type FanPlayer, type SquadData } from '@/features/hub/fan-data';
import { FanTool } from '@/features/hub/fan-tool';
import styles from '@/features/hub/fan-tools.module.css';

const formations = {
  '4-3-3': [['EE', 'PL', 'ED'], ['MC', 'MDC', 'MC'], ['DE', 'DC', 'DC', 'DD'], ['GR']],
  '4-2-3-1': [['PL'], ['EE', 'MO', 'ED'], ['MDC', 'MDC'], ['DE', 'DC', 'DC', 'DD'], ['GR']],
  '4-4-2': [['PL', 'PL'], ['ME', 'MC', 'MC', 'MD'], ['DE', 'DC', 'DC', 'DD'], ['GR']],
  '3-4-3': [['EE', 'PL', 'ED'], ['ME', 'MC', 'MC', 'MD'], ['DC', 'DC', 'DC'], ['GR']],
  '3-5-2': [['PL', 'PL'], ['ME', 'MC', 'MDC', 'MC', 'MD'], ['DC', 'DC', 'DC'], ['GR']],
  '5-3-2': [['PL', 'PL'], ['MC', 'MDC', 'MC'], ['DE', 'DC', 'DC', 'DC', 'DD'], ['GR']],
};

type Formation = keyof typeof formations;
type Selection = { formation: Formation; ids: (number | null)[] };
type Slot = { role: string; x: number; y: number };

const defaultFormation: Formation = '4-3-3';
const fieldWidth = 560;
const fieldHeight = 640;

function slotsFor(formation: Formation): Slot[] {
  const rows = formations[formation];
  return rows.flatMap((row, y) => row.map((role, x) => ({
    role,
    x: (x + 1) / (row.length + 1),
    y: .13 + .72 * y / (rows.length - 1),
  })));
}

function groupFor(role: string) {
  return role === 'GR' ? 'GR' : role.startsWith('D') ? 'D' : role.startsWith('M') ? 'M' : 'A';
}

function readSelection(players: FanPlayer[]): Selection {
  const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const requested = query.get('formacao');
  const formation = requested && Object.hasOwn(formations, requested) ? requested as Formation : defaultFormation;
  const ids = (query.get('jogadores') ?? '').split(',', 11).map(Number);
  const roster = new Set(players.map((player) => player.id));
  const used = new Set<number>();

  return {
    formation,
    ids: slotsFor(formation).map((_, index) => {
      const id = ids[index];
      if (!roster.has(id) || used.has(id)) return null;
      used.add(id);
      return id;
    }),
  };
}

function changeFormation(previous: Selection, formation: Formation): Selection {
  const remaining = slotsFor(previous.formation)
    .map(({ role }, index) => ({ role, id: previous.ids[index] }))
    .filter(({ id }) => id !== null);
  const slots = slotsFor(formation);
  const ids: Selection['ids'] = slots.map(() => null);

  for (const match of [
    (a: string, b: string) => a === b,
    (a: string, b: string) => groupFor(a) === groupFor(b),
    (a: string, b: string) => a !== 'GR' && b !== 'GR',
  ]) {
    slots.forEach(({ role }, index) => {
      if (ids[index] !== null) return;
      const candidate = remaining.findIndex((entry) => match(entry.role, role));
      if (candidate >= 0) ids[index] = remaining.splice(candidate, 1)[0].id;
    });
  }

  return { formation, ids };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function Pitch({ svg }: { svg: RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={svg} className={styles.field} width={fieldWidth} height={fieldHeight}
      viewBox={`0 0 ${fieldWidth} ${fieldHeight}`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width={fieldWidth} height={fieldHeight} fill="#173f35" />
      {[0, 2, 4, 6].map((row) => <rect key={row} y={row * 80} width={fieldWidth} height="80" fill="#19463a" />)}
      <g fill="none" stroke="#b4d8c6" strokeWidth="2" opacity=".55">
        <rect x="20" y="21" width="520" height="598" />
        <path d="M20 320h520M151 21v99h258V21M224 21v34h112V21M151 619v-99h258v99M224 619v-34h112v34" />
        <circle cx="280" cy="320" r="61" />
        <path d="M239 120a53 53 0 0 0 82 0M239 520a53 53 0 0 1 82 0" />
      </g>
      <g fill="#b4d8c6" opacity=".65">
        <circle cx="280" cy="320" r="3" />
        <circle cx="280" cy="88" r="3" />
        <circle cx="280" cy="552" r="3" />
      </g>
    </svg>
  );
}

async function downloadLineup(svg: SVGSVGElement, formation: Formation, players: (FanPlayer | undefined)[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const pitchUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const field = new Image();
    field.src = pitchUrl;
    await field.decode();

    const x = 55;
    const w = canvas.width - 2 * x;
    const h = w * fieldHeight / fieldWidth;
    // Keep the pitch clear of the Story controls at the top and bottom.
    const y = Math.round((canvas.height - h) / 2);
    ctx.fillStyle = '#111113';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#65b7ff';
    ctx.font = '700 26px sans-serif';
    ctx.fillText('+FCPORTO', x, y - 110);
    ctx.fillStyle = '#f3f1ee';
    ctx.font = 'bold 67px Georgia, serif';
    ctx.fillText('O meu onze', x, y - 36);
    ctx.textAlign = 'right';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(formation, x + w, y - 40);
    ctx.drawImage(field, x, y, w, h);

    ctx.textAlign = 'center';
    slotsFor(formation).forEach((slot, index) => {
      const name = players[index]?.name ?? slot.role;
      const centerX = x + slot.x * w;
      const centerY = y + slot.y * h;
      ctx.fillStyle = '#e9f4ff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 29, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#06478a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(initials(name), centerX, centerY + 8);
      ctx.font = 'bold 24px sans-serif';
      ctx.strokeStyle = '#15332b';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeText(name, centerX, centerY + 59, 145);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, centerX, centerY + 59, 145);
    });

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG unavailable');
    const download = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = download;
    link.download = 'o-meu-onze-maisfcporto.png';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(download), 1000);
  } finally {
    URL.revokeObjectURL(pitchUrl);
  }
}

function LineupBuilder({ players, next }: SquadData) {
  const [selection, setSelection] = useState(() => readSelection(players));
  const [active, setActive] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const slots = slotsFor(selection.formation);
  const byId = new Map(players.map((player) => [player.id, player]));
  const placed = selection.ids.map((id) => id === null ? undefined : byId.get(id));
  const picked = placed.filter(Boolean).length;
  const slot = active === null ? undefined : slots[active];
  const preferred = slot ? groupFor(slot.role) : null;
  const options = players.filter((player) => player.name.toLocaleLowerCase('pt').includes(query.trim().toLocaleLowerCase('pt')))
    .sort((a, b) => Number(b.position === preferred) - Number(a.position === preferred) || a.name.localeCompare(b.name, 'pt'));

  function update(next: Selection) {
    setSelection(next);
    setShareUrl('');
    setMessage('');
  }

  function assign(id: number | null) {
    if (active === null) return;
    update({ ...selection, ids: selection.ids.map((value, index) => index === active ? id : value) });
    dialog.current?.close();
  }

  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set('formacao', selection.formation);
    url.searchParams.set('jogadores', selection.ids.join(','));
    setShareUrl(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setMessage('Ligação copiada.');
    } catch {
      setMessage('Copia a ligação abaixo.');
    }
  }

  async function exportImage() {
    if (!svg.current) return;
    try {
      await downloadLineup(svg.current, selection.formation, placed);
      setMessage('Imagem preparada.');
    } catch {
      setMessage('Houve um erro ao criar a imagem. Tenta novamente.');
    }
  }

  if (!players.length) return <p className={styles.empty}>Ativa o plantel do FC Porto no backoffice para montares o teu onze.</p>;

  return (
    <div className={styles.lineupGrid}>
      <div className={styles.pitch}>
        <Pitch svg={svg} />
        {slots.map((position, index) => {
          const player = placed[index];
          return (
            <button
              type="button"
              key={index}
              className={styles.slot}
              style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
              aria-label={`${position.role}: ${player?.name ?? 'escolher jogador'}`}
              onClick={() => {
                setActive(index);
                setQuery('');
                dialog.current?.showModal();
              }}
            >
              <span className={styles.marker} data-picked={Boolean(player)}>{player ? initials(player.name) : '+'}</span>
              <span>{player?.name ?? position.role}</span>
            </button>
          );
        })}
      </div>

      <section className={styles.lineupControls} aria-label="Opções do onze">
        {next && (
          <div className={styles.nextMatch}>
            <p className={styles.eyebrow}>Próximo jogo</p>
            <p><strong>{fixtureTitle(next)}</strong></p>
            <p className={styles.muted}>{fixtureMeta(next)}</p>
          </div>
        )}
        <label className={styles.fieldLabel}>
          Formação
          <select value={selection.formation} onChange={(event) => update(changeFormation(selection, event.target.value as Formation))}>
            {Object.keys(formations).map((formation) => <option key={formation}>{formation}</option>)}
          </select>
        </label>
        <p className={styles.muted}>{picked}/11 escolhidos. Toca numa posição para selecionar um jogador.</p>
        <div className={styles.actions}>
          <button className={styles.primary} type="button" disabled={picked !== 11} onClick={share}>Copiar ligação</button>
          <button className={styles.secondary} type="button" disabled={picked !== 11} onClick={exportImage}>Descarregar PNG</button>
          <button className={styles.plain} type="button" disabled={!picked}
            onClick={() => update({ ...selection, ids: slots.map(() => null) })}>Limpar onze</button>
        </div>
        {message && <p role="status" className={styles.message}>{message}</p>}
        {shareUrl && <input aria-label="Ligação do teu onze" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />}
      </section>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="lineup-picker" onClose={() => setActive(null)}>
        <div className={styles.dialogHead}>
          <h2 id="lineup-picker">Escolher jogador{slot ? ` · ${slot.role}` : ''}</h2>
          <button className={styles.plain} type="button" onClick={() => dialog.current?.close()}>Fechar</button>
        </div>
        <label className={styles.fieldLabel}>
          Procurar no plantel
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
        </label>
        {active !== null && placed[active] && <button className={styles.plain} type="button" onClick={() => assign(null)}>Retirar jogador</button>}
        <ul className={styles.playerList}>
          {options.map((player) => {
            const used = selection.ids.some((id, index) => id === player.id && index !== active);
            return (
              <li key={player.id}>
                <button type="button" onClick={() => assign(player.id)} disabled={used}>
                  <strong>{player.name}</strong>
                  <span>{used ? 'Já no onze' : positionName(player.position)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {!options.length && <p className={styles.muted}>Nenhum jogador encontrado.</p>}
      </dialog>
    </div>
  );
}

export default function Lineup() {
  return (
    <FanTool<SquadData> area="plantel" title="Onze do Porto" description="Escolhe a formação e monta o teu onze com o plantel do Predictor.">
      {(data) => <LineupBuilder {...data} />}
    </FanTool>
  );
}
