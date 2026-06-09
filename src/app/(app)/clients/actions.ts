"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
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

  const id = str(formData, "id");
  const payload = {
    name: str(formData, "name"),
    address: str(formData, "address"),
    currency: str(formData, "currency") || "USD",
    default_net_terms: intOrNull(formData, "default_net_terms"),
    default_notes: str(formData, "default_notes"),
  };

  if (!payload.name) throw new Error("Client name is required");

  if (id) {
    await supabase.from("clients").update(payload).eq("id", id);
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}`);
  } else {
    const { data } = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();
    revalidatePath("/clients");
    redirect(`/clients/${(data as { id: string }).id}`);
  }
}

export async function deleteClient(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = str(formData, "id");
  await supabase.from("clients").delete().eq("id", id);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function saveContact(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();

  const id = str(formData, "id");
  const clientId = str(formData, "client_id");
  const payload = {
    client_id: clientId,
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    title: str(formData, "title"),
    is_primary: formData.get("is_primary") === "on",
    notes: str(formData, "notes"),
  };

  if (!payload.name) throw new Error("Contact name is required");

  // Only one primary contact per client.
  if (payload.is_primary) {
    await supabase
      .from("contacts")
      .update({ is_primary: false })
      .eq("client_id", clientId);
  }

  if (id) {
    await supabase.from("contacts").update(payload).eq("id", id);
  } else {
    await supabase.from("contacts").insert(payload);
  }

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteContact(formData: FormData) {
  await requireUser();
  const supabase = await createSupabase();
  const id = str(formData, "id");
  const clientId = str(formData, "client_id");
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
