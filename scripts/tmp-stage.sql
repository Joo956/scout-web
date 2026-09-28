select coalesce(public.stage_key_of(scout_stage), '(unknown)') as stage_key, scout_stage, count(*) from public.members group by scout_stage, public.stage_key_of(scout_stage) order by 3 desc;
-- @RUN
select sc.stage_key, sc.name as class_name, count(m.id) as members_count
from public.stage_classes sc left join public.members m on m.class_id = sc.id
group by sc.stage_key, sc.name order by sc.stage_key, sc.name;
-- @RUN
select m.name, m.scout_stage, public.stage_key_of(m.scout_stage) as mapped, sc.name as class_name
from public.members m left join public.stage_classes sc on sc.id = m.class_id
where sc.stage_key = 'ashbal' or public.stage_key_of(m.scout_stage) = 'ashbal' limit 15;
