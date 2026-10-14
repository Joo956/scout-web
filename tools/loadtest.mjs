// ============================================================
// 🧪 اختبار ضغط فعلي — get_app_bundle (الإندبوينت اللي كل زائر بيضربه)
// قراءة فقط — مفيش أي كتابة أو حذف. بنفس مراحل testK6.js بتاع العميل
// التشغيل: node tools/loadtest.mjs
// ============================================================
import https from "node:https";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = readFileSync(path.join(here, "..", ".env.local"), "utf8");
const URL_BASE = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const ENDPOINT = `${URL_BASE}/rest/v1/rpc/get_app_bundle`;

const agent = new https.Agent({ keepAlive: true, maxSockets: 12000 });

// طلب واحد — بيرجع الحالة والزمن بالمللي (تايم أوت 60 ثانية للمستويات العالية)
function one() {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const payload = JSON.stringify({ p_private: false }); // محاكاة زائر
    const req = https.request(
      ENDPOINT,
      {
        method: "POST",
        agent,
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 60000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          resolve({ status: res.statusCode, ms });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      resolve({ status: 0, ms });
    });
    req.write(payload);
    req.end();
  });
}

// إحصائيات
const stats = { total: 0, ok: 0, err: 0, lats: [] };
const record = (r) => {
  stats.total++;
  if (r.status === 200) {
    stats.ok++;
    stats.lats.push(r.ms);
  } else {
    stats.err++;
  }
};
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

// مرحلة: عدد متزامن لمدة ثواني — مع إيقاف مبكر لو السيرفر وقع
async function phase(name, concurrency, seconds) {
  stats.total = 0; stats.ok = 0; stats.err = 0; stats.lats = [];
  const deadline = Date.now() + seconds * 1000;
  let aborted = false;
  console.log(`\n▶️  ${name} — ${concurrency} متزامن لمدة ${seconds}s ...`);
  await new Promise((resolve) => {
    const workers = Array.from({ length: concurrency }, async () => {
      while (Date.now() < deadline && !aborted) {
        record(await one());
        // إيقاف مبكر: لو الفشل عدى 60% بعد 50 طلب — السيرفر وقع فعلاً
        if (stats.total >= 50 && stats.err / stats.total > 0.6) aborted = true;
      }
    });
    Promise.all(workers).then(resolve);
  });
  const rps = (stats.total / seconds).toFixed(0);
  console.log(
    `   طلبات: ${stats.total} · ناجحة: ${stats.ok} · فاشلة: ${stats.err} · سرعة: ${rps} طلب/ث\n` +
    `   الزمن: متوسط ${stats.lats.length ? (stats.lats.reduce((a, b) => a + b, 0) / stats.lats.length).toFixed(0) : "—"}ms · ` +
    `p50 ${pct(stats.lats, 50).toFixed(0)}ms · p95 ${pct(stats.lats, 95).toFixed(0)}ms · ` +
    `p99 ${pct(stats.lats, 99).toFixed(0)}ms · أقصى ${pct(stats.lats, 100).toFixed(0)}ms` +
    (aborted ? "\n   ⛔ اتوقفنا بدري — نسبة الفشل انفجرت (السيرفر مش قادر)"
            : stats.err === 0 ? "\n   ✅ صفر أخطاء"
            : stats.err / stats.total < 0.01 ? "\n   ✅ فشل أقل من 1% (ضمن المعيار)"
            : "\n   ⚠️ نسبة فشل فوق 1%")
  );
  return { total: stats.total, err: stats.err, aborted };
}

console.log("🧪 اختبار الضغط الفعلي — get_app_bundle (قراءة فقط)");
console.log("=".repeat(58));

const t0 = Date.now();
// تحمية — عشان السيرفر الصغير بيصحى (كنا شايفين 1.2s في أول طلب)
console.log("\n🔥 تحمية (5 طلبات متتالية)...");
for (let i = 0; i < 5; i++) await one();

// وضع مخصص: node tools/loadtest.mjs <عدد متزامن> <ثواني>
// مثال: node tools/loadtest.mjs 10000 60
const [, , customN, customSecs] = process.argv;
if (customN) {
  const n = Math.max(1, parseInt(customN, 10));
  const secs = Math.max(10, parseInt(customSecs || "60", 10));
  console.log(`\n🚀 وضع الضغط الأقصى — ${n} متزامن لمدة ${secs}s`);
  const r = await phase(`${n} متزامن`, n, secs);
  console.log("\n" + "=".repeat(58));
  console.log(
    r.aborted
      ? "🚨 النتيجة: السيرفر ما قدرش يتعامل — الطلبات بتفشل بالجملة (السقف اتعدى بمراحل)"
      : `🎯 النتيجة: السيرفر استحمل ${n} متزامن — صمد بدون انهيار (شوف الأزمنة فوق: الزمن بيزيد بس مفيش رفض)`
  );
} else {
  const results = [];
  results.push(["استخدام عادي", await phase("استخدام عادي", 50, 30)]);
  results.push(["ذروة (امتحان/إعلان)", await phase("ذروة — 150 متزامن", 150, 30)]);
  results.push(["أسوأ سيناريو", await phase("أسوأ سيناريو — 300 متزامن", 300, 30)]);

  console.log("\n" + "=".repeat(58));
  const totalReqs = results.reduce((s, [, r]) => s + r.total, 0);
  const totalErr = results.reduce((s, [, r]) => s + r.err, 0);
  console.log(`📊 الإجمالي: ${totalReqs} طلب في ${((Date.now() - t0) / 1000).toFixed(0)}s · فشل ${totalErr} (${((totalErr / totalReqs) * 100).toFixed(1)}%)`);
  const fellOver = results.some(([, r]) => r.aborted);
  console.log(fellOver
    ? "🚨 النتيجة: السيرفر وقع تحت الضغط العالي — محتاج خطوات من التقرير"
    : "🎯 النتيجة: السيرفر صمد على كل المراحل — شوف تفاصيل الأزمنة فوق");
}
