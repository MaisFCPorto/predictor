const formatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
});

export const formatHubNewsDate = (publishedAt: string) => formatter.format(new Date(publishedAt));
