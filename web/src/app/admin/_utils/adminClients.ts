'use client';

import axios from 'axios';
import { supabasePKCE } from '@/utils/supabase/client';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export const adm = axios.create({
  baseURL: '',
});

adm.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};

  // 1) token do Supabase
  const {
    data: { session },
  } = await supabasePKCE.auth.getSession();

  if (session?.access_token) {
    (config.headers as any).Authorization = `Bearer ${session.access_token}`;
  }

  // 2) admin-key (para rotas antigas que ainda usam isto)
  if (ADMIN_KEY) {
    (config.headers as any)['x-admin-key'] = ADMIN_KEY;
  }

  return config;
});

adm.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) alert('Sessão expirada ou em falta. Faz login novamente.');
    if (status === 403) alert('Acesso negado (precisas de ser admin).');
    return Promise.reject(error);
  },
);
