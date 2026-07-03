-- Email delivery events, fed by the Resend webhook.
-- "Delivered" from Resend only means the recipient's server accepted the
-- message; opens/bounces/complaints arrive later as webhook events. We store
-- them here so the invoice UI can show real delivery state instead of us
-- digging through the Resend dashboard.

create table email_events (
  id uuid primary key default gen_random_uuid(),
  -- Attributed back to a document via the sent-link row written at send time.
  document_id uuid references documents(id) on delete cascade,
  resend_email_id text,
  -- Resend event type with the "email." prefix stripped: sent, delivered,
  -- delivery_delayed, opened, clicked, bounced, complained, failed.
  type text not null,
  recipient text not null default '',
  -- Free-text context: bounce reason, clicked link, etc.
  detail text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Idempotency key. For webhook rows this is the Svix message id; for the
  -- send-time link row it's "<resend_email_id>:sent". Dedupes provider retries.
  event_id text unique
);

create index email_events_document_idx on email_events (document_id, occurred_at desc);
create index email_events_resend_idx on email_events (resend_email_id);

alter table email_events enable row level security;
create policy app_all on email_events
  for all to authenticated using (true) with check (true);
