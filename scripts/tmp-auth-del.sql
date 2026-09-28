BEGIN;
delete from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);
COMMIT;
-- @RUN
select u.email, p.role from auth.users u left join public.profiles p on p.id = u.id order by u.email;
-- @RUN
select count(*) as remaining_auth_users from auth.users;
