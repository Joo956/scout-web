begin;
select set_config('request.jwt.claims', '{"sub":"3f23aa50-41a3-4d3a-92b9-405bede43b3f","role":"authenticated"}', true) as ctx;
set local role authenticated;
select count(*) as admin_sees_all_staff from public.attendance_staff;
rollback;
-- @RUN
begin;
select set_config('request.jwt.claims', '{"sub":"dc04433a-70c5-4c28-bb4a-37cc48a577ec","role":"authenticated"}', true) as ctx;
set local role authenticated;
select count(*) as member_sees_staff from public.attendance_staff;
rollback;
