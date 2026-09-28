select count(*) as with_email from public.members where coalesce(email,chr(39)||chr(39)) <> chr(39)||chr(39);
-- @RUN
select count(*) as staff_rows from public.attendance_staff;
-- @RUN
select role, permissions from public.profiles order by role;
