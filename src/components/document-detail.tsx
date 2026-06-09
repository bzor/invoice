import Link from "next/link";

import { DocumentActions } from "@/components/document-actions";
import { DocumentPreview } from "@/components/document-preview";
import { PaymentsPanel } from "@/components/payments-panel";
import { Card, StatusBadge } from "@/components/ui";
import { amountPaid } from "@/lib/data";
import { effectiveStatus } from "@/lib/status";
import type { DocumentWithRelations, Settings } from "@/lib/types";

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
  const typeLabel = doc.type === "invoice" ? "Invoice" : "Estimate";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {doc.number}
          </h1>
          <span className="text-sm text-slate-400">{typeLabel}</span>
          <StatusBadge status={status} />
        </div>
        <Link
          href={`/${doc.type === "invoice" ? "invoices" : "estimates"}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {convertedInvoice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Converted to invoice{" "}
          <Link href={`/invoices/${convertedInvoice.id}`} className="font-semibold underline">
            {convertedInvoice.number}
          </Link>
          .
        </div>
      )}

      {doc.type === "invoice" && doc.source_estimate_id && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <DocumentActions
              id={doc.id}
              type={doc.type}
              status={status}
              shareToken={doc.share_token}
              defaultEmail={doc.contact?.email ?? ""}
              contacts={contacts}
            />
          </Card>

          {doc.type === "invoice" && (
            <PaymentsPanel
              invoiceId={doc.id}
              currency={doc.currency}
              total={Number(doc.total)}
              payments={doc.payments ?? []}
            />
          )}
        </div>

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
      </div>
    </div>
  );
}
