import Link from "next/link";

import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listClients } from "@/lib/data";

export const dynamic = "force-dynamic";

// Shared column template — header and rows use the same grid so columns line up.
const COLS = "sm:grid-cols-[1fr_6rem_7rem_8rem]";

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
        <div>
          <div
            className={`hidden border-b border-line pb-2 font-grotesk text-xs uppercase tracking-wider text-muted sm:grid sm:gap-x-6 ${COLS}`}
          >
            <span>Name</span>
            <span>Currency</span>
            <span className="text-right">Contacts</span>
            <span className="text-right">Documents</span>
          </div>

          <ul className="divide-y divide-line">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className={`-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-6 px-2 py-3 text-sm transition hover:bg-hover ${COLS}`}
                >
                  <span className="truncate font-medium text-ink">{c.name}</span>
                  <span className="hidden text-muted sm:block">{c.currency}</span>
                  <span className="hidden text-right tnum text-muted sm:block">
                    {c.contacts?.[0]?.count ?? 0}
                  </span>
                  <span className="text-right tnum text-muted">
                    {c.documents?.[0]?.count ?? 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
