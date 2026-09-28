// ضبط سيرتس Gmail SMTP لمشروع Supabase
// الاستخدام: node scripts/set-smtp-secrets.mjs <gmail-address> <app-password>
// مثال:     node scripts/set-smtp-secrets.mjs troop@gmail.com "abcd efgh ijkl mnop"
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)?.[1];

const [user, pass, fromName] = process.argv.slice(2);
if (!user || !pass) {
  console.error("الاستخدام: node scripts/set-smtp-secrets.mjs <gmail> <app-password> [اسم-المجموعة]");
  process.exit(1);
}

// app password بيتكتب بمسافات أحياناً — نشيل المسافات
const cleanPass = pass.replace(/\s+/g, "");

const secrets = [
  { name: "SMTP_USER", value: user.trim() },
  { name: "SMTP_PASS", value: cleanPass },
  { name: "FROM_NAME", value: fromName ?? "مجموعة الأنبا إبرام الكشفية" },
];

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(secrets),
});

console.log("HTTP", res.status);
if (res.ok) {
  console.log("✅ السيرتس اتظبطت — SMTP_USER + SMTP_PASS + FROM_NAME");
} else {
  console.log(JSON.stringify(await res.json().catch(() => ({}))));
}
