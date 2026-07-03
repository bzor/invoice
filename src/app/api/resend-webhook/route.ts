import { createHmac, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// Signature verification needs the raw body + Node crypto, so force the
// Node.js runtime and run on every request (never cached/prerendered).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reject events older than this to blunt replay attacks (Svix convention).
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Resend/Svix webhook signature.
 * Signed content is `${id}.${timestamp}.${body}`, HMAC-SHA256 with the secret
 * (base64 after the `whsec_` prefix). The signature header is a space-separated
 * list of `v1,<sig>` tokens; any match is valid.
 */
function verify(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  return signatureHeader.split(" ").some((token) => {
    const sig = token.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

type ResendWebhook = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    created_at?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    click?: { link?: string };
    reason?: string;
  };
};

/** A short human-readable note for the event, when the payload offers one. */
function detailFor(data: NonNullable<ResendWebhook["data"]>): string {
  if (data.bounce?.message) return data.bounce.message;
  if (data.bounce?.subType) return data.bounce.subType;
  if (data.reason) return data.reason;
  if (data.click?.link) return data.click.link;
  return "";
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  // Raw body is required — parsing then re-stringifying would break the HMAC.
  const body = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const ts = Number(timestamp);
  if (
    !Number.isFinite(ts) ||
    Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS
  ) {
    return new Response("Timestamp out of tolerance", { status: 400 });
  }

  if (!verify(secret, id, timestamp, body, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: ResendWebhook;
  try {
    event = JSON.parse(body) as ResendWebhook;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const data = event.data ?? {};
  const resendId = data.email_id ?? null;
  const shortType = (event.type ?? "unknown").replace(/^email\./, "");
  const recipient = Array.isArray(data.to) ? data.to.join(", ") : data.to ?? "";

  const supabase = createAdminClient();

  // Attribute the event to a document via the send-time link row.
  let documentId: string | null = null;
  if (resendId) {
    const { data: link } = await supabase
      .from("email_events")
      .select("document_id")
      .eq("resend_email_id", resendId)
      .not("document_id", "is", null)
      .limit(1)
      .maybeSingle();
    documentId = (link?.document_id as string | undefined) ?? null;
  }

  const { error } = await supabase.from("email_events").upsert(
    {
      document_id: documentId,
      resend_email_id: resendId,
      type: shortType,
      recipient,
      detail: detailFor(data),
      occurred_at: event.created_at ?? data.created_at ?? new Date().toISOString(),
      event_id: id, // Svix message id → idempotent against retries.
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[resend-webhook] insert failed:", error.message);
    return new Response("Storage error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
