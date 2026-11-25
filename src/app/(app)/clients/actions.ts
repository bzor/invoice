"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { saveClientCore, saveContactCore } from "@/lib/core/clients";
import { setFlash } from "@/lib/flash";
import { createClient as createSupabase } from "@/lib/supabase/server";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function intOrNull(form: FormData, key: string) {
  const v = str(form, key);
  return v === "" ? null : Number(v);
}

export async function saveClient(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const existingId = str(formData, "id");
  const id = await saveClientCore(supabase, {
    id: existingId || undefined,
    name: str(formData, "name"),
    address: str(formData, "address"),
    currency: str(formData, "currency"),
    default_net_terms: intOrNull(formData, "default_net_terms"),
    default_notes: str(formData, "default_notes"),
  });

  await setFlash(existingId ? "Client saved" : "Client created");
  redirect(`/clients/${id}`);
}

export async function deleteClient(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = str(formData, "id");
  await supabase.from("clients").delete().eq("id", id);
  await setFlash("Client deleted");
  revalidatePath("/clients");
  redirect("/clients");
}

export async function saveContact(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const id = str(formData, "id");
  const clientId = str(formData, "client_id");
  await saveContactCore(supabase, {
    id: id || undefined,
    client_id: clientId,
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    title: str(formData, "title"),
    is_primary: formData.get("is_primary") === "on",
    notes: str(formData, "notes"),
  });

  await setFlash(id ? "Contact saved" : "Contact added");
  redirect(`/clients/${clientId}`);
}

export async function deleteContact(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = str(formData, "id");
  const clientId = str(formData, "client_id");
  await supabase.from("contacts").delete().eq("id", id);
  await setFlash("Contact removed");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
