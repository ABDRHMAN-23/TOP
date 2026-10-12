-- Keep office-only selling context separate from public property facts.
-- This migration is additive and does not alter or delete existing property data.
alter table public.aqarflow_properties
  add column if not exists property_photos text[] not null default '{}'::text[],
  add column if not exists office_notes text;

comment on column public.aqarflow_properties.property_photos is
  'Office-managed photo URLs for this listing. URLs are metadata, not proof of availability.';
comment on column public.aqarflow_properties.office_notes is
  'Private workspace notes for the sales assistant, including additional fees and owner-approved negotiation guidance. Never expose verbatim by default.';
