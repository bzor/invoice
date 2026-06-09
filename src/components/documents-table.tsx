import Link from "next/link";

import { Card, StatusBadge } from "@/components/ui";
import type { DocumentListItem } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { amountPaid } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";

export function DocumentsTable({ docs }: { docs: DocumentListItem[] }) {
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3 font-medium">Number</th>
            <th className="px-5 py-3 font-medium">Client</th>
            <th className="px-5 py-3 font-medium">Subject</th>
            <th className="px-5 py-3 font-medium">Issued</th>
            <th className="px-5 py-3 text-right font-medium">Total</th>
            <th className="px-5 py-3 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {docs.map((d) => {
            const href = `/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`;
            return (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">
                  <Link href={href} className="hover:underline">
                    {d.number}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {d.client?.name ?? "—"}
                </td>
                <td className="px-5 py-3 text-slate-500">{d.subject || "—"}</td>
                <td className="px-5 py-3 text-slate-500">
                  {formatDate(d.issue_date)}
                </td>
                <td className="px-5 py-3 text-right tnum text-slate-700">
                  {formatMoney(Number(d.total), d.currency)}
                </td>
                <td className="px-5 py-3 text-right">
                  <StatusBadge
                    status={effectiveStatus(d, amountPaid(d.payments))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
