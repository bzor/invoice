import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Any Supabase client — the cookie-bound session client (web UI, RLS) or the
 * service-role client (token-authenticated API). Core business logic takes one
 * of these as its first argument so both entry points share the same code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;
