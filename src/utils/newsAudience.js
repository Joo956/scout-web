// ============================================================
// 🎯 توجيه الإعلانات حسب المرحلة — من غير أي تعديل في قاعدة البيانات
// ============================================================
// بما إن جدول news مالوش عمود للمرحلة المستهدفة، العلامة بتتخزن
// أول سطر في نص الخبر نفسه (body) بالشكل ده:
//   @@stages:جوالة@@
//   @@stages:أشبال,كشاف,متقدم@@
// الكود بيقراها وبيشيلها من العرض في كل الأماكن، والخبر اللي من
// غير علامة بيفضل عام للكل زي ما كان.

import { stageMatches } from "./stages.js";

// القيمة اللي معناها الخبر عام للكل
export const NEWS_AUDIENCE_ALL = "الكل";

// ✅ خيارات المراحل — نفس القيم المستخدمة في فورم الأدمن
export const NEWS_STAGE_OPTIONS = [
  { value: "أشبال", label: "🐺 أشبال" },
  { value: "زهرات", label: "🌸 زهرات" },
  { value: "كشاف", label: "⚜️ كشاف" },
  { value: "مرشدات", label: "🌼 مرشدات" },
  { value: "متقدم", label: "🎒 متقدم" },
  { value: "رائدات", label: "🎒 رائدات" },
  { value: "جوالة", label: "🧭 جوالة" },
  { value: "قادة", label: "🎖️ قادة" },
];

// الأدوار اللي بتشوف كل الإعلانات في الموقع — الأدمن بس.
// باقي حسابات الشغل (قائد فصل/مسئول مرحلة...) بتتشاف زي أي عضو حسب مرحلته،
// عشان الفلتر يفضل صارم: اشبال مش يشوف إعلان جوالة مهما كان نوع الحساب.
const SEE_ALL_ROLES = ["admin", "subadmin"];

// العلامة لازم تكون أول حاجة في النص: @@stages:أ,ب,ج@@
const MARKER_RE = /^@@stages:([^@]*)@@\s*\n?/;

// قراءة العلامة: بترجّع المراحل المستهدفة + النص النضيف من غيرها
export function splitAudience(body) {
  const raw = String(body ?? "");
  const m = raw.match(MARKER_RE);
  if (!m) return { stages: [], cleanBody: raw };
  const stages = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { stages, cleanBody: raw.slice(m[0].length) };
}

// إضافة/تحديث العلامة قبل النص — قائمة فاضية يعني عام للكل
export function withAudience(body, stages) {
  const list = (stages ?? []).filter((s) => s && s !== NEWS_AUDIENCE_ALL);
  const clean = splitAudience(body).cleanBody;
  if (list.length === 0) return clean;
  return `@@stages:${list.join(",")}@@\n${clean}`;
}

// النص من غير العلامة — للعرض في الكروت والتفاصيل
export const stripAudience = (body) => splitAudience(body).cleanBody;

// مراحل الخبر — فاضية يعني عام
export const newsAudience = (item) => splitAudience(item?.body).stages;

// هل الخبر موجّه لمراحل معينة ولا عام؟
export const isTargeted = (item) => newsAudience(item).length > 0;

// تسمية للعرض في قايمة الأدمن: «الكل» أو أسماء المراحل
export function audienceLabel(item) {
  const stages = newsAudience(item);
  if (stages.length === 0) return NEWS_AUDIENCE_ALL;
  return stages.join("، ");
}

// ✅ هل المستخدم الحالي يشوف الخبر ده؟
// ctx = { isLoggedIn, memberStage, role }
// - خبر عام (من غير علامة) → الكل يشوفه زي الأول
// - خبر موجّه → بس اللي مرحلتهم من المراحل المحددة
//   (نفس مطابقة الامتحانات: أشبال/زهرات = نفس الشارة، قادة = حسابات القيادة)
// - الأدمن بس بيشوف كل الإعلانات عشان يتابع شغله
export function canSeeNews(item, ctx = {}) {
  const stages = newsAudience(item);
  if (stages.length === 0) return true;
  const { isLoggedIn = false, memberStage = "", role = "" } = ctx;
  if (!isLoggedIn) return false;
  const userRole = String(role ?? "").toLowerCase();
  if (SEE_ALL_ROLES.includes(userRole)) return true;
  return stages.some((s) => stageMatches(s, memberStage));
}
