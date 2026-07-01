import Link from "next/link";

import { DocumentActions } from "@/components/document-actions";
import { DocumentPreview } from "@/components/document-preview";
import { PaymentsPanel } from "@/components/payments-panel";
import { PreviewFit } from "@/components/preview-fit";
import { StatusBadge } from "@/components/ui";
import { amountPaid } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { effectiveStatus } from "@/lib/status";
import type { DocumentWithRelations, Settings } from "@/lib/types";

function Stat({
  label,
  value,
  tone = "default",
  note,
}: {
  label: string;
  value: string;
  tone?: "default" | "alert" | "accent" | "muted";
  note?: string;
}) {
  const color =
    tone === "alert"
      ? "text-alert"
      : tone === "accent"
        ? "text-accent"
        : tone === "muted"
          ? "text-faint"
          : "text-ink";
  return (
    <div className="py-4 sm:px-8 sm:py-6 sm:first:pl-0 sm:last:pr-0">
      <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-medium tnum ${color}`}>{value}</p>
      {note && (
        <p className="mt-1 font-grotesk text-[11px] uppercase tracking-wider text-faint">
          {note}
        </p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

export function DocumentDetail({
  doc,
  settings,
  contacts,
  convertedInvoice,
}: {
  doc: DocumentWithRelations;
  settings: Settings;
  contacts: { name: string; email: string }[];
  convertedInvoice?: { id: string; number: string } | null;
}) {
  const paid = amountPaid(doc.payments);
  const status = effectiveStatus(doc, paid);
  const isInvoice = doc.type === "invoice";
  const typeLabel = isInvoice ? "Invoice" : "Estimate";

  const total = Number(doc.total);
  const due = Math.max(0, total - paid);
  const overdue = status === "overdue";
  const money = (n: number) => formatMoney(n, doc.currency);
  const client = doc.client?.name;
  const issued = formatDate(doc.issue_date);
  const dueDate = doc.due_date ? formatDate(doc.due_date) : null;

  return (
    <div>
      {/* Header — identity, status, and the at-a-glance context line */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-grotesk text-3xl font-semibold uppercase tracking-tight tnum text-ink">
              {doc.number}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-2 font-grotesk text-xs uppercase tracking-wider text-muted">
            {typeLabel}
            {client && <> · {client}</>}
            {` · Issued ${issued}`}
            {isInvoice && dueDate && (
              <>
                {" · "}
                <span className={overdue ? "text-alert" : undefined}>
                  {overdue ? "Overdue" : "Due"} {dueDate}
                </span>
              </>
            )}
          </p>
        </div>
        <Link
          href={`/${isInvoice ? "invoices" : "estimates"}`}
          className="shrink-0 font-grotesk text-xs uppercase tracking-wider text-muted transition hover:text-ink"
        >
          ← Back
        </Link>
      </div>

      {convertedInvoice && (
        <div className="mb-4 border border-line bg-surface px-4 py-3 text-sm text-accent">
          Converted to invoice{" "}
          <Link
            href={`/invoices/${convertedInvoice.id}`}
            className="font-semibold underline"
          >
            {convertedInvoice.number}
          </Link>
          .
        </div>
      )}

      {isInvoice && doc.source_estimate_id && (
        <div className="mb-4 border border-line bg-canvas px-4 py-3 text-sm text-muted">
          Created from estimate{" "}
          <Link
            href={`/estimates/${doc.source_estimate_id}`}
            className="font-semibold underline"
          >
            view
          </Link>
          .
        </div>
      )}

      {/* Summary band — the glanceable money picture */}
      {isInvoice ? (
        <section className="grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Stat label="Total" value={money(total)} />
          <Stat label="Paid" value={money(paid)} tone={paid > 0 ? "accent" : "muted"} />
          <Stat
            label="Amount due"
            value={money(due)}
            tone={overdue ? "alert" : due <= 0.005 ? "muted" : "default"}
            note={due <= 0.005 ? "Paid in full" : overdue ? "Past due" : undefined}
          />
        </section>
      ) : (
        <section className="grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <Stat label="Total" value={money(total)} />
          <Stat label="Issued" value={issued} />
        </section>
      )}

      {/* Control area — actions, and payments for invoices */}
      <div
        className={`mt-10 grid grid-cols-1 gap-x-12 gap-y-10 ${
          isInvoice ? "lg:grid-cols-2" : ""
        }`}
      >
        <section>
          <SectionLabel>Actions</SectionLabel>
          <div className="mt-4">
            <DocumentActions
              id={doc.id}
              type={doc.type}
              status={status}
              shareToken={doc.share_token}
              defaultEmail={doc.contact?.email ?? ""}
              contacts={contacts}
            />
          </div>
        </section>

        {isInvoice && (
          <section>
            <SectionLabel>Payments</SectionLabel>
            <div className="mt-4">
              <PaymentsPanel
                invoiceId={doc.id}
                currency={doc.currency}
                total={total}
                payments={doc.payments ?? []}
                contactEmail={doc.contact?.email ?? ""}
              />
            </div>
          </section>
        )}
      </div>

      {/* The document itself — a sheet on the canvas */}
      <section className="mt-14">
        <SectionLabel>Document preview</SectionLabel>
        <div className="mt-6">
          <PreviewFit>
          <DocumentPreview
            doc={doc}
            client={doc.client}
            contact={doc.contact}
            lineItems={doc.line_items}
            business={{
              business_name: settings.business_name,
              business_address: settings.business_address,
              business_email: settings.business_email,
              logo_url: settings.logo_url,
              bank_domestic: settings.bank_domestic,
              bank_international: settings.bank_international,
            }}
          />
          </PreviewFit>
        </div>
      </section>
    </div>
  );
}
