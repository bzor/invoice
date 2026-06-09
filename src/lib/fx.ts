/**
 * Foreign-exchange rate lookup, snapshotted at a document's issue date.
 * Primary source: Frankfurter (ECB, free, no key). Fallback: exchangerate.host.
 * Returns the multiplier to convert `from` → `to`, or null if unavailable.
 */
export async function getFxRate(
  from: string,
  to: string,
  date: string, // YYYY-MM-DD
): Promise<number | null> {
  if (!from || !to || from === to) return 1;

  const frankfurter = `https://api.frankfurter.app/${date}?from=${from}&to=${to}`;
  try {
    const res = await fetch(frankfurter, { next: { revalidate: 86_400 } });
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> };
      const rate = json.rates?.[to];
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch {
    // fall through to backup
  }

  const backup = `https://api.exchangerate.host/${date}?base=${from}&symbols=${to}`;
  try {
    const res = await fetch(backup, { next: { revalidate: 86_400 } });
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> };
      const rate = json.rates?.[to];
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch {
    // give up
  }

  return null;
}
