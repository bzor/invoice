import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { EmailEventRow } from "@/lib/types";

/**
 * Link a freshly-sent Resend message to a document so later webhook events
 * (delivered / opened / bounced) can be attributed back to it. Best-effort:
 * a failure here must never break the send, so we swallow errors.
 */
export async function recordSentEmail(opts: {
  documentId: string;
  resendId: string | null;
  to: string;
}) {
  if (!opts.resendId) return;
  try {
    const supabase = await createClient();
    await supabase.from("email_events").upsert(
      {
        document_id: opts.documentId,
        resend_email_id: opts.resendId,
        type: "sent",
        recipient: opts.to,
        event_id: `${opts.resendId}:sent`,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
  } catch {
    // Delivery tracking is non-critical; never fail the send over it.
  }
}

export async function listEmailEvents(
  documentId: string,
): Promise<EmailEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_events")
    .select("*")
    .eq("document_id", documentId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as unknown as EmailEventRow[];
}
