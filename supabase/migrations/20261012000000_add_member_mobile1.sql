-- Preserve the first mobile number from the Excel import.
alter table public.members
  add column if not exists mobile1 text;
