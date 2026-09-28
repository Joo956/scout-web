select set_config('request.jwt.claims', '{"sub":"3f23aa50-41a3-4d3a-92b9-405bede43b3f","role":"authenticated"}', false) as admin_ctx;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"3f23aa50-41a3-4d3a-92b9-405bede43b3f","role":"authenticated"}', false) as admin_ctx;
select public.assign_member_class('d5f0c1f6-9b43-43e4-903c-6478164deb72', null)->>'message' as fix;
-- @RUN
select m.name, m.scout_stage, sc.name as class_name
from public.members m left join public.stage_classes sc on sc.id = m.class_id
where sc.stage_key <> coalesce(public.stage_key_of(m.scout_stage), '') or (m.class_id is not null and public.stage_key_of(m.scout_stage) is null);
