BEGIN;
delete from public.attendance_staff;
delete from public.attendance;
delete from public.exam_results;
delete from public.badge_awards;
delete from public.members;
COMMIT;
-- @RUN
select 'members' t, count(*) from public.members
union all select 'attendance', count(*) from public.attendance
union all select 'attendance_staff', count(*) from public.attendance_staff
union all select 'exam_results', count(*) from public.exam_results
union all select 'stage_classes_kept', count(*) from public.stage_classes
union all select 'profiles_kept', count(*) from public.profiles
union all select 'auth_users_kept', count(*) from auth.users;
-- @RUN
select role, email from public.profiles p join auth.users u on u.id = p.id;
