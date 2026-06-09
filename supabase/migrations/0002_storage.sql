-- Storage buckets: private PDFs, public branding (logo).

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do nothing;

-- Authenticated users manage everything in both buckets.
create policy "auth read documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents');
create policy "auth write documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');
create policy "auth update documents" on storage.objects
  for update to authenticated using (bucket_id = 'documents');
create policy "auth delete documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');

create policy "auth manage branding" on storage.objects
  for all to authenticated using (bucket_id = 'branding') with check (bucket_id = 'branding');

-- Anyone can read branding (logo shown on public estimate pages / PDFs).
create policy "public read branding" on storage.objects
  for select to anon using (bucket_id = 'branding');
