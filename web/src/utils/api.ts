// utils/api.ts
export async function savePrediction({
  userId, fixtureId, home, away,
}: { userId: string; fixtureId: string; home: number; away: number }) {

  const res = await fetch('/api/predictions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, fixtureId, home, away }),
  });

  const text = await res.text();
  const tryJson = () => { try { return JSON.parse(text); } catch { return null; } };

  if (!res.ok) {
    const j = tryJson();
    const msg =
      j?.error === 'user_missing' ? 'Utilizador não sincronizado.' :
      j?.error === 'locked'       ? 'Palpite bloqueado (jogo fechado).' :
      j?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return tryJson() ?? { ok: true };
}
