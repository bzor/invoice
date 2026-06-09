/* eslint-disable @next/next/no-img-element */
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type {
  Client,
  Contact,
  DocumentRow,
  LineItem,
} from "@/lib/types";

export type PreviewBusiness = {
  business_name: string;
  business_address: string;
  business_email?: string;
  logo_url: string | null;
  bank_domestic: string;
  bank_international: string;
};

export function DocumentPreview({
  doc,
  client,
  contact,
  lineItems,
  business,
}: {
  doc: DocumentRow;
  client: Client | null;
  contact: Contact | null;
  lineItems: LineItem[];
  business: PreviewBusiness;
}) {
  const money = (n: number) => formatMoney(n, doc.currency);
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";
  const bank =
    doc.bank_info_mode === "domestic"
      ? business.bank_domestic
      : doc.bank_info_mode === "international"
        ? business.bank_international
        : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-800 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {business.logo_url && (
            <img
              src={business.logo_url}
              alt={business.business_name}
              className="mb-2 h-10 object-contain"
            />
          )}
          <p className="text-base font-semibold text-slate-900">
            {business.business_name}
          </p>
          <p className="whitespace-pre-line text-slate-500">
            {business.business_address}
          </p>
          {business.business_email && (
            <p className="text-slate-500">{business.business_email}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold uppercase tracking-wide text-slate-900">
            {typeLabel}
          </p>
          <p className="text-slate-500">{doc.number}</p>
          {doc.po_number && (
            <p className="text-slate-500">PO {doc.po_number}</p>
          )}
        </div>
      </div>

      {/* Bill to + dates */}
      <div className="mt-8 flex justify-between gap-8">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            Bill to
          </p>
          <p className="font-semibold text-slate-900">{client?.name ?? "—"}</p>
          {contact && <p>{contact.name}</p>}
          {contact?.email && <p className="text-slate-500">{contact.email}</p>}
          <p className="whitespace-pre-line text-slate-500">{client?.address}</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Issued
            </p>
            <p>{formatDate(doc.issue_date)}</p>
          </div>
          {doc.due_date && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                Due
              </p>
              <p>{formatDate(doc.due_date)}</p>
            </div>
          )}
        </div>
      </div>

      {doc.subject && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Subject
          </p>
          <p className="font-medium text-slate-900">{doc.subject}</p>
        </div>
      )}

      {/* Line items */}
      <table className="mt-6 w-full">
        <thead>
          <tr className="border-b border-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-2 font-medium">Description</th>
            <th className="pb-2 text-right font-medium">Qty</th>
            <th className="pb-2 text-right font-medium">Price</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{li.description}</td>
              <td className="py-2 text-right tnum">{Number(li.quantity)}</td>
              <td className="py-2 text-right tnum">
                {money(Number(li.unit_price))}
              </td>
              <td className="py-2 text-right tnum">
                {money(Number(li.line_total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="tnum">{money(Number(doc.subtotal))}</span>
          </div>
          {Number(doc.discount_total) > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>
                Discount
                {doc.discount_type === "percent"
                  ? ` (${Number(doc.discount_value)}%)`
                  : ""}
              </span>
              <span className="tnum">−{money(Number(doc.discount_total))}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-900 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span className="tnum">{money(Number(doc.total))}</span>
          </div>
        </div>
      </div>

      {doc.notes && (
        <div className="mt-8">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            Notes
          </p>
          <p className="whitespace-pre-line text-slate-600">{doc.notes}</p>
        </div>
      )}

      {bank && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            Payment details
          </p>
          <p className="whitespace-pre-line text-slate-600">{bank}</p>
        </div>
      )}
    </div>
  );
}
