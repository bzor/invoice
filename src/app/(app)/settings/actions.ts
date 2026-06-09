"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient as createSupabase } from "@/lib/supabase/server";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function int(form: FormData, key: string, fallback = 0) {
  const v = Number(form.get(key));
  return Number.isFinite(v) ? v : fallback;
}

export async function saveSettings(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const payload: Record<string, unknown> = {
    business_name: str(formData, "business_name"),
    business_address: str(formData, "business_address"),
    business_email: str(formData, "business_email"),
    base_currency: str(formData, "base_currency") || "USD",
    bank_domestic: str(formData, "bank_domestic"),
    bank_international: str(formData, "bank_international"),
    default_notes: str(formData, "default_notes"),
    default_net_terms: int(formData, "default_net_terms", 30),
    invoice_prefix: str(formData, "invoice_prefix") || "INV",
    estimate_prefix: str(formData, "estimate_prefix") || "EST",
    invoice_counter: int(formData, "invoice_counter", 1),
    estimate_counter: int(formData, "estimate_counter", 1),
    number_padding: int(formData, "number_padding", 4),
  };

  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const ext = logo.name.split(".").pop() || "png";
    const path = `logo.${ext}`;
    const bytes = Buffer.from(await logo.arrayBuffer());
    await supabase.storage
      .from("branding")
      .upload(path, bytes, { contentType: logo.type, upsert: true });
    const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
    // Cache-bust so an updated logo at the same path refreshes.
    payload.logo_url = `${pub.publicUrl}?v=${Date.now()}`;
  }

  await supabase.from("settings").update(payload).eq("id", 1);
  revalidatePath("/settings");
  revalidatePath("/");
}
