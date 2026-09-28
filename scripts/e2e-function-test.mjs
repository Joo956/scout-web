// اختبار E2E حقيقي لـ Edge Function: حساب أدمن مؤقت → استدعاء الدالة → إرسال فعلي → تنظيف
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)?.[1];
const url = env.match(/VITE_SUPABASE_URL=(\S+)/)?.[1];
const anon = env.match(/VITE_SUPABASE_ANON_KEY=(\S+)/)?.[1];

const runSql = async (sql) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.json() };
};

const testEmail = `e2e.func.${Date.now()}@example.com`;
const testPass = "TestFunc123!";

// 1) إنشاء مستخدم مؤقت عبر auth signup
const signupRes = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: testEmail, password: testPass }),
});
const signup = await signupRes.json();
console.log("1) signup:", signupRes.status, signup.user?.id ?? signup.msg ?? "");

const uid = signup.user?.id;
if (!uid) {
  console.log("مفيش user id — بنوقف. التفاصيل:", JSON.stringify(signup).slice(0, 300));
  process.exit(1);
}

// 2) تأكيد الإيميل + رفع الدور لأدمن مؤقتاً
let r = await runSql(`
  update auth.users set email_confirmed_at = now(), updated_at = now() where id = '${uid}';
  update public.profiles set role = 'admin' where id = '${uid}';
  select role from public.profiles where id = '${uid}';
`);
console.log("2) تأكيد + أدمن:", r.status, JSON.stringify(r.body).slice(0, 120));

// 3) تسجيل دخول وجلب JWT
const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: testEmail, password: testPass }),
});
const login = await loginRes.json();
console.log("3) login:", loginRes.status, login.access_token ? "JWT OK" : JSON.stringify(login).slice(0, 200));

if (!login.access_token) process.exit(1);

// 4) استدعاء الدالة — إرسال بيانات تجربة على إيميل الأدمن الحقيقي
const fnRes = await fetch(`${url}/functions/v1/send-credentials`, {
  method: "POST",
  headers: {
    apikey: anon,
    "Content-Type": "application/json",
    Authorization: `Bearer ${login.access_token}`,
  },
  body: JSON.stringify({
    accounts: [
      { email: "cartoonmax324@gmail.com", password: "E2E-FUNC-TEST-99", name: "اختبار الدالة" },
    ],
  }),
});
const fnBody = await fnRes.json();
console.log("4) الدالة:", fnRes.status, JSON.stringify(fnBody).slice(0, 400));

// 5) تنظيف كامل — مسح المستخدم المؤقت والبروفايل
r = await runSql(`
  delete from public.profiles where id = '${uid}';
  delete from auth.users where id = '${uid}';
  select count(*) as remaining from public.profiles where id = '${uid}';
`);
console.log("5) تنظيف:", r.status, JSON.stringify(r.body).slice(0, 120));
