select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
select public.my_attendance_scope()->>'assigned' as assigned,
       public.my_attendance_scope()->'stages' as my_stages;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
select (select count(*) from public.get_class_roster('27652595-92fb-42e2-8b62-a28cb19d6646', current_date)) as kashaf_fasl1_ok,
       (select count(*) from public.get_class_roster('a4a455f1-5957-4d99-bd37-2b8bf2eca712', current_date)) as kashaf_fasl2_ok;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
select count(*) as ashbal_DENY from public.get_class_roster((select id from public.stage_classes where stage_key='ashbal' and name='فصل 1'), current_date);
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
select public.record_attendance((select scout_code from public.members where name like 'يسى%'))->>'message' as record_yassa_no_class;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3e89ffa0-3b1e-4d7e-9c2f-4c34f8bbe3be","role":"authenticated"}', false) as ctx;
select scout_code, member_name, class_name from public.get_attendance_log_scoped(current_date);
