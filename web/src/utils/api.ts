const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type SavePredictionPayload = {
  userId: string;
  fixtureId: string;
  home: number;
  away: number;
  scorer_player_id?: string | null;
};

export async function savePrediction({
  userId,
  fixtureId,
  home,
  away,
  scorer_player_id,
}: SavePredictionPayload) {
  const url = API_BASE
    ? `${API_BASE}/api/predictions`
    : '/api/predictions';

  const body: any = {
    userId,
    fixtureId,
    home,
    away,
  };

  // ⚠️ Enviar mesmo quando for null (para limpar)
  if (typeof scorer_player_id !== 'undefined') {
    body.scorer_player_id = scorer_player_id;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Falha ao guardar palpite (${res.status}) ${res.statusText}${
        txt ? ` — ${txt.slice(0, 140)}…` : ''
      }`,
    );
  }

  return res.json().catch(() => ({}));
}
