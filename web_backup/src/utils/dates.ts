// src/utils/dates.ts
export function fmtKickoffPT(iso: string) {
    try {
      return new Intl.DateTimeFormat('pt-PT', {
        timeZone: 'Europe/Lisbon',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(new Date(iso))
        .replace('.', '');
    } catch {
      return iso;
    }
  }
  