import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteClient } from "@/app/(app)/clients/actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ContactsSection } from "@/components/contacts-section";
import {
  LinkButton,
  PageHeader,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import { getClient, getClientStats, listDocumentsForClient } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

// Shared column template for the documents list.
const DOCCOLS = "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, docs, stats] = await Promise.all([
    getClient(id),
    listDocumentsForClient(id),
    getClientStats(id),
  ]);
  if (!client) notFound();

  const fmt = (n: number) => formatMoney(n, stats.baseCurrency);

  const contacts = [...client.contacts].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={[client.currency, client.address].filter(Boolean).join(" · ")}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/estimates/new?client=${client.id}`} variant="secondary">
              New estimate
            </LinkButton>
            <LinkButton href={`/invoices/new?client=${client.id}`}>
              New invoice
            </LinkButton>
          </div>
        }
      />

      {/* Lifetime money rollup (base currency) */}
      <section className="mb-10 grid grid-cols-3 divide-x divide-line border-y border-line">
        <div className="px-8 py-5 first:pl-0">
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
            Invoiced
          </p>
          <p className="mt-1.5 text-2xl font-medium tnum text-ink">
            {fmt(stats.invoiced)}
          </p>
        </div>
        <div className="px-8 py-5">
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
            Paid
          </p>
          <p className="mt-1.5 text-2xl font-medium tnum text-accent">
            {fmt(stats.paid)}
          </p>
        </div>
        <div className="px-8 py-5 last:pr-0">
          <p className="font-grotesk text-xs uppercase tracking-wider text-muted">
            Outstanding
          </p>
          <p
            className={`mt-1.5 text-2xl font-medium tnum ${
              stats.outstanding > 0.005 ? "text-alert" : "text-faint"
            }`}
          >
            {fmt(stats.outstanding)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted">
            Documents
          </h2>
          {docs.length === 0 ? (
            <p className="py-8 text-sm text-faint">
              No estimates or invoices yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`}
                    className={`-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-6 px-2 py-3 text-sm transition hover:bg-hover ${DOCCOLS}`}
                  >
                    <span className="whitespace-nowrap font-medium tnum text-ink">
                      {d.number}
                      <span className="ml-2 text-xs font-normal capitalize text-faint">
                        {d.type}
                      </span>
                    </span>
                    <span className="hidden truncate text-muted sm:block">
                      {d.subject || "—"}
                    </span>
                    <span className="whitespace-nowrap text-right tnum text-ink">
                      {formatMoney(Number(d.total), d.currency)}
                    </span>
                    <span className="hidden justify-self-end sm:flex">
                      <StatusBadge status={d.status} size="sm" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div>
          <section>
            <h2 className="border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted">
              Contacts
            </h2>
            <div className="mt-4">
              <ContactsSection clientId={client.id} contacts={contacts} />
            </div>
          </section>

          <div className="mt-8 flex gap-2 border-t border-line pt-6">
            <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
              Edit client
            </LinkButton>
            <form
              action={deleteClient}
              // Deleting is blocked by the DB if documents exist (on delete restrict).
            >
              <input type="hidden" name="id" value={client.id} />
              <ConfirmSubmit
                message="Delete this client? This cannot be undone."
                className={buttonClass("danger")}
              >
                Delete
              </ConfirmSubmit>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
