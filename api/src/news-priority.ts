// Preserve recency across days; prefer these publishers within the same day.
export const newsOrder = `date(published_at) DESC,
  CASE source WHEN 'O Jogo' THEN 0 WHEN 'Maisfutebol' THEN 1 ELSE 2 END,
  published_at DESC, id DESC`;
