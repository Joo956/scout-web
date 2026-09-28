// أداة تشغيل SQL على مشروع Supabase عبر Management API
// الاستخدام: node scripts/db-query.mjs "SELECT ..."
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)?.[1];

if (!token || !ref) {
  console.error("missing token or project ref");
  process.exit(1);
}

const sql = process.argv[2];
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

const data = await res.json();
console.log(JSON.stringify(data, null, 1));
