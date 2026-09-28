// أداة مؤقتة لتشغيل ملف SQL على مشروع Supabase عبر Management API
// الاستخدام: node scripts/tmp-sql.mjs path/to/file.sql
// الاستعلامات المتعددة بتتفصل بـ سطر فيه -- @RUN وكل واحد بيرجع نتيجته
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)?.[1];

if (!token || !ref) {
  console.error("missing token or project ref");
  process.exit(1);
}

const sqlFile = process.argv[2];
const raw = readFileSync(sqlFile, "utf8");
const batches = raw
  .split(/^-- @RUN.*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

for (let i = 0; i < batches.length; i++) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: batches[i] }),
    }
  );
  const data = await res.json();
  console.log(`--- [${i + 1}/${batches.length}] ---`);
  console.log(JSON.stringify(data, null, 1));
}
