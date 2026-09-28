select jsonb_pretty(jsonb_build_object(
  'taken_at', now(),
  'members', (select jsonb_agg(to_jsonb(m) order by m.created_at) from public.members m),
  'attendance', (select jsonb_agg(to_jsonb(a) order by a.scanned_at) from public.attendance a),
  'attendance_staff', (select jsonb_agg(to_jsonb(s)) from public.attendance_staff s),
  'exam_results', (select jsonb_agg(to_jsonb(e)) from public.exam_results e),
  'stage_classes', (select jsonb_agg(to_jsonb(c) order by c.stage_key, c.name) from public.stage_classes c)
)) as backup;
