"use client";

import { useState, useTransition } from "react";

import { respondToEstimate } from "@/app/share/[token]/actions";
import { buttonClass } from "@/components/ui";

export function ShareActions({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "approved") {
    return (
      <div className="border border-line bg-surface px-5 py-4 text-sm font-medium text-accent">
        ✓ You approved this estimate. Thank you!
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="border border-line bg-canvas px-5 py-4 text-sm font-medium text-muted">
        This estimate was declined.
      </div>
    );
  }

  function respond(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await respondToEstimate(token, approve);
      if (res.ok && res.status) setStatus(res.status);
      else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="border border-line bg-surface p-5">
      <p className="mb-3 font-grotesk text-xs uppercase tracking-wider text-muted">
        Ready to proceed?
      </p>
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => respond(true)}
          className={buttonClass("primary")}
        >
          Approve estimate
        </button>
        <button
          disabled={pending}
          onClick={() => respond(false)}
          className={buttonClass("secondary")}
        >
          Decline
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-alert">{error}</p>}
    </div>
  );
}
