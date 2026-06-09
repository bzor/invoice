import { notFound } from "next/navigation";

import { DocumentEditor } from "@/components/document-editor";
import { PageHeader } from "@/components/ui";
import { getDocument, getSettings, listClientsForEditor } from "@/lib/data";
import type { DocType } from "@/lib/types";

export async function EditorPage({
  type,
  docId,
  defaultClientId,
}: {
  type: DocType;
  docId?: string;
  defaultClientId?: string;
}) {
  const [clients, settings, doc] = await Promise.all([
    listClientsForEditor(),
    getSettings(),
    docId ? getDocument(docId) : Promise.resolve(null),
  ]);

  if (docId && !doc) notFound();

  const label = type === "invoice" ? "invoice" : "estimate";

  return (
    <div className="max-w-4xl">
      <PageHeader title={doc ? `Edit ${doc.number}` : `New ${label}`} />
      <DocumentEditor
        type={type}
        clients={clients}
        doc={doc ?? undefined}
        defaultClientId={defaultClientId}
        settingsDefaults={{
          net_terms: settings.default_net_terms,
          notes: settings.default_notes,
        }}
      />
    </div>
  );
}
