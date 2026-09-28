select p.id as admin_id, p.name from public.profiles p where p.role='admin' order by p.created_at nulls last limit 1;
-- @RUN
select m.scout_code, m.id from public.members m where m.name like 'بيشوى%';
