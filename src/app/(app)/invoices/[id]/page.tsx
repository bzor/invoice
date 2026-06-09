import { notFound } from "next/navigation";

import { DocumentDetail } from "@/components/document-detail";
import {
  getDocument,
  getSettings,
  listContactEmailsForClient,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, settings] = await Promise.all([getDocument(id), getSettings()]);
  if (!doc || doc.type !== "invoice") notFound();

  const contacts = await listContactEmailsForClient(doc.client_id);

  return <DocumentDetail doc={doc} settings={settings} contacts={contacts} />;
}
