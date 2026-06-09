import { EditorPage } from "@/components/editor-page";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <EditorPage type="invoice" defaultClientId={client} />;
}
