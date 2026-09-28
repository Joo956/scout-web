select column_name from information_schema.columns where table_name='profiles' and table_schema='public';
-- @RUN
select p.id, p.role from public.profiles p;
