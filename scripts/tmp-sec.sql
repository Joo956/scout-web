select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname;
-- @RUN
select p.proname, p.prosecdef as security_definer, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
order by p.proname;
-- @RUN
select table_name, string_agg(privilege_type, ',') privs
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
group by table_name order by table_name;
-- @RUN
select schemaname, tablename, policyname, permissive, roles, cmd, qual
from pg_policies where schemaname='storage';
