/** Module-owned demo data; no backend API contract was supplied. */
export async function loadReport(signal: AbortSignal) {
  signal.throwIfAborted();
  return { revenue: 68300, completed: 3, customers: 5 };
}
