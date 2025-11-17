// web/src/utils/api.ts

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type SavePredictionPayload = {
  userId: string;
  fixtureId: string;
  home: number;
  away: number;
  scorer_player_id: string | null; // obrigatório enviar, mesmo null
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

  // ⚠️ Enviamos SEMPRE o scorer_player_id — null incluído.
  const body = {
    userId,
    fixtureId,
    home,
    away,
    scorer_player_id,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Falha ao guardar palpite (${res.status}) ${res.statusText}${
        txt ? ` — ${txt.slice(0, 200)}…` : ''
      }`,
    );
  }

  // a route já responde com JSON consistente
  return res.json().catch(() => ({}));
}
