"use client";

import { deletePayment, markPaid, recordPayment } from "@/lib/actions/payments";
import { Input } from "@/components/form";
import { buttonClass } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Payment } from "@/lib/types";

export function PaymentsPanel({
  invoiceId,
  currency,
  total,
  payments,
  contactEmail,
}: {
  invoiceId: string;
  currency: string;
  total: number;
  payments: Payment[];
  contactEmail?: string;
}) {
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Math.max(0, total - paid);
  const money = (n: number) => formatMoney(n, currency);

  return (
    <div>
      {payments.length > 0 ? (
        <ul className="divide-y divide-line">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="tnum font-medium text-ink">
                  {money(Number(p.amount))}
                </span>
                <span className="ml-2 text-faint">
                  {formatDate(p.date)}
                  {p.method ? ` · ${p.method}` : ""}
                </span>
              </div>
              <form action={deletePayment}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="invoice_id" value={invoiceId} />
                <button className="font-grotesk text-xs uppercase tracking-wider text-faint hover:text-alert">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        due > 0.005 && (
          <p className="text-sm text-faint">No payments recorded yet.</p>
        )
      )}

      {due > 0.005 && (
        <div
          className={
            payments.length > 0 ? "mt-4 border-t border-line pt-4" : "mt-3"
          }
        >
          <form action={recordPayment} className="grid grid-cols-2 gap-2">
            <input type="hidden" name="invoice_id" value={invoiceId} />
            <div className="col-span-1">
              <label className="font-grotesk text-xs uppercase tracking-wider text-muted">Amount</label>
              <Input
                type="number"
                step="any"
                name="amount"
                defaultValue={due}
                required
              />
            </div>
            <div className="col-span-1">
              <label className="font-grotesk text-xs uppercase tracking-wider text-muted">Date</label>
              <Input type="date" name="date" defaultValue={today()} />
            </div>
            <div className="col-span-2">
              <label className="font-grotesk text-xs uppercase tracking-wider text-muted">Method (optional)</label>
              <Input name="method" placeholder="Bank transfer, check…" />
            </div>
            <div className="col-span-2">
              <button className={buttonClass("primary")}>Record payment</button>
            </div>
          </form>

          {/* Quick-settle the full balance, with an opt-in receipt */}
          <form
            action={markPaid}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
          >
            <input type="hidden" name="invoice_id" value={invoiceId} />
            {contactEmail ? (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  name="send_receipt"
                  className="border-line"
                />
                Email receipt to {contactEmail}
              </label>
            ) : (
              <span className="text-sm text-faint">Settle the full balance</span>
            )}
            <button className={buttonClass("secondary")}>Mark as paid</button>
          </form>
        </div>
      )}
    </div>
  );
}
