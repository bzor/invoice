import { api } from "@/lib/api";
import { listSummaries, outstandingOf } from "@/lib/api-documents";
import { getDashboardStats } from "@/lib/data";
import { round2 } from "@/lib/money";

/**
 * GET /api/v1/summary — "where do things stand" in one call: the dashboard
 * totals (base currency), every invoice with money owed (most overdue first),
 * estimates awaiting a client response, and unsent drafts.
 */
export const GET = api(async ({ db }) => {
  const [stats, docs] = await Promise.all([
    getDashboardStats(db),
    listSummaries(db),
  ]);

  return {
    base_currency: stats.baseCurrency,
    totals: {
      outstanding: round2(stats.outstanding),
      overdue: round2(stats.overdueAmount),
      overdue_count: stats.overdueCount,
      invoiced_this_month: round2(stats.invoicedThisMonth),
      invoiced_last_month: round2(stats.invoicedLastMonth),
      paid_last_month: round2(stats.paidLastMonth),
      paid_this_year: round2(stats.paidThisYear),
    },
    outstanding_invoices: outstandingOf(docs),
    estimates_awaiting_response: docs.filter(
      (d) => d.type === "estimate" && d.status === "sent",
    ),
    drafts: docs.filter((d) => d.status === "draft"),
  };
});
