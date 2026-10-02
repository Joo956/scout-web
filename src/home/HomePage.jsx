import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store.jsx";
import { ArrowRightIcon } from "../admin/icons.jsx";
import { parseLinks } from "../utils/imageLinks.js";
import { canSeeNews, stripAudience } from "../utils/newsAudience.js";

// ✅ Animation Variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

// ✅ كشف الموبايل مرة واحدة (للـ performance)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

// ✅ كلمات متقلبة (Aceternity / Animata - FlipWords)
const FLIP_WORDS = ["الكشافين", "القادة", "الرواد", "الأبطال"];

function FlipWords({ words, duration = 2200 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % words.length), duration);
    return () => clearInterval(t);
  }, [words.length, duration]);

  return (
    <span className="relative inline-block">
      <AnimatePresence mode="wait">
        <motion.span
          key={words[i]}
          className="inline-block bg-gradient-to-l from-gold-300 via-gold-400 to-amber-500 bg-clip-text text-transparent"
          initial={{ y: 28, opacity: 0, rotateX: -70 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: -28, opacity: 0, rotateX: 70 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ✅ توهج يتبع الماوس (Aceternity - Spotlight)
function useSpotlight(disabled = false) {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, o: 0 });
  const onMove = (e) => {
    if (disabled) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, o: 1 });
  };
  return { ref, spot, onMove, onLeave: () => setSpot((s) => ({ ...s, o: 0 })) };
}

// ✅ كارت مائل مع لمعان (Hover.dev - Tilt + Glare)
function TiltCard({ href, children, className = "", variants, isMobile = false }) {
  const ref = useRef(null);
  const [t, setT] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, go: 0 });
  const onMove = (e) => {
    if (isMobile) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setT({ rx: -(py - 0.5) * 8, ry: (px - 0.5) * 8, gx: px * 100, gy: py * 100, go: 1 });
  };
  return (
    <motion.a
      ref={ref}
      href={href}
      variants={variants}
      onMouseMove={onMove}
      onMouseLeave={() => setT({ rx: 0, ry: 0, gx: 50, gy: 50, go: 0 })}
      className={className}
      style={isMobile ? {} : { rotateX: t.rx, rotateY: t.ry, transformPerspective: 900 }}
      whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)" }}
      whileTap={{ scale: 0.98 }}
    >
      {!isMobile && (
        <span
          className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-300"
          style={{
            opacity: t.go,
            background: `radial-gradient(400px circle at ${t.gx}% ${t.gy}%, rgba(251,191,36,0.14), transparent 45%)`,
          }}
        />
      )}
      {children}
    </motion.a>
  );
}

