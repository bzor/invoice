import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteClient } from "@/app/(app)/clients/actions";
import { ContactsSection } from "@/components/contacts-section";
import {
  Card,
  LinkButton,
  PageHeader,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import { getClient, listDocumentsForClient } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, docs] = await Promise.all([
    getClient(id),
    listDocumentsForClient(id),
  ]);
  if (!client) notFound();

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
            </div>
            {docs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                No estimates or invoices yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/${d.type === "invoice" ? "invoices" : "estimates"}/${d.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {d.number}
                        </Link>
                        <span className="ml-2 text-xs capitalize text-slate-400">
                          {d.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {d.subject || "—"}
                      </td>
                      <td className="px-5 py-3 text-right tnum text-slate-700">
                        {formatMoney(Number(d.total), d.currency)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Contacts</h2>
            <ContactsSection clientId={client.id} contacts={contacts} />
          </Card>

          <div className="flex gap-2">
            <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
              Edit client
            </LinkButton>
            <form
              action={deleteClient}
              // Deleting is blocked by the DB if documents exist (on delete restrict).
            >
              <input type="hidden" name="id" value={client.id} />
              <button type="submit" className={buttonClass("danger")}>
                Delete
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
