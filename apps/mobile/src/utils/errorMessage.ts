/**
 * Extracts a plain, renderable string from an Axios/API error, no matter the
 * shape the backend sent (a string, an array of validation messages, or -
 * before this was hardened - an unwrapped {message,error,statusCode} object).
 * Never returns a non-string, so callers can safely dispatch/render the
 * result directly without risking a "objects are not valid as a React child"
 * crash on the next unexpected error shape.
 */
export function getErrorMessage(err: any, fallback = 'Something went wrong'): string {
  const raw = err?.response?.data?.message ?? err?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw) && raw.length) return raw.join(', ');
  if (raw && typeof raw === 'object' && typeof raw.message === 'string') return raw.message;
  return fallback;
}
