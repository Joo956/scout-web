// نشر Edge Function — بيجرب صيغ multipart مختلفة بالترتيب
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const token = env.match(/SUPABASE_ACCESS_TOKEN=(\S+)/)?.[1];
const ref = env.match(/VITE_SUPABASE_URL=https:\/\/(\w+)\.supabase\.co/)?.[1];
const name = process.argv[2] ?? "send-credentials";
const code = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
const base = `https://api.supabase.com/v1/projects/${ref}`;
const auth = { Authorization: `Bearer ${token}` };
const metadata = JSON.stringify({
  entrypoint_path: "index.ts",
  name,
  verify_jwt: true,
  import_map: false,
});

const attempt = async (label, fn) => {
  try {
    const r = await fn();
    const body = await r.json().catch(() => ({}));
    console.log(`[${label}] HTTP ${r.status}`, JSON.stringify(body).slice(0, 300));
    if (r.ok) return true;
  } catch (e) {
    console.log(`[${label}] EXCEPTION`, String(e).slice(0, 200));
  }
  return false;
};

const mkFd = (fileFields) => {
  const fd = new FormData();
  fd.append("metadata", new Blob([metadata], { type: "application/json" }), "metadata");
  for (const [fieldName, fileName] of fileFields) {
    fd.append(fieldName, new Blob([code], { type: "application/typescript" }), fileName);
  }
  return fd;
};

// 1) metadata كملف + ملف باسم الحقل "file" والاسم index.ts
const ok1 = await attempt("metadata-file + file:index.ts", () =>
  fetch(`${base}/functions/deploy?slug=${name}`, {
    method: "POST",
    headers: { ...auth },
    body: mkFd([["file", "index.ts"]]),
  })
);
if (ok1) process.exit(0);

// 2) metadata كنص عادي + ملف "file"
const ok2 = await attempt("metadata-text + file:index.ts", () => {
  const fd = new FormData();
  fd.append("metadata", metadata);
  fd.append("file", new Blob([code], { type: "application/typescript" }), "index.ts");
  return fetch(`${base}/functions/deploy?slug=${name}`, {
    method: "POST",
    headers: { ...auth },
    body: fd,
  });
});
if (ok2) process.exit(0);

// 3) المسار الكامل كاسم ملف
const ok3 = await attempt("file:functions/.../index.ts", () =>
  fetch(`${base}/functions/deploy?slug=${name}`, {
    method: "POST",
    headers: { ...auth },
    body: mkFd([["file", `functions/${name}/index.ts`]]),
  })
);
if (ok3) process.exit(0);

console.log("\n❌ كل المحاولات فشلت");
