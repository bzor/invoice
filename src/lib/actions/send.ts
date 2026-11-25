"use server";

import { requireUser } from "@/lib/auth";
import {
  sendDocumentCore,
  sendReminderCore,
  type SendResult,
} from "@/lib/core/send";
import { createClient as createSupabase } from "@/lib/supabase/server";

export async function sendDocument(input: {
  id: string;
  to?: string;
  message?: string;
}): Promise<SendResult> {
  await requireUser();
  return sendDocumentCore(await createSupabase(), input);
}

/** Email the invoice's contact a payment reminder, with the PDF attached. */
export async function sendReminder(id: string): Promise<SendResult> {
  await requireUser();
  return sendReminderCore(await createSupabase(), id);
}
