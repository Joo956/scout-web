import { useEffect, useState } from "react";
import MemberLayout, { GuestNotice } from "./MemberLayout.jsx";
import { useStore } from "../store.jsx";
import ImageLightbox from "../components/ImageLightbox.jsx";
import { parseLinks, buildLinksValue, isImageUrl, getProductImages } from "../utils/imageLinks.js";
import { canSeeNews, stripAudience } from "../utils/newsAudience.js";

// ✅ عرض روابط الخبر كبطاقات قابلة للضغط
function NewsLinks({ imageUrl, className = "" }) {
  const links = parseLinks(imageUrl);
  if (!links || links.length === 0) return null;
  const isImage = isImageUrl;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((lnk, i) => (
        isImage(lnk.url) ? (
          <a
            key={i}
            href={lnk.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="block overflow-hidden rounded-xl border border-earth-200 shadow-sm transition hover:shadow-md hover:border-maroon-300"
          >
            <SafeImage
              src={lnk.url}
              alt={lnk.label || `صورة ${i + 1}`}
              className="news-thumb-img"
              fallbackClassName="news-thumb-img"
              note="الصورة مش هتظهر — الرابط بايظ"
            />
            {lnk.label && (
              <span className="block px-2 py-1 text-xs font-bold text-earth-700 truncate">{lnk.label}</span>
            )}
          </a>
        ) : (
          <a
            key={i}
            href={lnk.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-maroon-200 bg-white px-3 py-2 text-xs font-bold text-maroon-700 shadow-sm transition hover:border-maroon-400 hover:bg-maroon-50 hover:shadow-md"
          >
            🔗 {lnk.label || lnk.url}
          </a>
        )
      ))}
    </div>
  );
}

