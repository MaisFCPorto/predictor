// components/competitions.ts
export type CompCode = 'LP' | 'LE' | 'TP' | 'TL' | string;

export const COMP_META: Record<
  string,
  {
    name: string;
    // barra superior de 6px
    accent: string;
    // toques discretos (pill/borda)
    subtle?: string;
    // opcional: segundo tom para gradiente
    accent2?: string;
  }
> = {
  LP: { name: 'Liga Portugal', accent: '#001334', subtle: '#E5141E' },
  LE: { name: 'Liga Europa', accent: '#FF9100', subtle: '#FFB547' },
  TP: { name: 'Taça de Portugal', accent: '#00B762', subtle: '#F44336' },
  TL: { name: 'Taça da Liga', accent: '#091534', subtle: '#091534' },
};

export function compName(code?: string | null) {
  if (!code) return null;
  return COMP_META[code]?.name ?? code;
}

export function compAccent(code?: string | null) {
  if (!code) return undefined;
  return COMP_META[code]?.accent;
}

export function compSubtle(code?: string | null) {
  if (!code) return undefined;
  return COMP_META[code]?.subtle;
}

// “J1”, “QF”, “SF”, “F”, “M1”… -> texto por extenso
export function roundText(label?: string | null) {
  if (!label) return null;
  const t = label.toUpperCase();
  if (/^J\d+$/i.test(t)) return `Jornada ${t.slice(1)}`;
  if (t === 'QF') return 'Quartos de final';
  if (t === 'SF') return 'Meias-finais';
  if (t === 'F') return 'Final';
  if (/^M\d+$/i.test(t)) return `Mão ${t.slice(1)}`;
  return t;
}
