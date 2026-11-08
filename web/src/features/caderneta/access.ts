import 'server-only';

import { isPredictorAdmin } from '@/utils/supabase/predictor-admin';

export function cadernetaBetaEnabled() {
  return process.env.CADERNETA_BETA_ENABLED === 'true';
}

export async function canReadCaderneta(authorization: string | null) {
  return cadernetaBetaEnabled() && isPredictorAdmin(authorization);
}