// ✅ صورة بتحذير واضح لو فشل تحميلها — بدل ما تختفي بصمت
function SafeImage({ src, alt, className, fallbackClassName, note, onClick }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (!src) return null;
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-amber-50 text-amber-700 ${fallbackClassName ?? className ?? ""}`}>
        <span className="px-2 text-center text-[11px] font-bold">
          ⚠️ {note || "الصورة مش هتظهر — فشل تحميلها من الرابط"}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}

const PROFILE_MAP = {
  "full name": "name",
  name: "name",
  email: "email",
  phone: "phone",
  "troop / unit": "troop",
  troop: "troop",
  rank: "rank",
};

const MAX_PER_USER = 2;

const inputCls =
  "w-full rounded-lg border border-earth-200 bg-white px-3.5 py-2.5 text-sm text-earth-900 shadow-xs placeholder:text-earth-400 transition hover:border-earth-300 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/25";

const readonlyCls =
  "w-full rounded-lg border border-earth-200 bg-earth-100 px-3.5 py-2.5 text-sm text-earth-600 shadow-xs cursor-not-allowed";

// ✅ ألوان وأشكال كل تصنيف
const CATEGORY_STYLES = {
  "مجتمع": { gradient: "from-forest-300 via-forest-400 to-forest-600", badge: "bg-forest-600", emoji: "🌳" },
  "برنامج": { gradient: "from-gold-200 via-gold-300 to-gold-500", badge: "bg-gold-500", emoji: "🏅" },
  "متجر": { gradient: "from-red-200 via-red-300 to-red-400", badge: "bg-red-500", emoji: "🎒" },
  "امتحانات": { gradient: "from-maroon-300 via-maroon-500 to-maroon-700", badge: "bg-maroon-700", emoji: "📝" },
};

const CATEGORY_LABELS = {
  "Community": "مجتمع",
  "Program": "برنامج",
  "Store": "متجر",
  "Exams": "امتحانات",
};

const normalizeCategory = (cat) => CATEGORY_LABELS[cat] ?? cat;
const getStyle = (item) => CATEGORY_STYLES[normalizeCategory(item.category ?? item.type)] ?? CATEGORY_STYLES["مجتمع"];
const getEmoji = (item) => item.emoji ?? getStyle(item).emoji;
const getLabel = (item) => normalizeCategory(item.category ?? item.type);
// الوصف المختصر على الكرت: description — ولو فاضي أول 140 حرف من النص الكامل (من غير علامة التوجيه) + "…"
const getExcerpt = (item) => {
  const desc = (item.description ?? "").trim();
  if (desc) return desc;
  const body = stripAudience(item.body ?? "").trim();
  if (!body) return "";
  return body.length > 140 ? `${body.slice(0, 140)}…` : body;
};
const isNew = (item) => (Date.now() - new Date(item.date).getTime()) / 86400000 <= 7;
const fmtDate = (d) => new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

// isImageUrl مستوردة من imageLinks.js — نفس القاعدة في كل مكان

// ✅ كل صور الخبر (من رابط مباشر أو من روابط links://) — نفس أسلوب المتجر
const getNewsImages = (imageUrl) =>
  getProductImages(imageUrl).filter(isImageUrl);

// ✅ غلاف الخبر: أول صورة
const getCoverImage = (imageUrl) => getNewsImages(imageUrl)[0] ?? "";

// ✅ الروابط اللي مش صور — بتظهر كأزرار (الصور كلها في معرض الغلاف)
const getNewsLinkButtons = (imageUrl) => {
  const parsed = parseLinks(imageUrl);
  if (!parsed) return "";
  const rest = parsed
    .map((x) => (typeof x === "string" ? { url: x } : x))
    .filter((x) => !isImageUrl(x.url || ""));
  return rest.length ? buildLinksValue(rest) : "";
};

function fieldType(label) {
  const l = label.toLowerCase();
  if (l.includes("email")) return "email";
  if (l.includes("note") || l.includes("message") || l.includes("ملاحظ")) return "textarea";
  return "text";
}

function isAutoField(label) {
  return Boolean(PROFILE_MAP[label.toLowerCase().trim()]);
}

function NewsForm({ item, profile, currentUser, onSubmit }) {
  const userEmail = (currentUser?.email || profile?.email || "").toLowerCase();
  const mySubmissions = (item.submissions ?? []).filter(
    (s) =>
      (s.email || "").toLowerCase() === userEmail ||
      (s.name || "").trim() === (profile?.name || "").trim()
  ).length;
  const reachedMax = mySubmissions >= MAX_PER_USER;

  const [values, setValues] = useState(() => {
    const init = {};
    item.form.fields.forEach((f) => {
      const key = PROFILE_MAP[f.label.toLowerCase().trim()];
      init[f.label] = key ? (profile[key] ?? "") : "";
    });
    return init;
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (reachedMax) {
    return (
      <div className="mt-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-5 text-center">
        <p className="text-sm font-extrabold text-gold-900">✅ تم استلام إرسالاتك ({mySubmissions}/{MAX_PER_USER})</p>
        <p className="mt-1.5 text-xs text-gold-800">وصلت للحد الأقصى المسموح به، شكرًا لمشاركتك!</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    item.form.fields.forEach((f) => {
      const key = PROFILE_MAP[f.label.toLowerCase().trim()];
      const val = key ? (profile[key] ?? "") : (values[f.label] ?? "");
      if (!val.trim()) next[f.label] = `${f.label} مطلوب`;
    });
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const finalValues = {};
    item.form.fields.forEach((f) => {
      const key = PROFILE_MAP[f.label.toLowerCase().trim()];
      finalValues[f.label] = key ? (profile[key] ?? "") : (values[f.label] ?? "");
    });
    finalValues.email = userEmail;
    finalValues.name = profile?.name || "";
    setBusy(true);
    setSubmitError("");
    try {
      await onSubmit(finalValues);
    } catch (err) {
      // فشل الإرسال — الفورم بيفضل مفتوح والبيانات لسه في الحقول
      setSubmitError("فشل إرسال النموذج: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="mt-4 space-y-3 rounded-2xl border border-forest-200 bg-forest-50/60 p-4 backdrop-blur" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider text-forest-800 uppercase">{item.form.title ?? "نموذج التسجيل"}</p>
          <span className="rounded-full border border-earth-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-earth-600">
            إرسال {mySubmissions + 1} من {MAX_PER_USER}
          </span>
        </div>

        {item.form.fields.map((f) => {
          const auto = isAutoField(f.label);
          const type = fieldType(f.label);
          const autoValue = auto ? (profile[PROFILE_MAP[f.label.toLowerCase().trim()]] ?? "") : null;
          return (
            <div key={f.label}>
              <label className="mb-1 block text-xs font-semibold text-earth-700">
                {f.label}
                {auto && <span className="ml-1.5 inline-block rounded bg-forest-100 px-1.5 py-0.5 text-[10px] font-bold text-forest-700">تلقائي</span>}
              </label>
              {auto ? (
                <input type="text" readOnly tabIndex={-1} className={readonlyCls} value={autoValue} />
              ) : type === "textarea" ? (
                <textarea rows={3} className={`${inputCls} resize-y ${errors[f.label] ? "border-red-400 ring-1 ring-red-300" : ""}`} value={values[f.label] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))} placeholder={`اكتب ${f.label} هنا...`} />
              ) : (
                <input type={type} className={`${inputCls} ${errors[f.label] ? "border-red-400 ring-1 ring-red-300" : ""}`} value={values[f.label] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))} placeholder={`اكتب ${f.label} هنا...`} />
              )}
              {errors[f.label] && <p className="mt-1 text-xs font-medium text-red-600">{errors[f.label]}</p>}
            </div>
          );
        })}

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            ⚠️ {submitError}
          </div>
        )}

        <button type="submit" disabled={busy} className="w-full cursor-pointer rounded-lg bg-forest-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-forest-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "جاري الإرسال..." : "إرسال الإجابة"}
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] font-semibold text-earth-500">
        متبقي لك <span className="font-extrabold text-maroon-700">{MAX_PER_USER - mySubmissions}</span> من {MAX_PER_USER} إرسال
      </p>
    </>
  );
}

// ✅ أيقونات SVG صغيرة
const CalendarIcon = (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>);
const PinIcon = (p) => (<svg {...p} fill="currentColor" viewBox="0 0 24 24"><path d="M16 3a1 1 0 0 1 .97 1.243l-1.2 4.8 4.53 4.53a1 1 0 0 1-.4 1.66l-4.9 1.4-1.4 4.9a1 1 0 0 1-1.66.4L7.4 17.4l-4.16 4.16a1 1 0 0 1-1.41-1.41L6 16l-4.53-4.53a1 1 0 0 1 .4-1.66l4.9-1.4 1.4-4.9a1 1 0 0 1 1.66-.4L14.4 7.6l1.36-4.36A1 1 0 0 1 16 3z"/></svg>);
const XIcon = (p) => (<svg {...p} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>);

/* ───── كرت الخبر — الغلاف بنفس أسلوب المتجر: أول صورة + نقاط لو فيه أكتر + عارض صور ───── */
function NewsCard({ item, onOpenDetails, formButton, onOpenLightbox }) {
  const style = getStyle(item);
  const images = getNewsImages(item.imageUrl);
  const cover = images[0] ?? "";
  const linkButtons = getNewsLinkButtons(item.imageUrl);

  return (
    <article
      onClick={() => onOpenDetails(item)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-earth-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-maroon-200 hover:shadow-xl hover:shadow-maroon-900/10"
    >
      {/* الغلاف: نفس أسلوب المتجر */}
      <div className={`relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br ${style.gradient}`}>
        {!cover && <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.5),transparent_55%)]" />}
        {cover && (
          <div className="relative h-full w-full">
            <SafeImage
              src={cover}
              alt={item.title}
              className="news-cover-img h-full w-full cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
              fallbackClassName="h-full w-full"
              note="صورة الخبر مش هتظهر — الرابط بايظ أو مؤقت"
              onClick={(e) => { e.stopPropagation(); onOpenLightbox(images, 0); }}
            />
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={`rounded-full transition-all ${
                      i === 0 ? "h-2 w-2 bg-maroon-600 shadow-sm" : "h-1.5 w-1.5 bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {!cover && item.imageUrl && (
          <span className="absolute bottom-2 right-2 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm">
            ⚠️ صورة الخبر مش هتظهر — الرابط مش صورة مباشرة
          </span>
        )}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <span className={`rounded-full ${style.badge} px-2.5 py-1 text-[10px] font-bold text-white shadow-md`}>
            {getLabel(item)}
          </span>
          {item.pinned && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-maroon-700 shadow-md">📌 مثبت</span>}
          {isNew(item) && <span className="animate-pulse rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md">حديث</span>}
        </div>
      </div>

      {/* الجسم */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-earth-500">
          <CalendarIcon className="h-3.5 w-3.5" /> {fmtDate(item.date)}
        </div>
        <h3 className="mt-2 text-base font-extrabold leading-snug text-earth-900 transition-colors group-hover:text-maroon-700">
          {item.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-earth-600">{getExcerpt(item)}</p>
        {/* الروابط اللي مش صور بس — الصور كلها في معرض الغلاف */}
        <NewsLinks imageUrl={linkButtons} className="mt-2" />
        <div className="mt-auto pt-2">
          {formButton(item)}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenDetails(item); }}
            className="mt-2 w-full cursor-pointer rounded-xl border-2 border-maroon-200 bg-white px-4 py-2.5 text-xs font-extrabold text-maroon-700 transition hover:border-maroon-400 hover:bg-maroon-50 active:scale-[0.99]"
          >
            التفاصيل
          </button>
        </div>
      </div>

    </article>
  );
}

