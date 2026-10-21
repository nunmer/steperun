/** Client for the Python run-analyzer service (Hugging Face Space). Server-only. */

export const ANALYZER_URL = process.env.RUN_ANALYZER_API_URL || "http://localhost:8000";

/** Headers for every request to the analyzer; it rejects calls without the shared key. */
export function analyzerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.RUN_ANALYZER_API_KEY;
  return key ? { ...extra, "X-Analyzer-Key": key } : extra;
}
