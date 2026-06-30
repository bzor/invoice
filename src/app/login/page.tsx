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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center bg-ink font-grotesk text-lg font-semibold text-surface">
            B
          </div>
          <h1 className="font-grotesk text-xl font-semibold uppercase tracking-tight text-ink">
            Bzor Invoice
          </h1>
          <p className="mt-1 font-grotesk text-xs uppercase tracking-wider text-muted">
            Sign in with a magic link
          </p>
        </div>

        {state.sent ? (
          <div className="border border-line bg-surface p-4 text-sm text-accent">
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
              className="w-full border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint focus:border-ink"
            />
            {state.error && (
              <p className="text-sm text-alert">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-ink px-3 py-2.5 font-grotesk text-xs font-medium uppercase tracking-wider text-surface transition hover:opacity-85 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
