"use client";

import { deletePayment, recordPayment } from "@/lib/actions/payments";
import { Input } from "@/components/form";
import { Card, buttonClass } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Payment } from "@/lib/types";

export function PaymentsPanel({
  invoiceId,
  currency,
  total,
  payments,
}: {
  invoiceId: string;
  currency: string;
  total: number;
  payments: Payment[];
}) {
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Math.max(0, total - paid);
  const money = (n: number) => formatMoney(n, currency);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
        <div className="text-right text-sm">
          <span className="text-slate-500">Due </span>
          <span className="font-semibold tnum text-slate-900">{money(due)}</span>
        </div>
      </div>

      {payments.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="tnum font-medium text-slate-900">
                  {money(Number(p.amount))}
                </span>
                <span className="ml-2 text-slate-400">
                  {formatDate(p.date)}
                  {p.method ? ` · ${p.method}` : ""}
                </span>
              </div>
              <form action={deletePayment}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="invoice_id" value={invoiceId} />
                <button className="text-xs text-slate-400 hover:text-red-500">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {due > 0.005 && (
        <form
          action={recordPayment}
          className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"
        >
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <div className="col-span-1">
            <label className="text-xs text-slate-500">Amount</label>
            <Input
              type="number"
              step="any"
              name="amount"
              defaultValue={due}
              required
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs text-slate-500">Date</label>
            <Input type="date" name="date" defaultValue={today()} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500">Method (optional)</label>
            <Input name="method" placeholder="Bank transfer, check…" />
          </div>
          <div className="col-span-2">
            <button className={buttonClass("primary")}>Record payment</button>
          </div>
        </form>
      )}
    </Card>
  );
}
