import { DocumentsTable } from "@/components/documents-table";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listDocuments } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const docs = await listDocuments("estimate");

  return (
    <>
      <PageHeader
        title="Estimates"
        action={<LinkButton href="/estimates/new">New estimate</LinkButton>}
      />
      {docs.length === 0 ? (
        <EmptyState
          title="No estimates yet"
          action={<LinkButton href="/estimates/new">New estimate</LinkButton>}
        />
      ) : (
        <DocumentsTable docs={docs} />
      )}
    </>
  );
}
