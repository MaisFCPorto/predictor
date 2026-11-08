import 'server-only';

import { isPredictorAdmin } from '@/utils/supabase/predictor-admin';

export function hubBetaEnabled() {
  return process.env.HUB_BETA_ENABLED === 'true';
}

export async function canReadHub(authorization: string | null) {
  return hubBetaEnabled() && isPredictorAdmin(authorization);
}
