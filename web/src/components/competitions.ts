// components/competitions.ts
export type CompCode = 'LP' | 'LE' | 'TP' | 'TL' | string;

export const COMP_META: Record<
  string,
  {
    name: string;
    accent: string;
    pill: string;
    watermarkUrl?: string;
  }
> = {
  LP: {
    name: 'Liga Portugal',
    accent: '#001334',
    pill: '#022B6D',
    watermarkUrl:
      'https://upload.wikimedia.org/wikipedia/commons/5/5a/S%C3%ADmbolo_da_Liga_Portuguesa_de_Futebol_Profissional.png',
  },
  LE: {
    name: 'Liga Europa',
    accent: '#5F3601',
    pill: '#C27502',
    watermarkUrl:
      'https://img.uefa.com/imgml/uefacom/uel/2024/logos/uel_logotype_fc_dark.svg',
  },
  TP: {
    name: 'Taça de Portugal',
    accent: '#005E32',
    pill: '#F44336',
    watermarkUrl:
      'https://r2.thesportsdb.com/images/media/league/badge/hyy7lq1593011553.png',
  },
  TL: {
    name: 'Taça da Liga',
    accent: '#022786',
    pill: '#0233AF',
    watermarkUrl:
      'https://www.ligaportugal.pt/backoffice/assets/ic_allianzcup_cbcb5ca1e0.png',
  },
};

function cleanColor(value?: string | null) {
  const color = value?.trim();
  return color && /^#[0-9a-fA-F]{6}$/.test(color)
    ? color.toUpperCase()
    : undefined;
}

function cleanUrl(value?: string | null) {
  const url = value?.trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return undefined;
}

export function compName(code?: string | null, overrideName?: string | null) {
  const name = overrideName?.trim();
  if (name) return name;
  if (!code) return null;
  return COMP_META[code]?.name ?? code;
}

export function compAccent(code?: string | null, overrideColor?: string | null) {
  return cleanColor(overrideColor) ?? (code ? COMP_META[code]?.accent : undefined);
}

export function compPill(code?: string | null, overrideColor?: string | null) {
  return cleanColor(overrideColor) ?? (code ? COMP_META[code]?.pill : undefined);
}

export function compWatermark(
  code?: string | null,
  overrideUrl?: string | null,
) {
  return cleanUrl(overrideUrl) ?? (code ? COMP_META[code]?.watermarkUrl : undefined);
}

// Compatibilidade com chamadas antigas.
export const compSubtle = compPill;

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
