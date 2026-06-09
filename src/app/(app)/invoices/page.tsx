import { DocumentsTable } from "@/components/documents-table";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listDocuments } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const docs = await listDocuments("invoice");

  return (
    <>
      <PageHeader
        title="Invoices"
        action={<LinkButton href="/invoices/new">New invoice</LinkButton>}
      />
      {docs.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          action={<LinkButton href="/invoices/new">New invoice</LinkButton>}
        />
      ) : (
        <DocumentsTable docs={docs} />
      )}
    </>
  );
}
