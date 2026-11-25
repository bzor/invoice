import { ApiError, api } from "@/lib/api";
import { getYearlyReport } from "@/lib/data";

/** GET /api/v1/report?year=YYYY — invoiced vs collected by quarter and client. */
export const GET = api(async ({ db, url }) => {
  const raw = url.searchParams.get("year");
  const year = raw ? Number(raw) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ApiError(400, "year must be a four-digit year");
  }
  return getYearlyReport(year, db);
});
