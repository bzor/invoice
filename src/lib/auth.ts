import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** The one email allowed to use this app. */
export function allowedEmail() {
  return (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
}

export function isAllowed(email: string | null | undefined) {
  const allow = allowedEmail();
  return !!email && !!allow && email.trim().toLowerCase() === allow;
}

/**
 * Returns the signed-in, allowlisted user or redirects to /login.
 * Use at the top of every protected Server Component / action.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowed(user.email)) {
    redirect("/login");
  }
  return user;
}
