-- Keep office-only selling context separate from public property facts.
-- This migration is additive and does not alter or delete existing property data.
alter table public.aqarflow_properties
  add column if not exists property_photos text[] not null default '{}'::text[],
  add column if not exists office_notes text;

comment on column public.aqarflow_properties.property_photos is
  'Office-managed photo URLs for this listing. URLs are metadata, not proof of availability.';
comment on column public.aqarflow_properties.office_notes is
  'Private workspace notes for the sales assistant, including additional fees and owner-approved negotiation guidance. Never expose verbatim by default.';

-- Listing photos are customer-facing assets. Uploads are restricted to the authenticated
-- workspace owner folder; public reads are intentional because property photos appear in listings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aqarflow-property-photos',
  'aqarflow-property-photos',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "AqarFlow listing photos are public" on storage.objects;
create policy "AqarFlow listing photos are public"
  on storage.objects for select
  using (bucket_id = 'aqarflow-property-photos');

drop policy if exists "AqarFlow owners upload listing photos" on storage.objects;
create policy "AqarFlow owners upload listing photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aqarflow-property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "AqarFlow owners update listing photos" on storage.objects;
create policy "AqarFlow owners update listing photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'aqarflow-property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'aqarflow-property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "AqarFlow owners delete listing photos" on storage.objects;
create policy "AqarFlow owners delete listing photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'aqarflow-property-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
