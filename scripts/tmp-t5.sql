select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select public.my_attendance_scope() as beshoy_scope;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select count(*) as roster_kashaf_fasl1 from public.get_class_roster('27652595-92fb-42e2-8b62-a28cb19d6646', current_date);
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select count(*) as roster_kashaf_fasl2_DENY from public.get_class_roster('a4a455f1-5957-4d99-bd37-2b8bf2eca712', current_date);
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select public.lookup_scout_for_attendance('#AE-2000-1908-By.Sh') as beshoy_lookup;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select public.record_attendance('#AE-2000-1908-By.Sh')->>'message' as double_record_guard;
-- @RUN
select set_config('request.jwt.claims', '{"sub":"13b403ec-4ae3-4817-8722-fa85cf4d7b1b","role":"authenticated"}', false) as ctx;
select public.scan_attendance('#AE-2000-1908-By.Sh')->>'message' as old_scan_no_auto;
