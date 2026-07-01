import Link from "next/link";

import { LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import {
  amountPaid,
  getDashboardStats,
  listDocuments,
  listRecentPaidInvoices,
  type DocumentListItem,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

function SecondaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas px-4 py-4 sm:px-6 sm:py-5">
      <p className="font-grotesk text-[11px] uppercase tracking-wider text-muted sm:text-xs">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-medium tnum text-ink sm:text-2xl">{value}</p>
    </div>
  );
}

function OpenList({
  title,
  href,
  docs,
  limit = 6,
}: {
  title: string;
  href: string;
  docs: DocumentListItem[];
  limit?: number;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="font-grotesk text-xs uppercase tracking-wider text-muted">{title}</h2>
        <Link
          href={href}
          className="font-grotesk text-xs uppercase tracking-wider text-muted transition hover:text-ink"
        >
          View all →
        </Link>
      </div>

      {docs.length === 0 ? (
        <p className="py-10 text-sm text-faint">Nothing open.</p>
      ) : (
        <ul className="divide-y divide-line">
          {docs.slice(0, limit).map((d) => (
            <li key={d.id}>
              <Link
                href={`/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`}
                className="group -mx-2 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-2 py-3 transition hover:bg-hover sm:grid-cols-[auto_1fr_auto_6.5rem] sm:gap-x-6"
              >
                <span className="order-1 text-sm font-medium tnum text-ink">{d.number}</span>
                <span className="order-3 col-span-2 truncate text-sm text-muted sm:order-2 sm:col-span-1">
                  {d.client?.name ?? "—"}
                  {d.subject ? ` · ${d.subject}` : ""}
                </span>
                <span className="order-2 text-right text-sm tnum text-ink sm:order-3">
                  {formatMoney(Number(d.total), d.currency)}
                </span>
                <span className="order-4 hidden justify-self-end sm:flex">
                  <StatusBadge
                    status={effectiveStatus(d, amountPaid(d.payments))}
                    size="sm"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const [stats, openEstimates, invoiceCandidates, recentInvoices] =
    await Promise.all([
      getDashboardStats(),
      listDocuments("estimate", { status: ["draft", "sent"] }),
      listDocuments("invoice", { status: ["draft", "sent"] }),
      listRecentPaidInvoices(10),
    ]);

  // "paid"/"partial"/"overdue" are derived from payments, not stored — so a
  // fully-paid invoice still has stored status "sent". Drop those from the
  // open list by checking effective status.
  const openInvoices = invoiceCandidates.filter(
    (d) => effectiveStatus(d, amountPaid(d.payments)) !== "paid",
  );

  const fmt = (n: number) => formatMoney(n, stats.baseCurrency);

  // "Needs attention" — the actionable to-do queue.
  const invoiceDrafts = openInvoices.filter((d) => d.status === "draft").length;
  const estimateDrafts = openEstimates.filter((d) => d.status === "draft").length;
  const awaitingReply = openEstimates.filter((d) => d.status === "sent").length;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const attention: {
    label: string;
    note?: string;
    href: string;
    tone?: "alert";
  }[] = [];
  if (stats.overdueCount > 0)
    attention.push({
      label: `${plural(stats.overdueCount, "invoice")} overdue`,
      note: fmt(stats.overdueAmount),
      href: "/invoices",
      tone: "alert",
    });
  if (awaitingReply > 0)
    attention.push({
      label: `${plural(awaitingReply, "estimate")} awaiting reply`,
      href: "/estimates",
    });
  if (invoiceDrafts > 0)
    attention.push({
      label: `${plural(invoiceDrafts, "invoice draft")} to send`,
      href: "/invoices",
    });
  if (estimateDrafts > 0)
    attention.push({
      label: `${plural(estimateDrafts, "estimate draft")} to send`,
      href: "/estimates",
    });

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Totals in ${stats.baseCurrency}`}
        action={
          <div className="flex gap-2">
            <LinkButton href="/estimates/new" variant="secondary">
              New estimate
            </LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </div>
        }
      />

      {/* Hero — the one number that matters, with overdue called out in alert */}
      <section className="flex flex-col gap-3 border-y border-line py-6 sm:flex-row sm:items-end sm:justify-between sm:py-7">
        <div>
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">Outstanding</p>
          <p className="mt-2 text-4xl font-medium tnum leading-none text-ink sm:text-5xl">
            {fmt(stats.outstanding)}
          </p>
        </div>
        {stats.overdueCount > 0 ? (
          <Link
            href="/invoices"
            className="font-grotesk text-sm font-medium uppercase tracking-wider text-alert transition hover:opacity-70"
          >
            {stats.overdueCount} overdue · {fmt(stats.overdueAmount)} →
          </Link>
        ) : (
          <span className="font-grotesk text-sm uppercase tracking-wider text-faint">
            All current
          </span>
        )}
      </section>

      {/* Secondary stats — a single lined band, not a card grid.
          gap-px over a line-colored bg draws hairlines that reflow cleanly
          from 2 columns on mobile to 4 on desktop. */}
      <section className="grid grid-cols-2 gap-px border-b border-line bg-line md:grid-cols-4">
        <SecondaryStat label="Invoiced this month" value={fmt(stats.invoicedThisMonth)} />
        <SecondaryStat label="Invoiced last month" value={fmt(stats.invoicedLastMonth)} />
        <SecondaryStat label="Paid last month" value={fmt(stats.paidLastMonth)} />
        <SecondaryStat label="Payments year to date" value={fmt(stats.paidThisYear)} />
      </section>

      {/* Needs attention — the actionable queue */}
      {attention.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted">
            Needs attention
          </h2>
          <ul className="divide-y divide-line">
            {attention.map((a, i) => (
              <li key={i}>
                <Link
                  href={a.href}
                  className="-mx-2 flex items-center justify-between gap-4 px-2 py-3 text-sm transition hover:bg-hover"
                >
                  <span
                    className={
                      a.tone === "alert"
                        ? "font-medium text-alert"
                        : "text-ink"
                    }
                  >
                    {a.label}
                  </span>
                  <span className="flex items-center gap-3">
                    {a.note && <span className="tnum text-muted">{a.note}</span>}
                    <span className="text-faint">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Working surfaces — invoices lead, estimates follow */}
      <div className="mt-12 space-y-12">
        <OpenList title="Open invoices" href="/invoices" docs={openInvoices} />
        {openEstimates.length > 0 && (
          <OpenList title="Open estimates" href="/estimates" docs={openEstimates} />
        )}
        {recentInvoices.length > 0 && (
          <OpenList
            title="Recent invoices"
            href="/invoices"
            docs={recentInvoices}
            limit={10}
          />
        )}
      </div>
    </>
  );
}
