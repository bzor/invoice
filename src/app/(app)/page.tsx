import Link from "next/link";

import { Card, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import {
  amountPaid,
  getDashboardStats,
  listDocuments,
  type DocumentListItem,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tnum ${
          tone === "warn" ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

function MiniList({
  title,
  href,
  docs,
}: {
  title: string;
  href: string;
  docs: DocumentListItem[];
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <Link href={href} className="text-xs font-medium text-slate-500 hover:text-slate-900">
          View all →
        </Link>
      </div>
      {docs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Nothing open</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.slice(0, 6).map((d) => (
            <li key={d.id}>
              <Link
                href={`/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {d.number} · {d.client?.name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {d.subject || "No subject"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 pl-3">
                  <span className="text-sm tnum text-slate-700">
                    {formatMoney(Number(d.total), d.currency)}
                  </span>
                  <StatusBadge
                    status={effectiveStatus(d, amountPaid(d.payments))}
                    size="sm"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function DashboardPage() {
  const [stats, openEstimates, openInvoices] = await Promise.all([
    getDashboardStats(),
    listDocuments("estimate", { status: ["draft", "sent"] }),
    listDocuments("invoice", { status: ["draft", "sent", "partial", "overdue"] }),
  ]);

  const fmt = (n: number) => formatMoney(n, stats.baseCurrency);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Totals shown in ${stats.baseCurrency}`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/estimates/new" variant="secondary">
              New estimate
            </LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={fmt(stats.outstanding)}
          hint={
            stats.overdueCount > 0
              ? `${stats.overdueCount} overdue`
              : "All current"
          }
          tone={stats.overdueCount > 0 ? "warn" : "default"}
        />
        <StatCard label="Paid last month" value={fmt(stats.paidLastMonth)} />
        <StatCard label="Payments year to date" value={fmt(stats.paidThisYear)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr]">
        <MiniList title="Open invoices" href="/invoices" docs={openInvoices} />
        <MiniList title="Open estimates" href="/estimates" docs={openEstimates} />
      </div>
    </>
  );
}
