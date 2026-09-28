// اختبار E2E شامل لمسار الطلب — كل حاجة في معاملة واحدة + rollback
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)[1];

const run = async (sql) => {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  return { status: res.status, body: await res.json() };
};

const sql = `
begin;
create temp table test_log(step text, detail text) on commit drop;
grant insert on test_log to authenticated;

do $test$
declare
  v_member uuid;
  v_admin uuid;
  v_product uuid;
  v_order jsonb;
  v_result jsonb;
begin
  -- اختار عضو عادي وأدمن حقيقيين
  select p.id into v_member from profiles p
   where p.role = 'member' and p.email is not null order by p.created_at limit 1;
  select p.id into v_admin from profiles p where p.role = 'admin' limit 1;
  insert into test_log values ('0-المستخدمين',
    format('عضو=%s | أدمن=%s', v_member, v_admin));

  if v_member is null or v_admin is null then
    insert into test_log values ('ABORT', 'مفيش عضو أو أدمن للاختبار');
    return;
  end if;

  select id into v_product from products where stock > 1 limit 1;

  -- ===== الخطوة 1: العضو يطلب من المتجر =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  v_order := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'qty', 1)),
    'عميل تجربة E2E');
  insert into test_log values ('1-العضو يطلب (Pending)',
    format('رقم=%s | status=%s | total=%s',
      v_order->>'order_id', v_order->>'status', v_order->>'total'));

  -- ===== الخطوة 2: العضو يحاول يوافق بنفسه → لازم يترفض =====
  begin
    perform public.set_order_status((v_order->>'id')::uuid, 'Approved');
    insert into test_log values ('2-العضو يحاول يوافق',
      'BUG: العضو وافق والمفروض يترفض!');
  exception when others then
    insert into test_log values ('2-العضو يحاول يوافق',
      'ترفض صح ✓ → ' || SQLERRM);
  end;

  -- ===== الخطوة 3: الأدمن يوافق =====
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_result := public.set_order_status((v_order->>'id')::uuid, 'Approved');
  insert into test_log values ('3-الأدمن يوافق (Approved)',
    format('status=%s | وافق=%s | في=%s',
      v_result->>'status', v_result->>'approved_by', v_result->>'approved_at'));

  -- ===== الخطوة 4: الأدمن يسكن QR الاستلام =====
  v_result := public.receive_order(v_order->>'order_id');
  insert into test_log values ('4-سكان QR (Received)',
    format('status=%s | سلم=%s | في=%s | اللي استلم=%s',
      v_result->>'status', v_result->>'received_by', v_result->>'received_at', v_result->>'customer'));

  -- ===== الخطوة 5: سكان مكرر لنفس الطلب =====
  v_result := public.receive_order(v_order->>'order_id');
  insert into test_log values ('5-سكان مكرر',
    format('رجع البيانات من غير تغيير → status=%s ✓', v_result->>'status'));

  -- ===== الخطوة 6: عضو عادي يحاول يستلم → لازم يترفض =====
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  begin
    perform public.receive_order(v_order->>'order_id');
    insert into test_log values ('6-العضو يحاول يستلم',
      'BUG: العضو استلم والمفروض يترفض!');
  exception when others then
    insert into test_log values ('6-العضو يحاول يستلم',
      'اترفض صح ✓ (الطلب أصلاً Received)');
  end;

  -- ===== الخطوة 7: كود طلب مش موجود =====
  begin
    perform public.receive_order('ORD-00000000-999999');
    insert into test_log values ('7-كود غير موجود', 'BUG: رجع نتيجة!');
  exception when others then
    insert into test_log values ('7-كود غير موجود', 'اترفض صح ✓ → ' || SQLERRM);
  end;

  -- رجّع الدور الأصلي قبل قراءة اللوج
  perform set_config('role', 'postgres', true);
end $test$;

select step, detail from test_log order by ctid;
rollback;
`;

const { status, body } = await run(sql);
console.log("HTTP:", status);
if (Array.isArray(body)) {
  for (const row of body) console.log(`\n[${row.step}]\n  ${row.detail}`);
} else {
  console.log(JSON.stringify(body, null, 2));
}
