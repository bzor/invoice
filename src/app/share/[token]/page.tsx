import { notFound } from "next/navigation";

import { DocumentPreview } from "@/components/document-preview";
import { ShareActions } from "@/components/share-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SharedDocumentPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_shared_document", { p_token: token });

  if (!data) notFound();
  const payload = data as SharedDocumentPayload;
  const { document: doc, line_items, client, business } = payload;

  if (doc.type !== "estimate") notFound();

  return (
    <main className="min-h-full bg-slate-100 py-10">
      <div className="mx-auto max-w-3xl space-y-5 px-4">
        <ShareActions token={token} initialStatus={doc.status} />
        <DocumentPreview
          doc={doc}
          client={client}
          contact={null}
          lineItems={line_items}
          business={{
            business_name: business.business_name,
            business_address: business.business_address,
            logo_url: business.logo_url,
            bank_domestic: business.bank_domestic,
            bank_international: business.bank_international,
          }}
        />
      </div>
    </main>
  );
}
