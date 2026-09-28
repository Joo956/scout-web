import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient.js";
import { uid } from "./admin/ui.jsx";
import { generateUniqueScoutCode } from "./utils/generateScoutCode.js";
import { initialBadges } from "./admin/badges-seed.js";

const StoreContext = createContext(null);

// =============================================================
// طبقة الـ mapping
// =============================================================
const mapProduct = (p) => ({
  id: p.id, name: p.name, sku: p.sku, category: p.category_id,
  price: Number(p.price), stock: p.stock, rating: Number(p.rating ?? 5),
  reviews: p.reviews ?? 0, imageUrl: p.image_url ?? "",
});
const toProductRow = (p) => ({
  name: p.name, sku: p.sku ?? null, category_id: p.category ?? null,
  price: p.price, stock: p.stock, rating: p.rating ?? 5, reviews: p.reviews ?? 0,
  image_url: p.imageUrl || null,
});
const DEFAULT_SETTINGS = { title: "المتجر", description: "", categories: [], priceRanges: [], availability: [] };
const mapSettings = (s) => ({
  id: s?.id ?? 1, title: s?.title ?? "المتجر", description: s?.description ?? "",
  whatsappNumber: s?.whatsapp_number ?? "", categories: s?.categories ?? [],
  priceRanges: s?.price_ranges ?? [], availability: s?.availability ?? [],
});
const mapOrder = (o) => ({
  id: o.id, userId: o.user_id, orderId: o.order_id, customer: o.customer,
  items: o.items, total: Number(o.total), status: o.status, date: o.date,
  approvedAt: o.approved_at ?? null, approvedBy: o.approved_by ?? null,
  receivedAt: o.received_at ?? null, receivedBy: o.received_by ?? null,
});
const mapBook = (b) => ({
  id: b.id, title: b.title, author: b.author, category: b.category,
  description: b.description, coverUrl: b.cover_url ?? "", fileUrl: b.file_url ?? "",
});
const toBookRow = (b) => ({
  title: b.title, author: b.author || null, category: b.category || null,
  description: b.description || null, cover_url: b.coverUrl || null, file_url: b.fileUrl || null,
});
const mapNews = (n) => ({
  id: n.id, title: n.title, body: n.body, category: n.category, pinned: n.pinned,
  form: n.form ?? null, submissions: n.submissions ?? [], imageUrl: n.image_url ?? "",
  description: n.description ?? "", date: n.date,
});
const toNewsRow = (n) => ({
  title: n.title, body: n.body, category: n.category ?? null, pinned: n.pinned ?? false,
  form: n.form ?? null, submissions: n.submissions ?? [], image_url: n.imageUrl || null,
  description: n.description || null, date: n.date || new Date().toISOString().slice(0, 10),
});
const mapExam = (e) => ({
  id: e.id, title: e.title, examCode: e.exam_code ?? "", duration: e.duration,
  status: e.status, scoutStage: e.scout_stage ?? "", submissions: e.submissions ?? 0,
  questionList: e.question_list ?? [], results: [],
});
const toExamRow = (e) => ({
  title: e.title, exam_code: e.examCode || null, duration: e.duration,
  status: e.status, scout_stage: e.scoutStage || null, question_list: e.questionList ?? [],
});
const mapBadge = (b) => ({
  id: b.id, name: b.name, nameEn: b.name_en, category: b.category,
  description: b.description, requirements: b.requirements, level: b.level,
  points: b.points, iconUrl: b.icon_url ?? "", status: b.status,
  visible: b.visible ?? true, requiredExamId: b.required_exam_id,
  scoutStage: b.scout_stage, applicationFields: b.application_fields ?? [],
  createdAt: b.created_at,
});
const mapMember = (m) => ({
  id: m.id, scoutCode: m.scout_code, name: m.name, fatherName: m.father_name,
  motherName: m.mother_name, birthDate: m.birth_date, scoutStage: m.scout_stage,
  educationStage: m.education_stage, email: m.email, phone: m.phone,
  address: m.address, fatherPhone: m.father_phone, motherPhone: m.mother_phone,
  college: m.college, governorate: m.governorate, confessor: m.confessor,
  scoutNumber: m.scout_number, mobile2: m.mobile2, siblingsCount: m.siblings_count ?? 0,
  userId: m.user_id, classId: m.class_id ?? null,
});
const toMemberRow = (m) => ({
  scout_code: m.scoutCode ?? null, name: m.name, father_name: m.fatherName ?? null,
  mother_name: m.motherName ?? null, birth_date: m.birthDate || null,
  scout_stage: m.scoutStage ?? null, education_stage: m.educationStage ?? null,
  email: m.email ?? null, phone: m.phone ?? null, address: m.address ?? null,
  father_phone: m.fatherPhone ?? null, mother_phone: m.motherPhone ?? null,
  college: m.college ?? null, governorate: m.governorate ?? null,
  confessor: m.confessor ?? null, scout_number: m.scoutNumber || null,
  mobile2: m.mobile2 ?? null, siblings_count: m.siblingsCount ?? 0,
});
const fmtSubmitted = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};
const mapExamResult = (r) => ({
  id: r.id, examId: r.exam_id, userId: r.user_id, name: r.member_name,
  rank: r.rank, email: r.email, score: r.score, totalQuestions: r.total_questions,
  approved: r.approved ?? false, submitted: fmtSubmitted(r.submitted_at),
  submittedAt: r.submitted_at,
});
const mapProfileRow = (p) => ({
  id: p.id, fullName: p.full_name, name: p.full_name, email: p.email,
  role: p.role, permissions: p.permissions ?? [], createdAt: p.created_at,
  passwordSet: p.password_set ?? true,
});

