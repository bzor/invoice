"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

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
  revalidatePath(`/share/${token}`);
  return data as { ok: boolean; status?: string; error?: string };
}
