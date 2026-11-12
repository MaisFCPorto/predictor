// Preserve recency across days; prefer these publishers within the same day.
export const newsOrder = `date(published_at) DESC,
  CASE source WHEN 'O Jogo' THEN 0 WHEN 'Jornal de Notícias' THEN 1 WHEN 'Maisfutebol' THEN 2 ELSE 3 END,
  published_at DESC, id DESC`;
