import "server-only";

import { revalidatePath } from "next/cache";

import type { Db } from "@/lib/supabase/db";

// Client + contact writes shared by the web UI and the token API.

export type ClientInput = {
  id?: string;
  name: string;
  address: string;
  currency: string;
  default_net_terms: number | null;
  default_notes: string;
};

/** Create (no `id`) or update a client. Returns its id. */
export async function saveClientCore(db: Db, input: ClientInput): Promise<string> {
  const { id, ...payload } = input;
  payload.name = payload.name.trim();
  payload.currency = payload.currency || "USD";
  if (!payload.name) throw new Error("Client name is required");

  if (id) {
    const { error } = await db.from("clients").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${id}`);
    revalidatePath("/clients");
    return id;
  }

  const { data, error } = await db
    .from("clients")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  return (data as { id: string }).id;
}

export type ContactInput = {
  id?: string;
  client_id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  is_primary: boolean;
  notes: string;
};

/** Create (no `id`) or update a contact. Returns its id. */
export async function saveContactCore(db: Db, input: ContactInput): Promise<string> {
  const { id, ...payload } = input;
  payload.name = payload.name.trim();
  if (!payload.name) throw new Error("Contact name is required");

  // Only one primary contact per client.
  if (payload.is_primary) {
    await db
      .from("contacts")
      .update({ is_primary: false })
      .eq("client_id", payload.client_id);
  }

  let contactId = id;
  if (id) {
    const { error } = await db.from("contacts").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db
      .from("contacts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    contactId = (data as { id: string }).id;
  }

  revalidatePath(`/clients/${payload.client_id}`);
  return contactId!;
}