// ✅ زرار بلمعان (MagicUI - ShimmerButton)
function ShimmerButton({ href, children, className = "" }) {
  return (
    <motion.a
      href={href}
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-l from-gold-400 to-gold-500 px-7 py-3.5 text-sm font-extrabold text-maroon-950 shadow-xl shadow-gold-500/30 ${className}`}
      whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(251,191,36,0.5)" }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.65)_50%,transparent_70%)] transition-transform duration-700 group-hover:translate-x-full" />
    </motion.a>
  );
}

const HERO_CHIPS = [
  { emoji: "🏕️", label: "معسكرات", top: "2%", right: "16%" },
  { emoji: "🎖️", label: "شارات هوايات", top: "28%", right: "-8%" },
  { emoji: "🧭", label: "ملاحة", top: "60%", right: "-4%" },
  { emoji: "🤝", label: "أخوة كشفية", top: "82%", right: "26%" },
];

const SCOUT_STAGES = [
  { emoji: "🐺", name: "أشبال" },
  { emoji: "🌸", name: "زهرات" },
  { emoji: "⚜️", name: "كشاف" },
  { emoji: "🌼", name: "مرشدات" },
  { emoji: "🎒", name: "متقدم" },
  { emoji: "🎒", name: "رائدات" },
  { emoji: "🧭", name: "جوالة" },
  { emoji: "🎖️", name: "قادة" },
];

const TICKER = [
  "⚜️ مجموعة الأنبا إبرام الكشفية",
  "🏕️ معسكرات وأنشطة على مدار السنة",
  "🎖️ برنامج شارات معتمد",
  "🧭 مغامرات كشفية حقيقية",
  "🤝 أخوة كشفية تدوم مدى الحياة",
  "🔥 انضم لأكثر من 500 كشاف وقائد",
];

const GALLERY = [
  { src: "/images/4.jpg", title: "معسكرات صيفية" },
  { src: "/images/560353233_1249026010599540_7229267757849523442_n.jpg", title: "أنشطة ومهارات" },
  { src: "/images/8.jpg", title: "حفلات ومسيرات" },
  { src: "/images/7.jpg", title: "أخوة كشفية" },
];

// ✅ عرض روابط الخبر
function NewsLinks({ imageUrl, className = "" }) {
  const links = parseLinks(imageUrl);
  if (!links || links.length === 0) return null;
  const isImage = (url) => /\.(jpe?g|png|gif|webp|avif|bmp|svg)(?:\?.*)?$/i.test(url);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {links.map((lnk, i) => (
        isImage(lnk.url) ? (
          <motion.a
            key={i}
            href={lnk.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group block overflow-hidden rounded-lg border border-white/40 shadow-sm"
            whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}
            whileTap={{ scale: 0.95 }}
          >
            <img src={lnk.url} alt={lnk.label || `صورة ${i + 1}`} className="h-16 w-auto object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
          </motion.a>
        ) : (
          <motion.a
            key={i}
            href={lnk.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/80 px-2.5 py-1 text-[10px] font-bold text-maroon-800 backdrop-blur"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔗 {lnk.label || lnk.url}
          </motion.a>
        )
      ))}
    </div>
  );
}

// ✅ الأيقونات المحلية
const UsersIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const BookOpenIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
);
const ShoppingCartIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
);
const SparklesIcon = (props) => (
  <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);
const ExamIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

const FEATURES = [
  {
    icon: UsersIcon,
    title: " الشارات والإنجازات",
    desc: "متابعة كاملة للإنجازات والمهارات المكتسبة لكل كشاف وقائد.",
    tone: "from-emerald-500/10 to-emerald-600/20 text-emerald-600 border-emerald-200",
    accent: "bg-emerald-500",
    href: "#/badges",
  },
  {
    icon: ShoppingCartIcon,
    title: "متجر الكشافة",
    desc: "توفير الزي الرسمي والمعدات والشارات اللازمة لكل مرحلة كشفية.",
    tone: "from-maroon-500/10 to-maroon-600/20 text-maroon-700 border-maroon-200",
    accent: "bg-maroon-700",
    href: "#/store",
  },
  {
    icon: BookOpenIcon,
    title: "الامتحانات والاختبارات",
    desc: "اختبارات لقياس مدى تقدم الكشافين في مراحلهم المختلفة.",
    tone: "from-amber-500/10 to-amber-600/20 text-amber-600 border-amber-200",
    accent: "bg-amber-500",
    href: "#/exams",
  },
  {
    icon: ExamIcon,
    title: "الأخبار والبرامج",
    desc: "أخبار وبرامج متنوعة تهم الكشافين وقادة الوحدة.",
    tone: "from-amber-500/10 to-amber-600/20 text-amber-600 border-amber-200",
    accent: "bg-amber-500",
    href: "#/news",
  },
];

const STATS = [
  { label: "كشاف وقائد", value: "+500", icon: "⚜️" },
  { label: "نشاط سنوي", value: "+50", icon: "🎯" },
  { label: "سنوات خبرة", value: "+25", icon: "🏆" },
  { label: "شارة معتمدة", value: "+120", icon: "🏅" },
];

const CATEGORY_STYLES = {
  "مجتمع": { gradient: "from-emerald-400 via-emerald-500 to-teal-600", chip: "bg-emerald-500/90 text-white" },
  "برنامج": { gradient: "from-amber-300 via-amber-400 to-yellow-500", chip: "bg-amber-500/90 text-white" },
  "متجر": { gradient: "from-rose-400 via-rose-500 to-red-600", chip: "bg-rose-500/90 text-white" },
  "امتحانات": { gradient: "from-stone-400 via-stone-500 to-stone-700", chip: "bg-stone-600/90 text-white" },
  default: { gradient: "from-maroon-500 via-maroon-600 to-maroon-800", chip: "bg-maroon-700/90 text-white" },
};

const CATEGORY_LABELS = {
  Community: "مجتمع",
  Program: "برنامج",
  Store: "متجر",
  Exams: "امتحانات",
  General: "عام",
};
const normalizeCategory = (cat) => CATEGORY_LABELS[cat] ?? cat;

const EMOJI_MAP = {
  "مجتمع": "🌳",
  "برنامج": "🏅",
  "متجر": "🎒",
  "امتحانات": "📝",
  default: "📰",
};

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
};

const getExcerpt = (item) => {
  const desc = (item.description ?? "").trim();
  if (desc) return desc;
  const body = stripAudience(item.body ?? item.content ?? "").trim();
  if (!body) return "لا يوجد وصف متاح";
  return body.length > 140 ? `${body.slice(0, 140)}…` : body;
};

// ✅ مكون كارت الأخبار المثبتة
function PinnedNewsCard({ item, index, featured = false }) {
  const cat = normalizeCategory(item.category ?? "");
  const style = CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.default;
  const emoji = EMOJI_MAP[cat] ?? EMOJI_MAP.default;

  const goToNews = () => {
    window.location.hash = "#/news";
  };

  const size = featured ? "md:col-span-2 md:row-span-2 min-h-[380px]" : "min-h-[280px]";

  return (
    <motion.div
      onClick={goToNews}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && goToNews()}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} p-[3px] shadow-xl ${size}`}
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ y: -8, boxShadow: "0 30px 60px -15px rgba(0,0,0,0.3)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative flex h-full flex-1 flex-col overflow-hidden rounded-[22px] bg-white/95 backdrop-blur-sm">
        <div className={`relative shrink-0 overflow-hidden bg-gradient-to-br ${style.gradient} ${featured ? "h-48 md:h-64" : "h-40"}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.5),transparent_55%)]" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "18px 18px" }} />
          <motion.span
            className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg"
            animate={{ y: [0, -8, 0], rotate: [0, 4, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            📰
          </motion.span>
          {item.imageUrl && !parseLinks(item.imageUrl) && (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
          <NewsLinks imageUrl={item.imageUrl} className="absolute bottom-2 right-2 z-10" />
          <div className="absolute top-3 right-3 flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold backdrop-blur shadow-lg ${style.chip}`}>📌 مثبت</span>
            {item.category && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/90 px-3 py-1 text-[11px] font-extrabold text-earth-700 shadow-sm">
                {emoji} {normalizeCategory(item.category)}
              </span>
            )}
          </div>
        </div>

        <div className={`pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-br ${style.gradient} opacity-15 blur-2xl transition-opacity duration-500 group-hover:opacity-30`} />

        <div className="relative mt-auto p-6 md:p-8">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-8 rounded-full bg-gradient-to-l ${style.gradient}`} />
            <p className="text-xs font-bold text-earth-500">{fmtDate(item.date)}</p>
          </div>
          <h3 className={`mt-2 font-extrabold leading-tight text-earth-900 transition-colors group-hover:text-maroon-700 ${featured ? "text-2xl md:text-4xl" : "text-lg md:text-xl"}`}>
            {item.title}
          </h3>
          <p className={`mt-3 text-sm leading-relaxed text-earth-600 ${featured ? "line-clamp-4" : "line-clamp-2"}`}>
            {getExcerpt(item)}
          </p>
          <div className="mt-5 flex items-center justify-between border-t border-earth-100 pt-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-maroon-700 transition-all group-hover:gap-3">
              اقرأ المزيد
              <ArrowRightIcon className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            </span>
            <span className="text-lg opacity-0 transition-all duration-300 group-hover:opacity-100">{emoji}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const { news = [], products = [], currentUser, profile, members = [] } = useStore();
  const isMobile = useIsMobile();
  const spotlight = useSpotlight(isMobile);

  // 🎯 فلترة الإعلانات بالمرحلة: كل حساب يشوف إعلانات مرحلته والإعلانات العامة بس
  // بنفس طريقة الامتحانات: مطابقة userId الأول والإيميل احتياطي
  const email = (currentUser?.email || profile?.email || "").toLowerCase();
  const myMember =
    members.find((m) => m.userId === currentUser?.id) ||
    members.find((m) => (m.email || "").toLowerCase() === email);
  const viewCtx = {
    isLoggedIn: Boolean(currentUser),
    memberStage: myMember?.scoutStage ?? "",
    role: currentUser?.role || profile?.role || "",
  };

  const pinnedNews = [...news]
    .filter((item) => item.pinned && canSeeNews(item, viewCtx))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-earth-50">
      {/* ============ HERO SECTION ============ */}
      <section
        ref={spotlight.ref}
        onMouseMove={spotlight.onMove}
        onMouseLeave={spotlight.onLeave}
        className="relative overflow-hidden bg-gradient-to-br from-maroon-900 via-maroon-800 to-maroon-950"
      >
        <div className="absolute inset-0">
          <motion.img
            src="/images/Hero.jpg"
            alt=""
            className="h-full w-full object-cover object-center"
            initial={{ scale: 1 }}
            animate={isMobile ? false : { scale: [1, 1.08, 1] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
            fetchPriority="high"
            decoding="async"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-maroon-950/92 via-maroon-900/85 to-maroon-950/95" />
          <div className="absolute inset-0 bg-maroon-950/35" />
        </div>

        {/* Spotlight */}
        {!isMobile && (
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: spotlight.spot.o,
              background: `radial-gradient(600px circle at ${spotlight.spot.x}px ${spotlight.spot.y}px, rgba(251,191,36,0.14), transparent 45%)`,
            }}
          />
        )}

        {/* شرارات ذهبية */}
        {!isMobile && (
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute select-none text-gold-400/40"
                style={{ top: `${15 + i * 13}%`, left: `${8 + i * 15}%`, fontSize: `${10 + (i % 3) * 6}px` }}
                animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
              >
                ✦
              </motion.span>
            ))}
          </div>
        )}

        <div className="relative z-10 mx-auto grid min-h-[85vh] max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="w-full text-right">
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-2 backdrop-blur"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.05 }}
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                <SparklesIcon className="h-4 w-4 text-gold-400" />
              </motion.div>
              <span className="text-xs font-extrabold tracking-wider text-gold-300 uppercase">
                المنصة الكشفية الرقمية
              </span>
            </motion.div>

            <motion.h1 className="mt-6 text-4xl font-extrabold leading-[1.2] tracking-tight text-white sm:text-5xl lg:text-6xl" {...fadeInUp}>
              نقود الجيل القادم
              <br />
              من <FlipWords words={FLIP_WORDS} />
            </motion.h1>

            <motion.p
              className="mt-6 max-w-2xl text-base leading-relaxed text-earth-100/90 sm:text-lg lg:text-xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              منصة <span className="font-extrabold text-gold-300">مجموعة الأنبا إبرام</span> تجمع كل ما يحتاجه القادة والكشافين في مكان واحد: أخبار، اختبارات، متجر متكامل، ومتابعة كاملة للإنجازات.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap justify-start gap-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <ShimmerButton href="#/store">
                ابدأ رحلتك الآن
                <ArrowRightIcon className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
              </ShimmerButton>
              <motion.a
                href="#/news"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 bg-white/5 px-7 py-3.5 text-sm font-extrabold text-white backdrop-blur"
                whileHover={{ scale: 1.05, borderColor: "rgba(255,255,255,0.6)", backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.98 }}
              >
                تعرف على المزيد
              </motion.a>
            </motion.div>

            <motion.div
              className="mt-16 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {STATS.slice(0, 3).map((s) => (
                <motion.div key={s.label} className="group text-right" whileHover={{ y: -4 }}>
                  <p className="text-3xl font-extrabold text-white transition-colors group-hover:text-gold-400 lg:text-4xl">{s.value}</p>
                  <p className="mt-1 text-xs font-semibold text-earth-200/80">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* الكولاج — على الديسكتوب بس */}
          <div className="relative hidden items-center justify-center lg:flex">
            <motion.div
              className="relative h-[440px] w-[440px]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.4 }}
            >
              <motion.div className="absolute inset-0 rounded-full border-2 border-dashed border-gold-400/30" animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} />
              <motion.div className="absolute inset-10 rounded-full border border-gold-400/20" animate={{ rotate: -360 }} transition={{ duration: 38, repeat: Infinity, ease: "linear" }} />
              <div className="absolute inset-20 rounded-full border border-white/10" />

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="relative"
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="animate-rotate-border pointer-events-none absolute -inset-1.5 rounded-full" style={{ background: "conic-gradient(from 0deg, transparent 0 65%, rgba(251,191,36,0.9) 82%, transparent 95%)" }} />
                  <div className="relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-full border-4 border-gold-400/40 bg-gradient-to-br from-gold-400/20 to-gold-500/5 shadow-2xl shadow-gold-500/30 backdrop-blur">
                    <span className="text-8xl drop-shadow-2xl">
                      <img src="/images/Logo_Scout-removebg.png" alt="Scout Logo" className="h-full w-full object-cover" />
                    </span>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-maroon-950/30 to-transparent" />
                  </div>
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-l from-gold-400 to-gold-500 px-4 py-1.5 text-[11px] font-extrabold text-maroon-950 shadow-lg">
                    ⚜️ مجموعة الأنبا إبرام
                  </span>
                </motion.div>
              </div>

              {HERO_CHIPS.map((chip, i) => (
                <motion.div
                  key={chip.label}
                  className="absolute flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-xl backdrop-blur-md"
                  style={{ top: chip.top, right: chip.right }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, y: [0, -10, 0] }}
                  transition={{
                    opacity: { delay: 0.8 + i * 0.15 },
                    scale: { delay: 0.8 + i * 0.15, type: "spring" },
                    y: { duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 },
                  }}
                >
                  <span className="text-2xl">{chip.emoji}</span>
                  <span className="text-xs font-extrabold text-white">{chip.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 text-white/50"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>

        {/* شريط إعلانات متحرك */}
        <div className="absolute bottom-0 inset-x-0 z-10 overflow-hidden border-t border-white/10 bg-maroon-950/70 py-3 backdrop-blur">
          <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="text-xs font-extrabold tracking-wide text-gold-200/90">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ المراحل الكشفية ============ */}
      <section className="relative bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            className="relative flex flex-wrap items-center justify-center gap-3 sm:gap-5"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            <span className="pointer-events-none absolute inset-x-8 top-1/2 hidden border-t-2 border-dashed border-earth-200 md:block" />
            {SCOUT_STAGES.map((s) => (
              <motion.div
                key={s.name}
                className="relative z-10 flex flex-col items-center gap-1.5"
                variants={fadeInUp}
                whileHover={{ y: -6, scale: 1.08 }}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-earth-200 bg-white text-2xl shadow-sm transition-colors hover:border-gold-400 hover:shadow-md">
                  {s.emoji}
                </span>
                <span className="text-[11px] font-extrabold text-earth-700">{s.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="relative overflow-hidden bg-white py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #000 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }} />
        <span className="pointer-events-none absolute -left-6 top-10 select-none text-8xl opacity-[0.04]">⚜️</span>
        <span className="pointer-events-none absolute -right-6 bottom-10 select-none text-8xl opacity-[0.04]">⚜️</span>
        <div className="pointer-events-none absolute -top-32 right-1/4 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-maroon-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div className="text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <motion.span className="inline-flex items-center gap-2 rounded-full border border-maroon-200 bg-maroon-50 px-4 py-1.5 text-xs font-extrabold tracking-wider text-maroon-700 uppercase" whileHover={{ scale: 1.05 }}>
              <SparklesIcon className="h-3.5 w-3.5" /> ماذا نقدّم
            </motion.span>
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="h-px w-10 bg-gradient-to-l from-maroon-300 to-transparent sm:w-16" />
              <h2 className="text-3xl font-extrabold text-earth-900 sm:text-4xl lg:text-5xl">
                مميزات <span className="bg-gradient-to-l from-maroon-600 to-gold-500 bg-clip-text text-transparent">المنصة</span>
              </h2>
              <span className="h-px w-10 bg-gradient-r from-maroon-300 to-transparent sm:w-16" />
            </div>
            <p className="mx-auto mt-3 max-w-xl text-sm text-earth-600 sm:text-base">
              كل ما تحتاجه لرحلة كشفية منظمة وناجحة — أدوات قوية وسهلة الاستخدام
            </p>
          </motion.div>

          <motion.div
            className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {FEATURES.map(({ icon: Icon, title, desc, tone, href }) => (
              <TiltCard
                key={title}
                href={href}
                variants={fadeInUp}
                isMobile={isMobile}
                className="group relative block overflow-hidden rounded-3xl border border-earth-200 bg-white p-7 shadow-sm transition-all hover:border-maroon-300"
              >
                <div className={`inline-flex rounded-2xl border p-3.5 bg-gradient-to-br ${tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-earth-900 group-hover:text-maroon-700 transition-colors">
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-earth-600">
                  {desc}
                </p>
              </TiltCard>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============ PINNED NEWS SECTION ============ */}
      {pinnedNews.length > 0 && (
        <section className="relative overflow-hidden bg-earth-100/60 py-20">
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <motion.div className="text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/50 bg-gold-400/10 px-4 py-1.5 text-xs font-extrabold text-gold-700 uppercase">
                📌 أهم الأخبار والإعلانات
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-earth-900 sm:text-4xl">
                الأخبار <span className="text-maroon-700">المثبتة</span>
              </h2>
            </motion.div>

            {/* خبر واحد = كارت واحد في النص من غير أعمدة فاضية */}
            <div className={`mt-12 grid gap-6 ${pinnedNews.length === 1 ? "mx-auto max-w-3xl" : "md:grid-cols-2 lg:grid-cols-3"}`}>
              {pinnedNews.map((item, idx) => (
                <PinnedNewsCard key={item.id || idx} item={item} index={idx} featured={pinnedNews.length > 1 && idx === 0} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ GALLERY SECTION ============ */}
      <section className="relative bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div className="text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-maroon-200 bg-maroon-50 px-4 py-1.5 text-xs font-extrabold text-maroon-700 uppercase">
              🖼️ معرض الصور
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-earth-900 sm:text-4xl">
              لحظات من <span className="text-maroon-700">أنشطتنا</span>
            </h2>
          </motion.div>

          {/* شبكة 2×2 مضمونة — كل صورة بنفس النسبة عشان مفيش فراغات */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GALLERY.map((img, i) => (
              <motion.div
                key={i}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-earth-200 shadow-sm transition-shadow hover:shadow-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.01 }}
              >
                <img
                  src={img.src}
                  alt={img.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 transition-opacity group-hover:opacity-90" />
                <div className="absolute bottom-4 right-4 text-right">
                  <h4 className="text-lg font-bold text-white">{img.title}</h4>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA — انضم إلينا ============ */}
      <section className="relative overflow-hidden bg-gradient-to-l from-maroon-900 via-maroon-800 to-maroon-700 py-16 sm:py-20">
        <div className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/5 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <span className="pointer-events-none absolute -left-8 bottom-0 select-none text-[10rem] leading-none opacity-[0.06]">⚜️</span>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            {currentUser ? (
              <>
                {/* مسجل دخول — ترحيب وتابع مش تسجيل */}
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/50 bg-gold-400/10 px-4 py-1.5 text-xs font-extrabold text-gold-300 uppercase">
                  ⚜️ نوّرنا
                </span>
                <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                  يلا نكمّل الرحلة يا{" "}
                  <span className="text-gold-300">
                    {((currentUser.name || profile?.name || "").trim().split(/\s+/)[0]) || "قائد"}
                  </span>
                  !
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-maroon-100/90 sm:text-base">
                  شاراتك وامتحاناتك وطلباتك مستنياك — تابع تقدمك من ملفك الشخصي، وشوف إيه الجديد في الوحدة النهارده.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <motion.a
                    href="#/profile"
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-extrabold text-maroon-900 shadow-lg shadow-gold-500/25 transition hover:bg-gold-300"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    ملفي الشخصي <ArrowRightIcon className="h-4 w-4 rotate-180" />
                  </motion.a>
                  <motion.a
                    href="#/news"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-extrabold text-white backdrop-blur transition hover:bg-white/20"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    شوف آخر الأخبار
                  </motion.a>
                </div>
              </>
            ) : (
              <>
                {/* مش مسجل — دعوة للتسجيل */}
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/50 bg-gold-400/10 px-4 py-1.5 text-xs font-extrabold text-gold-300 uppercase">
                  ⚜️ انضم إلينا
                </span>
                <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
                  جاهز تبدأ <span className="text-gold-300">رحلتك الكشفية</span>؟
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-maroon-100/90 sm:text-base">
                  سجّل دخولك عشان تتابع شاراتك وامتحاناتك وطلباتك من مكان واحد — ولو جديد معانا، كلم قادة الوحدة وانضم لعيلة الأنبا إبرام.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <motion.a
                    href="#/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-extrabold text-maroon-900 shadow-lg shadow-gold-500/25 transition hover:bg-gold-300"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    ابدأ من دلوقتي <ArrowRightIcon className="h-4 w-4 rotate-180" />
                  </motion.a>
                  <motion.a
                    href="#/news"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-extrabold text-white backdrop-blur transition hover:bg-white/20"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    شوف آخر الأخبار
                  </motion.a>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}