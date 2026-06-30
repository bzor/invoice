"use server";

import { revalidatePath } from "next/cache";

import { estimateResponseEmailHtml, sendPlainEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Best-effort: email the business owner that a client responded. */
async function notifyOwner(
  supabase: ReturnType<typeof createAdminClient>,
  token: string,
  approve: boolean,
) {
  try {
    const { data: docRow } = await supabase
      .from("documents")
      .select("id, number, client:clients(name)")
      .eq("share_token", token)
      .single();
    const { data: settings } = await supabase
      .from("settings")
      .select("business_email, business_name")
      .eq("id", 1)
      .single();

    const ownerEmail = (settings as { business_email?: string } | null)
      ?.business_email;
    if (!ownerEmail || !docRow) return;

    const d = docRow as { id: string; number: string; client: unknown };
    const c = d.client as { name?: string } | { name?: string }[] | null;
    const clientName =
      (Array.isArray(c) ? c[0]?.name : c?.name) ?? "A client";

    await sendPlainEmail({
      to: ownerEmail,
      subject: `Estimate ${d.number} ${approve ? "approved" : "declined"}`,
      html: estimateResponseEmailHtml({
        number: d.number,
        clientName,
        approved: approve,
        reviewUrl: `${siteUrl()}/estimates/${d.id}`,
      }),
    });
  } catch {
    // Notification is non-critical — never block the client's response.
  }
}

export async function respondToEstimate(
  token: string,
  approve: boolean,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("respond_to_estimate", {
    p_token: token,
    p_approve: approve,
  });
  if (error) return { ok: false, error: error.message };

  const result = data as { ok: boolean; status?: string; error?: string };
  if (result.ok) await notifyOwner(supabase, token, approve);

  revalidatePath(`/share/${token}`);
  return result;
}
