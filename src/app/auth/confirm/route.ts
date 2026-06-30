import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isAllowed } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Verifies a magic-link token hash, then enforces the allowlist.
//
// Unlike the PKCE code-exchange flow in ./callback, verifyOtp validates the
// token entirely server-side and needs no browser-stored code verifier, so it
// survives the device/browser switch that happens when a mobile mail app opens
// the link in its own in-app webview.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isAllowed(user?.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_allowed`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
