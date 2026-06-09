import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { getYearlyReport } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

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
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/reports?year=${y}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  y === year
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Invoiced in {year}</p>
          <p className="mt-1 text-2xl font-semibold tnum text-slate-900">
            {fmt(report.invoiced)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Collected in {year}</p>
          <p className="mt-1 text-2xl font-semibold tnum text-emerald-600">
            {fmt(report.paid)}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">By quarter</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 font-medium">Quarter</th>
                <th className="px-5 py-2 text-right font-medium">Invoiced</th>
                <th className="px-5 py-2 text-right font-medium">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.quarters.map((q, i) => (
                <tr key={i}>
                  <td className="px-5 py-2 text-slate-600">Q{i + 1}</td>
                  <td className="px-5 py-2 text-right tnum text-slate-700">
                    {fmt(q.invoiced)}
                  </td>
                  <td className="px-5 py-2 text-right tnum text-slate-700">
                    {fmt(q.paid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">By client</h2>
          </div>
          {report.byClient.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              No activity in {year}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Client</th>
                  <th className="px-5 py-2 text-right font-medium">Invoiced</th>
                  <th className="px-5 py-2 text-right font-medium">Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.byClient.map((c) => (
                  <tr key={c.name}>
                    <td className="px-5 py-2 text-slate-700">{c.name}</td>
                    <td className="px-5 py-2 text-right tnum text-slate-700">
                      {fmt(c.invoiced)}
                    </td>
                    <td className="px-5 py-2 text-right tnum text-slate-700">
                      {fmt(c.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
