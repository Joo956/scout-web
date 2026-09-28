select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as ctx;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as ctx;
select public.unassign_attendance_staff(s.id)->>'message' as cleanup
from public.attendance_staff s;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as ctx;
select public.assign_member_class('a6c3010a-77f1-4e1b-bd92-30a07856a12d', null)->>'message' as cleanup_class;
-- @RUN
select set_config('request.jwt.claims', '', false) as reset_ctx;
select (select count(*) from public.attendance_staff) as staff_after_cleanup,
       (select count(*) from public.attendance) as attendance_rows_unchanged,
       (select count(*) from public.stage_classes) as classes_unchanged;
