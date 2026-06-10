/* eslint-disable @next/next/no-img-element */
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Client, Contact, DocumentRow, LineItem } from "@/lib/types";

export type PreviewBusiness = {
  business_name: string;
  business_address: string;
  business_email?: string;
  logo_url: string | null;
  bank_domestic: string;
  bank_international: string;
};

// 1px background strip — used instead of CSS borders (globally reset to 0).
function Rule({ className = "bg-slate-900" }: { className?: string }) {
  return <div className={`h-px w-full ${className}`} />;
}

function Label({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-grotesk text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 ${className}`}
    >
      {children}
    </p>
  );
}

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
  const qty = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";
  const isInvoice = doc.type === "invoice";
  const metaFields = [
    { label: `${typeLabel} No.`, value: doc.number },
    { label: "Issued", value: formatDate(doc.issue_date) },
    ...(isInvoice
      ? [{ label: "Due", value: doc.due_date ? formatDate(doc.due_date) : "—" }]
      : []),
    { label: "Currency", value: doc.currency },
  ];
  const cols = "grid-cols-[26px_1fr_56px_104px_116px]";
  const bank =
    doc.bank_info_mode === "domestic"
      ? business.bank_domestic
      : doc.bank_info_mode === "international"
        ? business.bank_international
        : "";

  return (
    <div className="relative mx-auto flex min-h-[1056px] w-[816px] flex-col bg-white px-[76px] py-[68px] text-slate-900 shadow-sm">
      {/* Masthead */}
      <div className="flex items-start justify-between">
        <div className="max-w-[55%]">
          {business.logo_url ? (
            <>
              <img
                src={business.logo_url}
                alt={business.business_name}
                className="mb-3 h-9 object-contain"
              />
              <p className="font-grotesk text-sm font-semibold tracking-tight">
                {business.business_name}
              </p>
            </>
          ) : (
            <p className="font-grotesk text-xl font-semibold tracking-tight">
              {business.business_name}
            </p>
          )}
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">
            {business.business_address}
          </p>
          {business.business_email && (
            <p className="text-xs text-slate-500">{business.business_email}</p>
          )}
        </div>
        <h1 className="font-grotesk text-5xl font-semibold uppercase leading-none tracking-tight">
          {typeLabel}
        </h1>
      </div>

      <div className="mt-8">
        <Rule />
      </div>

      {/* Meta row */}
      <div
        className={`mt-5 grid gap-6 ${isInvoice ? "grid-cols-4" : "grid-cols-3"}`}
      >
        {metaFields.map((f) => (
          <div key={f.label}>
            <Label>{f.label}</Label>
            <p className="mt-1.5 text-sm">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Billed to + subject */}
      <div className="mt-9 grid grid-cols-2 gap-6">
        <div>
          <Label>{isInvoice ? "Billed to" : "Prepared for"}</Label>
          <p className="mt-1.5 text-sm font-medium">{client?.name ?? "—"}</p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">
            {client?.address}
          </p>
        </div>
        {(doc.subject || doc.po_number) && (
          <div>
            {doc.subject && (
              <>
                <Label>Subject</Label>
                <p className="mt-1.5 text-sm">{doc.subject}</p>
              </>
            )}
            {doc.po_number && (
              <div className="mt-3">
                <Label>PO Number</Label>
                <p className="mt-1.5 text-sm tabular-nums">{doc.po_number}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="mt-11">
        <div className={`grid ${cols} gap-x-5 pb-2.5`}>
          <Label>{""}</Label>
          <Label>Description</Label>
          <Label className="text-right">Qty</Label>
          <Label className="text-right">Price</Label>
          <Label className="text-right">Amount</Label>
        </div>
        <Rule />
        {lineItems.map((li, i) => (
          <div key={li.id}>
            <div className={`grid ${cols} gap-x-5 py-3.5 text-sm`}>
              <span className="font-grotesk text-xs tabular-nums text-slate-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="pr-2">
                <p className="text-slate-800">{li.title || li.description}</p>
                {li.title && li.description && (
                  <p className="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-slate-400">
                    {li.description}
                  </p>
                )}
              </div>
              <span className="text-right tabular-nums text-slate-500">
                {qty(Number(li.quantity))}
              </span>
              <span className="text-right tabular-nums text-slate-500">
                {money(Number(li.unit_price))}
              </span>
              <span className="text-right font-medium tabular-nums text-slate-900">
                {money(Number(li.line_total))}
              </span>
            </div>
            <Rule className="bg-slate-100" />
          </div>
        ))}

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-80">
            <div className="flex justify-between py-1 text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(Number(doc.subtotal))}</span>
            </div>
            {Number(doc.discount_total) > 0 && (
              <div className="flex justify-between py-1 text-sm text-slate-500">
                <span>
                  Discount
                  {doc.discount_type === "percent"
                    ? ` (${qty(Number(doc.discount_value))}%)`
                    : ""}
                </span>
                <span className="tabular-nums">
                  −{money(Number(doc.discount_total))}
                </span>
              </div>
            )}
            <div className="my-2.5">
              <Rule />
            </div>
            <div className="flex items-baseline justify-between">
              <Label>{isInvoice ? "Total Due" : "Total"}</Label>
              <span className="font-grotesk text-2xl font-semibold tabular-nums tracking-tight">
                {money(Number(doc.total))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer pinned to the bottom of the page */}
      <div className="mt-auto pt-12">
        {(bank || doc.notes) && (
          <>
            <Rule className="bg-slate-200" />
            <div className="mt-5 grid grid-cols-2 gap-10">
              {bank && (
                <div>
                  <Label>Payment details</Label>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                    {bank}
                  </p>
                </div>
              )}
              {doc.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                    {doc.notes}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        <p className="mt-9 text-center font-grotesk text-[10px] uppercase tracking-[0.22em] text-slate-300">
          {business.business_name} — Thank you
        </p>
      </div>
    </div>
  );
}
