select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as admin_ctx;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as admin_ctx;
select public.assign_member_class('a6c3010a-77f1-4e1b-bd92-30a07856a12d', '27652595-92fb-42e2-8b62-a28cb19d6646')->>'message' as step1_distribute_beshoy;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as admin_ctx;
select public.assign_attendance_staff('class_supervisor','kashaf','27652595-92fb-42e2-8b62-a28cb19d6646','a6c3010a-77f1-4e1b-bd92-30a07856a12d')->>'message' as step2_class_supervisor;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"e4d5724d-515e-43f0-a15f-100734f69e94","role":"authenticated"}', false) as admin_ctx;
select public.assign_attendance_staff('stage_supervisor','kashaf',null,'ea5193c8-79b8-479f-b6a8-c2fcb246e737')->>'message' as step3_stage_supervisor_marina;
