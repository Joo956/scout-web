select tc.table_name, kcu.column_name, rc.delete_rule
from information_schema.referential_constraints rc
join information_schema.table_constraints tc on tc.constraint_name = rc.constraint_name and tc.constraint_type='FOREIGN KEY'
join information_schema.key_column_usage kcu on kcu.constraint_name = rc.constraint_name
join information_schema.table_constraints tc2 on tc2.constraint_name = rc.unique_constraint_name
where tc2.table_name = 'members' and tc.table_name <> 'members';
-- @RUN
select 'attendance' t, count(*) from attendance
union all select 'attendance_staff', count(*) from attendance_staff
union all select 'exam_results', count(*) from exam_results
union all select 'badge_awards', count(*) from badge_awards
union all select 'orders', count(*) from orders
union all select 'members', count(*) from members
union all select 'stage_classes', count(*) from stage_classes
union all select 'profiles', count(*) from profiles;
-- @RUN
select id, email from auth.users order by created_at;
