begin;
select set_config('request.jwt.claims', '{"sub":"3f23aa50-41a3-4d3a-92b9-405bede43b3f","role":"authenticated"}', true) as ctx;
set local role authenticated;
select count(*) as staff_rows from public.attendance_staff;
rollback;
-- @RUN
select pg_get_functiondef('public.is_admin()'::regprocedure);
-- @RUN
select pg_get_functiondef('public.attendance_can_manage_stage(text)'::regprocedure);
