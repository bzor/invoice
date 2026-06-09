import Link from "next/link";

import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listClients } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <>
      <PageHeader
        title="Clients"
        action={<LinkButton href="/clients/new">New client</LinkButton>}
      />

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Add your first client to start invoicing."
          action={<LinkButton href="/clients/new">New client</LinkButton>}
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Currency</th>
                <th className="px-5 py-3 font-medium">Contacts</th>
                <th className="px-5 py-3 font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    <Link href={`/clients/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.currency}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {c.contacts?.[0]?.count ?? 0}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {c.documents?.[0]?.count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
