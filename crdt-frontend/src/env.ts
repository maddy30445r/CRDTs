// Single source of truth for backend URLs. Vite inlines VITE_* at build time.
// Fail loudly at startup if missing, instead of as a confusing network error.
export const WS_URL = import.meta.env.VITE_WS_URL as string;
export const API_URL = import.meta.env.VITE_API_URL as string;
if (!WS_URL || !API_URL) {
  throw new Error("VITE_WS_URL and VITE_API_URL must be set");
}
