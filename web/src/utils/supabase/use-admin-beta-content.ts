'use client';

import { useEffect, useState } from 'react';
import { supabasePKCE } from './client';

type BetaContent<T> = { status: 'checking' | 'denied' } | { status: 'ready'; data: T };

export function useAdminBetaContent<T>(endpoint: string, read: (response: Response) => Promise<T>) {
  const [content, setContent] = useState<BetaContent<T>>({ status: 'checking' });

  useEffect(() => {
    let request: AbortController | undefined;
    let userId: string | null | undefined;
    let token: string | undefined;
    let hasContent = false;

    const { data } = supabasePKCE.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      const nextToken = session?.access_token;
      if (nextUserId === userId && (hasContent || nextToken === token)) return;

      userId = nextUserId;
      token = nextToken;
      hasContent = false;
      request?.abort();

      if (!nextToken) {
        setContent({ status: 'denied' });
        return;
      }

      request = new AbortController();
      const { signal } = request;
      setContent({ status: 'checking' });

      void fetch(endpoint, {
        headers: { Authorization: `Bearer ${nextToken}` },
        cache: 'no-store',
        signal,
      })
        .then((response) => (response.ok ? read(response) : null))
        .then((data) => {
          if (signal.aborted) return;
          hasContent = data !== null;
          setContent(data === null ? { status: 'denied' } : { status: 'ready', data });
        })
        .catch(() => {
          if (!signal.aborted) setContent({ status: 'denied' });
        });
    });

    return () => {
      request?.abort();
      data.subscription.unsubscribe();
    };
  }, [endpoint, read]);

  return content;
}
