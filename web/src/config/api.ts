// API configuration for different services
export const API_CONFIG = {
  // Main predictor API (original)
  PREDICTOR: process.env.NEXT_PUBLIC_API_URL || 'https://predictor-porto-api.31b3483d39dca7d948bf92ed7b263d8f.workers.dev',
  
  // Shop API (your own)
  SHOP: process.env.NEXT_PUBLIC_SHOP_API_URL || 'https://predictor-shop-api.maisfcp.workers.dev',
};

// Helper to get the correct API base URL
export function getApiUrl(service: 'predictor' | 'shop' = 'predictor'): string {
  return service === 'shop' ? API_CONFIG.SHOP : API_CONFIG.PREDICTOR;
}
