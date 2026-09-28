select 'members' t, count(*) from public.members union all select 'attendance', count(*) from public.attendance union all select 'attendance_staff', count(*) from public.attendance_staff union all select 'exam_results', count(*) from public.exam_results union all select 'badge_awards', count(*) from public.badge_awards union all select 'stage_classes_kept', count(*) from public.stage_classes;
-- @RUN
select stage_key, name from public.stage_classes order by stage_key, name;
-- @RUN
select count(*) as auth_users from auth.users;
