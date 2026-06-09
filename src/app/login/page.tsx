"use client";

import { useActionState } from "react";

import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  return (
    <main className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-lg font-semibold text-white">
            B
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Bzor Invoice
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with a magic link
          </p>
        </div>

        {state.sent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Check your inbox — we sent you a sign-in link.
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-900"
            />
            {state.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-black px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