export default function NewsPage() {
  const { news, submitNewsForm, profile, currentUser, members } = useStore();
  const [openForm, setOpenForm] = useState(null);
  // ✅ الخبر المختار — الضغط على الكرت يفتح عرض التفاصيل والإغلاق يرجّع للقايمة
  const [selectedNews, setSelectedNews] = useState(null);
  // ✅ عارض الصور على مستوى الصفحة (زي المتجر) — بره الكارت عشان الضغطات ما تتسربش له
  const [lightbox, setLightbox] = useState(null); // { images, index }

  // 🎯 فلترة الإعلانات بالمرحلة: حساب اشبال مش هيشوف إعلانات جوالة وهكذا
  // مرحلة العضو بتتقرا من سجله في members — بنفس طريقة الامتحانات
  // (بالمطابقة على userId الأول زي صفحة البروفايل، والإيميل احتياطي)
  const userEmail = (currentUser?.email || profile?.email || "").toLowerCase();
  const myMember =
    members?.find((m) => m.userId === currentUser?.id) ||
    members?.find((m) => (m.email || "").toLowerCase() === userEmail);
  const viewCtx = {
    isLoggedIn: Boolean(currentUser),
    memberStage: myMember?.scoutStage ?? "",
    role: currentUser?.role || profile?.role || "",
  };
  const visibleNews = news.filter((item) => canSeeNews(item, viewCtx));

  // زر Escape بيقفل عرض التفاصيل
  useEffect(() => {
    if (!selectedNews) return undefined;
    const onKey = (e) => e.key === "Escape" && setSelectedNews(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNews]);

  const toggleForm = (id) => {
    if (!currentUser) { window.location.hash = "#/login"; return; }
    setOpenForm((cur) => (cur === id ? null : id));
  };

  const sorted = [...visibleNews].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  const featured = sorted.find((n) => n.pinned);
  const rest = sorted.filter((n) => n.id !== featured?.id);

  const countFor = (item) =>
    (item.submissions ?? []).filter(
      (s) => (s.email || "").toLowerCase() === userEmail || (s.name || "").trim() === (profile?.name || "").trim()
    ).length;

  // ✅ زر الفورم المشترك — stopPropagation عشان الضغط عليه ما يفتحش عرض التفاصيل
  const formButton = (item, dark = false) =>
    item.form && (
      <div className="mt-4">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleForm(item.id); }}
          className={`w-full cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition active:scale-[0.99] shadow-md ${
            countFor(item) >= MAX_PER_USER
              ? "bg-gold-500 text-white hover:bg-gold-600"
              : dark
              ? "bg-white text-maroon-800 hover:bg-gold-100"
              : "bg-gradient-to-l from-forest-700 to-forest-800 text-white hover:from-forest-800 hover:to-forest-900"
          }`}
        >
          {countFor(item) >= MAX_PER_USER
            ? `✅ تم (${countFor(item)}/${MAX_PER_USER})`
            : openForm === item.id
            ? "إخفاء الفورم"
            : currentUser
            ? "سجّل الآن — املأ النموذج"
            : "سجّل الدخول لملء النموذج"}
        </button>
        {openForm === item.id && (
          <NewsForm item={item} profile={profile} currentUser={currentUser} onSubmit={(v) => submitNewsForm(item.id, v)} />
        )}
      </div>
    );

  return (
    <MemberLayout active="news">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {!currentUser && <GuestNotice />}

        {/* ✅ هيدر عصري */}
        <div className="relative">
          <div className="pointer-events-none absolute -top-6 -left-10 h-40 w-40 rounded-full bg-maroon-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -top-2 right-1/3 h-24 w-24 rounded-full bg-gold-200/50 blur-2xl" />
          <h1 className="relative text-3xl font-extrabold text-earth-900 sm:text-4xl">
            الأخبار <span className="bg-gradient-to-l from-maroon-700 to-gold-600 bg-clip-text text-transparent">/ News</span>
          </h1>
          <p className="relative mt-2 text-sm text-earth-600">كل إعلانات الوحدة — وبعض الأخبار فيها فورمات تسجيل تُعبّى من بياناتك.</p>
        </div>

        {/* ✅ بطاقة Hero للخبر المثبت — الضغط عليها بتفتح عرض التفاصيل */}
        {featured && (
          <article
            onClick={() => setSelectedNews(featured)}
            className="group relative mt-8 cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-l from-maroon-900 via-maroon-800 to-maroon-700 text-white shadow-2xl shadow-maroon-900/30"
          >
            <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-gold-400/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
            <div className="pointer-events-none absolute -bottom-24 right-1/4 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative grid gap-6 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-extrabold text-maroon-900 shadow-md">
                    <PinIcon className="h-3 w-3" /> مثبت
                  </span>
                  <span className={`rounded-full ${getStyle(featured).badge} px-3 py-1 text-[11px] font-bold text-white shadow-md`}>
                    {getLabel(featured)}
                  </span>
                  {isNew(featured) && <span className="animate-pulse rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white shadow-md">حديث</span>}
                </div>
                <h2 className="mt-4 text-2xl font-extrabold leading-snug sm:text-3xl">{featured.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-maroon-100/90">{getExcerpt(featured)}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-maroon-200">
                  <CalendarIcon className="h-3.5 w-3.5" /> {fmtDate(featured.date)}
                </div>
                <div className="max-w-md">{formButton(featured, true)}</div>
              </div>
              {/* صورة الخبر المثبت — أول صورة من الرابط المباشر أو links:// */}
              <div className="hidden lg:block">
                {getCoverImage(featured.imageUrl) && (
                  <SafeImage
                    src={getCoverImage(featured.imageUrl)}
                    alt={featured.title}
                    className="news-hero-img rounded-2xl shadow-2xl ring-1 ring-white/25"
                    fallbackClassName="news-hero-img rounded-2xl"
                    note="الصورة مش هتظهر — الرابط بايظ"
                  />
                )}
              </div>
            </div>
          </article>
        )}

        {/* ✅ شبكة الأخبار الحديثة — كروت عريضة (عمودين) والضغط بيفتح التفاصيل */}
        <div className="mt-8 grid items-start gap-6 sm:grid-cols-2">
          {rest.map((item) => (
            <NewsCard key={item.id} item={item} onOpenDetails={setSelectedNews} formButton={formButton} onOpenLightbox={(imgs, idx) => setLightbox({ images: imgs, index: idx })} />
          ))}
        </div>

        {/* ✅ عرض التفاصيل — الصورة كاملة + التصنيف + التاريخ + النص الكامل */}
        {selectedNews && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-maroon-950/60 backdrop-blur-sm"
              onClick={() => setSelectedNews(null)}
            />
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                aria-label="إغلاق"
                className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-maroon-800 shadow-lg backdrop-blur transition hover:bg-white"
              >
                <XIcon className="h-5 w-5" />
              </button>
              {getCoverImage(selectedNews.imageUrl) && (
                <SafeImage
                  src={getCoverImage(selectedNews.imageUrl)}
                  alt={selectedNews.title}
                  className="news-modal-img"
                  note="الصورة مش هتظهر — الرابط بايظ أو مؤقت"
                />
              )}
              <NewsLinks
                imageUrl={getNewsLinkButtons(selectedNews.imageUrl)}
                className="p-6 sm:p-8 pt-0"
              />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full ${getStyle(selectedNews).badge} px-3 py-1 text-[11px] font-bold text-white shadow-md`}>
                    {getLabel(selectedNews)}
                  </span>
                  {selectedNews.pinned && (
                    <span className="rounded-full bg-gold-100 px-3 py-1 text-[11px] font-bold text-gold-800">
                      📌 مثبت
                    </span>
                  )}
                  {isNew(selectedNews) && (
                    <span className="animate-pulse rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white shadow-md">
                      حديث
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-earth-500">
                    <CalendarIcon className="h-3.5 w-3.5" /> {fmtDate(selectedNews.date)}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-extrabold leading-snug text-earth-900">
                  {selectedNews.title}
                </h2>
                {/* النص الكامل بفواصل الأسطر زي ما اتكتب — من غير علامة التوجيه */}
                <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-earth-700">
                  {stripAudience(selectedNews.body)}
                </div>
                {/* الفورم المرفق (form jsonb) بيظهر في التفاصيل زي المنطق الحالي */}
                {formButton(selectedNews)}
                <button
                  type="button"
                  onClick={() => setSelectedNews(null)}
                  className="mt-6 w-full cursor-pointer rounded-xl border-2 border-earth-200 bg-white px-4 py-2.5 text-sm font-extrabold text-earth-700 transition hover:bg-earth-100 active:scale-[0.99]"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {sorted.length === 0 && (
          <p className="mt-10 rounded-2xl border border-earth-200 bg-white p-8 text-center text-sm text-earth-500">لا توجد أخبار بعد.</p>
        )}

        {/* ✅ عارض الصور الواحد لكل الكروت — بره أي عنصر قابل للضغط */}
        <ImageLightbox
          images={lightbox?.images ?? []}
          initial={lightbox?.index ?? 0}
          open={lightbox !== null}
          onClose={() => setLightbox(null)}
        />
      </div>
    </MemberLayout>
  );
}