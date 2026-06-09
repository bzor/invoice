import { NextResponse } from "next/server";

import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${siteUrl()}/login`, { status: 303 });
}
