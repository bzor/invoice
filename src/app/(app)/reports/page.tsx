import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { getYearlyReport } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

// Shared column template — section head and rows align on the same grid.
const TCOLS = "grid-cols-[minmax(0,1fr)_auto_auto]";

function ReportSection({
  title,
  headLabel,
  rows,
  empty,
  fmt,
}: {
  title: string;
  headLabel: string;
  rows: { label: string; invoiced: number; paid: number }[];
  empty?: string;
  fmt: (n: number) => string;
}) {
  return (
    <section>
      <h2 className="font-grotesk text-xs uppercase tracking-wider text-muted">
        {title}
      </h2>

      {rows.length === 0 ? (
        <p className="py-8 text-sm text-faint">{empty}</p>
      ) : (
        <>
          <div
            className={`mt-3 grid ${TCOLS} gap-x-8 border-b border-line pb-2 font-grotesk text-[11px] uppercase tracking-wider text-faint`}
          >
            <span>{headLabel}</span>
            <span className="text-right">Invoiced</span>
            <span className="text-right">Collected</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r, i) => (
              <li
                key={i}
                className={`grid ${TCOLS} items-baseline gap-x-8 py-2.5 text-sm`}
              >
                <span className="truncate text-ink">{r.label}</span>
                <span className="text-right tnum text-ink">{fmt(r.invoiced)}</span>
                <span className="text-right tnum text-ink">{fmt(r.paid)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(yearParam) || currentYear;
  const report = await getYearlyReport(year);
  const fmt = (n: number) => formatMoney(n, report.baseCurrency);

  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`All figures in ${report.baseCurrency}`}
        action={
          <div className="flex gap-1 border border-line bg-surface p-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/reports?year=${y}`}
                className={`px-3 py-1.5 font-grotesk text-xs uppercase tracking-wider transition ${
                  y === year
                    ? "bg-ink text-surface"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        }
      />

      {/* Hero — the year's two headline figures as a single lined band */}
      <section className="grid grid-cols-2 divide-x divide-line border-y border-line">
        <div className="px-8 py-7 first:pl-0">
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
            Invoiced in {year}
          </p>
          <p className="mt-2 text-4xl font-medium tnum leading-none text-ink">
            {fmt(report.invoiced)}
          </p>
        </div>
        <div className="px-8 py-7 last:pr-0">
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
            Collected in {year}
          </p>
          <p className="mt-2 text-4xl font-medium tnum leading-none text-accent">
            {fmt(report.paid)}
          </p>
        </div>
      </section>

      <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
        <ReportSection
          title="By quarter"
          headLabel="Quarter"
          fmt={fmt}
          rows={report.quarters.map((q, i) => ({
            label: `Q${i + 1}`,
            invoiced: q.invoiced,
            paid: q.paid,
          }))}
        />
        <ReportSection
          title="By client"
          headLabel="Client"
          fmt={fmt}
          empty={`No activity in ${year}.`}
          rows={report.byClient.map((c) => ({
            label: c.name,
            invoiced: c.invoiced,
            paid: c.paid,
          }))}
        />
      </div>
    </>
  );
}