// =============================================================
// 🚀 Cache محسّن
// =============================================================
const CACHE_PREFIX = "ava-cache-";
const TTL_PUBLIC = 5 * 60 * 1000;   // 5 دقايق
const TTL_PRIVATE = 60 * 1000;      // دقيقة واحدة (بيانات شخصية)

const cacheGet = (key, ttlMs) => {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.at < ttlMs) return c.data;
    sessionStorage.removeItem(CACHE_PREFIX + key);
  } catch {}
  return null;
};
const cacheSet = (key, data, ttlMs = TTL_PUBLIC) => {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data, ttl: ttlMs }));
  } catch {}
};
const cacheInvalidate = () => {
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(k);
    });
  } catch {}
};

const translateAuthError = (error) => {
  const msg = error?.message || "";
  if (/invalid login credentials/i.test(msg)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (/email not confirmed/i.test(msg)) return "البريد الإلكتروني غير مؤكد — تحقق من بريدك.";
  if (/email.+not found|user not found/i.test(msg)) return "لا يوجد حساب بهذا البريد الإلكتروني.";
  if (/disabled|not configured/i.test(msg)) return "المشروع غير مفعّل — راجع إعدادات Supabase.";
  return "تعذر تسجيل الدخول — حاول مرة أخرى.";
};

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [exams, setExams] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [news, setNews] = useState([]);
  const [books, setBooks] = useState([]);
  const [storeSettings, setStoreSettings] = useState(DEFAULT_SETTINGS);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [badges, setBadges] = useState([]);
  const [badgeAwards, setBadgeAwards] = useState([]);
  const [attendanceScope, setAttendanceScope] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cart, setCart] = useState(() => {
    try { const s = localStorage.getItem('ava-cart'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('ava-cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  // 🚀 AbortController لإلغاء الطلبات القديمة
  const abortRef = useRef(null);
  const refreshInFlight = useRef(false);
  const refreshQueue = useRef(0);

  const currentUserRef = useRef(null);
  currentUserRef.current = currentUser;

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) { setCurrentUser(null); setProfile(null); return null; }
    let row = null;
    if (isSupabaseConfigured) {
      const { data } = await supabase.from("profiles_with_email").select("*").eq("id", authUser.id).maybeSingle();
      row = data;
    }
    const merged = {
      id: authUser.id, email: authUser.email,
      name: row?.full_name || authUser.email, role: row?.role || "member",
      permissions: row?.permissions ?? [], passwordSet: row?.password_set ?? true,
    };
    const mapped = mapProfileRow({ ...(row ?? {}), id: authUser.id, email: authUser.email });
    setCurrentUser(merged); setProfile(mapped);
    return merged;
  }, []);

  const loadAttendanceScope = useCallback(async () => {
    if (!isSupabaseConfigured) { setAttendanceScope(null); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setAttendanceScope(null); return; }
      const { data, error } = await supabase.rpc("my_attendance_scope");
      setAttendanceScope(error ? null : (data ?? null));
    } catch { setAttendanceScope(null); }
  }, []);

  // 🚀 refreshData محسّنة: طلب واحد + retry + debounce + abort
  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    // Debounce: لو فيه refresh شغال، صف الطلب الجديد (ما تكررش)
    if (refreshInFlight.current) {
      refreshQueue.current++;
      return;
    }
    refreshInFlight.current = true;
    setError(null);

    // إلغاء الطلب السابق لو موجود
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const isAuth = !!session;
      const cacheKey = isAuth ? "bundle-auth" : "bundle-pub";
      const ttl = isAuth ? TTL_PRIVATE : TTL_PUBLIC;

      // 🚀 الكاش الأول — لو لسه صالح، مش هنطلب من السيرفر خالص
      let bundle = cacheGet(cacheKey, ttl);
      if (!bundle) {
        // Retry مرة واحدة لو فشل
        let attempt = 0, lastErr = null;
        while (attempt < 2) {
          try {
            const { data, error } = await supabase.rpc("get_app_bundle", { p_private: isAuth });
            if (error) throw error;
            bundle = data ?? {};
            cacheSet(cacheKey, bundle, ttl);
            break;
          } catch (e) {
            lastErr = e;
            attempt++;
            if (attempt < 2) await new Promise(r => setTimeout(r, 400));
          }
        }
        if (!bundle && lastErr) {
          setError(lastErr.message);
          bundle = {};
        }
      }

      // Abort check — لو الطلب اتلغى، متحدّثش state
      if (ctrl.signal.aborted) return;

      // تطبيق البيانات
      setProducts((bundle.products ?? []).map(mapProduct));
      setStoreSettings(bundle.store_settings ? mapSettings(bundle.store_settings) : DEFAULT_SETTINGS);
      setBooks((bundle.books ?? []).map(mapBook));
      setNews((bundle.news ?? []).map(mapNews));
      setExams((bundle.exams ?? []).map(mapExam));

      if (isAuth) {
        setOrders((bundle.orders ?? []).map(mapOrder));
        setMembers((bundle.members ?? []).map(mapMember));
        setExamResults((bundle.exam_results ?? []).map(mapExamResult));
        setProfiles((bundle.profiles ?? []).map(mapProfileRow));
        setBadges((bundle.badges ?? []).map(mapBadge));
        setBadgeAwards(bundle.badge_awards ?? []);
      } else {
        setOrders([]); setMembers([]); setExamResults([]);
        setProfiles([]); setBadges([]); setBadgeAwards([]);
      }

      await loadAttendanceScope();
    } finally {
      refreshInFlight.current = false;
      // لو فيه طلب اتصف وقت الشغل، نفّذه مرة واحدة
      if (refreshQueue.current > 0) {
        refreshQueue.current = 0;
        setTimeout(() => refreshData(), 50);
      }
      setLoading(false);
    }
  }, [loadAttendanceScope]);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await loadProfile(session.user);
      await refreshData();
      if (active) setLoading(false);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await loadProfile(session.user);
        await refreshData();
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null); setProfile(null); setProfiles([]);
        cacheInvalidate();
        await refreshData();
      }
    });
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, [loadProfile, refreshData]);

  const permissions = useMemo(() => currentUser?.permissions ?? [], [currentUser]);
  const isAdmin = currentUser?.role === "admin";
  const isSubadmin = currentUser?.role === "subadmin";

  const hasPermission = useCallback((perm) => {
    if (!perm) return false;
    const perms = Array.isArray(permissions) ? permissions
      : typeof permissions === 'string' ? permissions.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (isAdmin) return true;
    return perms.includes(perm) || perms.includes("*");
  }, [isAdmin, permissions]);

  const canRead = useCallback((section) => hasPermission(`${section}:read`), [hasPermission]);
  const canWrite = useCallback((section) => hasPermission(`${section}:write`), [hasPermission]);

  const login = async ({ email, password }) => {
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(translateAuthError(authError));
    const merged = await loadProfile(data.user);
    cacheInvalidate();
    await refreshData();
    return merged;
  };

  const logout = async () => {
    setCurrentUser(null); setProfile(null); setProfiles([]);
    cacheInvalidate();
    if (isSupabaseConfigured) { try { await supabase.auth.signOut(); } catch {} }
  };

  const changePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  };

  const setOwnPassword = async (newPassword) => {
    const { error } = await supabase.rpc("member_set_own_password", { p_new_password: newPassword });
    if (error) throw new Error(error.message);
    setProfile((p) => p ? { ...p, passwordSet: true } : p);
    setCurrentUser((p) => p ? { ...p, passwordSet: true } : p);
  };

  const addToCart = (productId, qty = 1) => setCart((prev) => {
    const e = prev.find((c) => c.id === productId);
    if (e) return prev.map((c) => c.id === productId ? { ...c, qty: c.qty + qty } : c);
    return [...prev, { id: productId, qty }];
  });
  const updateCartQty = (productId, qty) => setCart((prev) =>
    qty <= 0 ? prev.filter((c) => c.id !== productId) : prev.map((c) => c.id === productId ? { ...c, qty } : c));
  const removeFromCart = (productId) => setCart((prev) => prev.filter((c) => c.id !== productId));
  const clearCart = () => setCart([]);

  // ===== Products =====
  const addProduct = async (data) => {
    const { data: created, error } = await supabase.from("products").insert(toProductRow(data)).select().single();
    if (error) throw error;
    const m = mapProduct(created);
    setProducts((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const updateProduct = async (id, data) => {
    const { data: u, error } = await supabase.from("products").update(toProductRow(data)).eq("id", id).select().single();
    if (error) throw error;
    const m = mapProduct(u);
    setProducts((p) => p.map((x) => x.id === id ? m : x)); cacheInvalidate();
    return m;
  };
  const deleteProduct = async (id) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    setProducts((p) => p.filter((x) => x.id !== id)); cacheInvalidate();
  };

  // ===== Settings =====
  const persistSettings = async (next) => {
    const { data, error } = await supabase.from("store_settings").upsert({
      id: 1, title: next.title, description: next.description,
      whatsapp_number: next.whatsappNumber ?? "",
      categories: next.categories ?? [], price_ranges: next.priceRanges ?? [],
      availability: next.availability ?? [],
    }).select().single();
    if (error) throw error;
    const m = mapSettings(data); setStoreSettings(m); cacheInvalidate();
    return m;
  };
  const updateStoreInfo = (patch) => persistSettings({ ...storeSettings, ...patch });
  const addCategory = (data) => persistSettings({ ...storeSettings, categories: [...storeSettings.categories, { ...data, id: uid() }] });
  const updateCategory = (id, data) => persistSettings({ ...storeSettings, categories: storeSettings.categories.map((c) => c.id === id ? { ...c, ...data } : c) });
  const deleteCategory = (id) => persistSettings({ ...storeSettings, categories: storeSettings.categories.filter((c) => c.id !== id) });
  const addPriceRange = (data) => persistSettings({ ...storeSettings, priceRanges: [...storeSettings.priceRanges, { ...data, id: uid() }] });
  const updatePriceRange = (id, data) => persistSettings({ ...storeSettings, priceRanges: storeSettings.priceRanges.map((r) => r.id === id ? { ...r, ...data } : r) });
  const deletePriceRange = (id) => persistSettings({ ...storeSettings, priceRanges: storeSettings.priceRanges.filter((r) => r.id !== id) });
  const addAvailability = (data) => persistSettings({ ...storeSettings, availability: [...storeSettings.availability, { ...data, id: uid() }] });
  const updateAvailability = (id, data) => persistSettings({ ...storeSettings, availability: storeSettings.availability.map((a) => a.id === id ? { ...a, ...data } : a) });
  const deleteAvailability = (id) => persistSettings({ ...storeSettings, availability: storeSettings.availability.filter((a) => a.id !== id) });

  // ===== Orders =====
  const updateOrderStatus = async (id, status) => {
    const { data, error } = await supabase.rpc("set_order_status", { p_id: id, p_status: status });
    if (error) throw error;
    const m = mapOrder(data);
    setOrders((p) => p.map((o) => o.id === id ? m : o)); cacheInvalidate();
    return m;
  };
  const receiveOrder = async (orderIdText) => {
    const { data, error } = await supabase.rpc("receive_order", { p_order_id: orderIdText });
    if (error) throw error;
    const m = mapOrder(data);
    setOrders((p) => p.map((o) => o.id === m.id ? m : o)); cacheInvalidate();
    return m;
  };
  const placeOrder = async (items, customer) => {
    const { data, error } = await supabase.rpc("place_order", { p_items: items, p_customer: customer ?? null });
    if (error) throw error;
    const m = mapOrder(data);
    setOrders((p) => [m, ...p]);
    setProducts((p) => p.map((x) => {
      const q = items.filter((i) => i.product_id === x.id).reduce((s, i) => s + (i.qty ?? 0), 0);
      return q > 0 ? { ...x, stock: Math.max(0, x.stock - q) } : x;
    }));
    cacheInvalidate();
    return m;
  };

  // ===== Exams =====
  const addExam = async (data) => {
    const { data: c, error } = await supabase.from("exams").insert(toExamRow(data)).select().single();
    if (error) throw error;
    const m = mapExam(c); setExams((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const updateExam = async (id, data) => {
    const { data: u, error } = await supabase.from("exams").update(toExamRow(data)).eq("id", id).select().single();
    if (error) throw error;
    const m = mapExam(u); setExams((p) => p.map((e) => e.id === id ? m : e)); cacheInvalidate();
    return m;
  };
  const deleteExam = async (id) => {
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) throw error;
    setExams((p) => p.filter((e) => e.id !== id));
    setExamResults((p) => p.filter((r) => r.examId !== id));
    cacheInvalidate();
  };

  // ===== News =====
  const addNews = async (data) => {
    const { data: c, error } = await supabase.from("news").insert(toNewsRow(data)).select().single();
    if (error) throw error;
    const m = mapNews(c); setNews((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const updateNews = async (id, data) => {
    const { data: u, error } = await supabase.from("news").update(toNewsRow(data)).eq("id", id).select().single();
    if (error) throw error;
    const m = mapNews(u); setNews((p) => p.map((n) => n.id === id ? m : n)); cacheInvalidate();
    return m;
  };
  const deleteNews = async (id) => {
    const { error } = await supabase.from("news").delete().eq("id", id);
    if (error) throw error;
    setNews((p) => p.filter((n) => n.id !== id)); cacheInvalidate();
  };
  const submitNewsForm = async (newsId, data) => {
    const submission = { ...data, sentAt: new Date().toISOString(), confirmData: data.confirmData ?? false, extraData: data.extraData ?? "" };
    const { data: subs, error } = await supabase.rpc("submit_news_form", { p_news_id: newsId, p_submission: submission });
    if (error) throw error;
    const next = subs ?? [];
    setNews((p) => p.map((n) => n.id === newsId ? { ...n, submissions: next } : n));
    cacheInvalidate();
    return next;
  };
  const deleteNewsSubmission = async (newsId, sentAt) => {
    const item = news.find((n) => n.id === newsId);
    const subs = (item?.submissions ?? []).filter((s) => s.sentAt !== sentAt);
    const { error } = await supabase.from("news").update({ submissions: subs }).eq("id", newsId);
    if (error) throw error;
    setNews((p) => p.map((n) => n.id === newsId ? { ...n, submissions: subs } : n));
    cacheInvalidate();
  };

  // ===== Books =====
  const addBook = async (data) => {
    const { data: c, error } = await supabase.from("books").insert(toBookRow(data)).select().single();
    if (error) throw error;
    const m = mapBook(c); setBooks((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const updateBook = async (id, data) => {
    const { data: u, error } = await supabase.from("books").update(toBookRow(data)).eq("id", id).select().single();
    if (error) throw error;
    const m = mapBook(u); setBooks((p) => p.map((b) => b.id === id ? m : b)); cacheInvalidate();
    return m;
  };
  const deleteBook = async (id) => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
    setBooks((p) => p.filter((b) => b.id !== id)); cacheInvalidate();
  };

  // ===== Members =====
  const searchMembers = async (q = "", page = 0, pageSize = 50) => {
    let query = supabase.from("members").select("*", { count: "exact" }).order("name").range(page * pageSize, page * pageSize + pageSize - 1);
    if (q && q.trim()) query = query.or(`name.ilike.%${q}%,scout_code.ilike.%${q}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []).map(mapMember), count: count ?? 0 };
  };
  const addMember = async (data) => {
    const scoutCode = data.scoutCode || generateUniqueScoutCode(data, members);
    const { data: c, error } = await supabase.from("members").insert({ ...toMemberRow(data), scout_code: scoutCode }).select().single();
    if (error) throw error;
    const m = mapMember(c); setMembers((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const addMembers = async (newMembersData) => {
    const existingNames = new Set(members.map((m) => (m.name || "").toLowerCase()));
    const existingCodes = new Set(members.map((m) => m.scoutCode));
    const processed = []; const seenNames = new Set(existingNames); const seenCodes = new Set(existingCodes);
    for (const data of newMembersData) {
      const name = (data.name || "").trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      let sc = data.scoutCode;
      const pool = [...members, ...processed];
      if (sc && seenCodes.has(sc)) sc = generateUniqueScoutCode(data, pool);
      if (!sc) sc = generateUniqueScoutCode(data, pool);
      seenNames.add(name.toLowerCase()); if (sc) seenCodes.add(sc);
      processed.push({ ...data, name, scoutCode: sc });
    }
    if (processed.length === 0) return [];
    const rows = processed.map((m) => ({ ...toMemberRow(m), scout_code: m.scoutCode }));
    const { data, error } = await supabase.from("members").insert(rows).select();
    if (error) throw error;
    const created = (data ?? []).map(mapMember);
    setMembers((p) => [...created, ...p]); cacheInvalidate();
    return created;
  };
  const updateMember = async (id, data) => {
    const { data: u, error } = await supabase.from("members").update(toMemberRow(data)).eq("id", id).select().single();
    if (error) throw error;
    const m = mapMember(u); setMembers((p) => p.map((x) => x.id === id ? m : x)); cacheInvalidate();
    return m;
  };
  const deleteMember = async (id) => {
    const { error } = await supabase.rpc("admin_delete_member", { p_member_id: id });
    if (error) throw error;
    setMembers((p) => p.filter((m) => m.id !== id)); cacheInvalidate();
  };

  // ===== Badges =====
  const addBadge = async (badge) => {
    const row = {
      name: badge.name, name_en: badge.nameEn || null, category: badge.category,
      description: badge.description, requirements: badge.requirements,
      level: badge.level, points: badge.points, icon_url: badge.iconUrl || null,
      status: badge.status || "نشط", visible: badge.visible ?? true,
      required_exam_id: badge.requiredExamId || null, scout_stage: badge.scoutStage || null,
      application_fields: badge.applicationFields ?? [],
    };
    const { data, error } = await supabase.from("badges").insert(row).select().single();
    if (error) throw error;
    const m = mapBadge(data); setBadges((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const updateBadge = async (id, updates) => {
    const row = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.nameEn !== undefined) row.name_en = updates.nameEn;
    if (updates.category !== undefined) row.category = updates.category;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.requirements !== undefined) row.requirements = updates.requirements;
    if (updates.level !== undefined) row.level = updates.level;
    if (updates.points !== undefined) row.points = updates.points;
    if (updates.iconUrl !== undefined) row.icon_url = updates.iconUrl || null;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.visible !== undefined) row.visible = updates.visible;
    if (updates.requiredExamId !== undefined) row.required_exam_id = updates.requiredExamId || null;
    if (updates.scoutStage !== undefined) row.scout_stage = updates.scoutStage || null;
    if (updates.applicationFields !== undefined) row.application_fields = updates.applicationFields;
    const { data, error } = await supabase.from("badges").update(row).eq("id", id).select().single();
    if (error) throw error;
    const m = mapBadge(data); setBadges((p) => p.map((b) => b.id === id ? m : b)); cacheInvalidate();
    return m;
  };
  const deleteBadge = async (id) => {
    const { error } = await supabase.from("badges").delete().eq("id", id);
    if (error) throw error;
    setBadges((p) => p.filter((b) => b.id !== id)); cacheInvalidate();
  };
  const awardBadge = async (badgeId, memberId, notes = "") => {
    const { data, error } = await supabase.from("badge_awards")
      .insert({ badge_id: badgeId, member_id: memberId, status: "approved", notes, awarded_by: currentUser?.id, awarded_at: new Date().toISOString() })
      .select("*, badges(name, icon_url, category, points, level), members(name, scout_code)").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("لم يتم إرجاع صف بعد الإدراج");
    setBadgeAwards((p) => [data, ...p]); cacheInvalidate();
    return data;
  };
  const revokeBadge = async (awardId, reason = "") => {
    const { data, error } = await supabase.from("badge_awards")
      .update({ status: "revoked", notes: reason }).eq("id", awardId)
      .select("*, badges(name, icon_url, category, points, level), members(name, scout_code)").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ليس لديك صلاحية");
    setBadgeAwards((p) => p.map((a) => a.id === awardId ? data : a)); cacheInvalidate();
    return data;
  };
  const startBadge = async (badgeId, memberId) => {
    const { data, error } = await supabase.from("badge_awards")
      .insert({ badge_id: badgeId, member_id: memberId, status: "pending_start" })
      .select("*, badges(name, icon_url, category, points, level), members(name, scout_code)").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("لم يتم إرجاع صف");
    setBadgeAwards((p) => [data, ...p]); cacheInvalidate();
    return data;
  };
  const updateBadgeAward = async (awardId, updates) => {
    const row = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.evidence !== undefined) row.evidence = updates.evidence;
    if (updates.notes !== undefined) row.notes = updates.notes;
    if (updates.applicationData !== undefined) row.application_data = updates.applicationData;
    if (Object.keys(row).length === 0) return;
    const { data, error } = await supabase.from("badge_awards").update(row).eq("id", awardId)
      .select("*, badges(name, icon_url, category, points, level), members(name, scout_code)").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ليس لديك صلاحية");
    setBadgeAwards((p) => p.map((a) => a.id === awardId ? data : a)); cacheInvalidate();
    return data;
  };
  const seedBadges = async () => {
    const { data, error } = await supabase.from("badges").select("name");
    if (error) throw error;
    const existing = new Set((data ?? []).map((b) => b.name));
    const toInsert = initialBadges.filter((b) => !existing.has(b.name));
    if (toInsert.length === 0) return { inserted: 0, skipped: initialBadges.length };
    const { data: created, error: ie } = await supabase.from("badges").insert(toInsert).select();
    if (ie) throw ie;
    setBadges((p) => [...created.map(mapBadge), ...p]); cacheInvalidate();
    return { inserted: created.length, skipped: existing.size };
  };

  // ===== Exam Results =====
  const submitExamResult = async (examId, submission) => {
    if (!currentUser?.id) throw new Error("لازم تسجل دخول");
    const exam = exams.find((e) => e.id === examId);
    const total = exam?.questionList?.length ?? exam?.questions ?? 0;
    const { data: c, error } = await supabase.from("exam_results").insert({
      exam_id: examId, user_id: currentUser.id, member_name: submission.name,
      rank: submission.rank ?? null, email: currentUser.email ?? submission.email ?? null,
      score: submission.score, total_questions: total, approved: false,
    }).select().single();
    if (error) throw error;
    const m = mapExamResult(c); setExamResults((p) => [m, ...p]); cacheInvalidate();
    return m;
  };
  const approveExamResult = async (resultId) => {
    const { data: u, error } = await supabase.from("exam_results").update({ approved: true }).eq("id", resultId).select().single();
    if (error) throw error;
    const m = mapExamResult(u);
    setExamResults((p) => p.map((r) => r.id === resultId ? m : r)); cacheInvalidate();
    return m;
  };
  const allowExamRetake = async (resultId) => {
    const { error } = await supabase.from("exam_results").delete().eq("id", resultId);
    if (error) throw error;
    setExamResults((p) => p.filter((r) => r.id !== resultId)); cacheInvalidate();
  };

  // ===== Users =====
  const createStaffAccount = async (memberId, password, role, permissions) => {
    const { data: uidNew, error } = await supabase.rpc("create_member_staff_account", {
      p_member_id: memberId, p_password: password, p_role: role, p_permissions: permissions ?? [],
    });
    if (error) throw error;
    cacheInvalidate(); await refreshData();
    return uidNew;
  };
  const updateUser = async (userId, data) => {
    const row = {};
    if ("name" in data) row.full_name = data.name;
    if ("role" in data) row.role = data.role;
    if ("permissions" in data) row.permissions = data.permissions;
    const { error } = await supabase.from("profiles").update(row).eq("id", userId);
    if (error) throw error;
    cacheInvalidate(); await refreshData();
  };
  const deleteUser = async (userId) => {
    const { error } = await supabase.rpc("admin_delete_user", { p_uid: userId });
    if (error) throw error;
    cacheInvalidate(); await refreshData();
  };
  const setUserPassword = async (userId, password) => {
    const { error } = await supabase.rpc("admin_set_password", { p_uid: userId, p_password: password });
    if (error) throw error;
  };
  const setUserEmail = async (userId, email) => {
    const { error } = await supabase.rpc("admin_set_email", { p_uid: userId, p_email: email });
    if (error) throw error;
  };
  const createMemberAccounts = async (items) => {
    const { data, error } = await supabase.rpc("admin_create_member_accounts", { p_members: items });
    if (error) throw error;
    cacheInvalidate(); await refreshData();
    return data;
  };

  const enrichedExams = useMemo(() => exams.map((exam) => {
    const results = examResults.filter((r) => r.examId === exam.id).map((r) => ({
      id: r.id, userId: r.userId, name: r.name, rank: r.rank, email: r.email,
      score: r.score, totalQuestions: r.totalQuestions, approved: r.approved ?? false,
      submitted: r.submitted,
    }));
    return { ...exam, results, submissions: results.length };
  }), [exams, examResults]);

  const store = {
    products, orders, exams: enrichedExams, examResults, news, books, storeSettings,
    members, profiles, users: profiles,
    currentUser, profile, loading, error, isSupabaseConfigured,
    isAdmin, isSubadmin, permissions, hasPermission, canRead, canWrite,
    attendanceScope, refreshData,
    login, logout, changePassword, setOwnPassword,
    cart, addToCart, updateCartQty, removeFromCart, clearCart,
    addProduct, updateProduct, deleteProduct,
    updateStoreInfo, addCategory, updateCategory, deleteCategory,
    addPriceRange, updatePriceRange, deletePriceRange,
    addAvailability, updateAvailability, deleteAvailability,
    placeOrder, updateOrderStatus, receiveOrder,
    addExam, updateExam, deleteExam, submitExamResult, approveExamResult, allowExamRetake,
    addNews, updateNews, deleteNews, submitNewsForm, deleteNewsSubmission,
    addBook, updateBook, deleteBook,
    addMember, addMembers, updateMember, deleteMember, createMemberAccounts, searchMembers,
    badges, badgeAwards, addBadge, updateBadge, deleteBadge,
    awardBadge, startBadge, revokeBadge, updateBadgeAward, seedBadges,
    createStaffAccount, updateUser, deleteUser, setUserPassword, setUserEmail,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() { return useContext(StoreContext); }