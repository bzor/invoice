import { EditorPage } from "@/components/editor-page";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorPage type="invoice" docId={id} />;
}
