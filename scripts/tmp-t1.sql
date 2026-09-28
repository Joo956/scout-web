select m.id, m.name, m.email, m.user_id, m.scout_stage, m.class_id, sc.name as class_name
from public.members m left join public.stage_classes sc on sc.id = m.class_id;
-- @RUN
select sc.id, sc.stage_key, sc.name from public.stage_classes sc where sc.stage_key = 'kashaf' order by sc.name;
