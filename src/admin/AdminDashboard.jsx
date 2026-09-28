import { useState, useEffect } from "react";
import {
  BoxIcon,
  ClipboardIcon,
  CartIcon,
  MegaphoneIcon,
  BookIcon,
  ListIcon,
  XIcon,
  LogoutIcon,
  CompassMarkIcon,
  UsersIcon,
} from "./icons.jsx";
import { Toasts, uid } from "./ui.jsx";
import { useStore } from "../store.jsx";
import { supabase } from "../lib/supabaseClient.js";
import StoreSection from "./StoreSection.jsx";
import ExamsSection from "./ExamsSection.jsx";
import OrdersSection from "./OrdersSection.jsx";
import NewsSection from "./NewsSection.jsx";
import LibrarySection from "./LibrarySection.jsx";
import MembersSection from "./MembersSection.jsx";
import UserManagement from "./UserManagement.jsx";
import ImportMembers from "./ImportMembers.jsx";
import AttendanceSection from "./AttendanceSection.jsx";
import BadgesSection from "./BadgesSection.jsx";

const TrophyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14M5 3v4a7 7 0 0014 0V3M12 14v4m-3 0h6M8 21h8M5 3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 3a2 2 0 012 2v1a4 4 0 01-4 4h0" />
  </svg>
);

const NAV = [
  { id: "members", label: "إدارة الكشافين", icon: UsersIcon },
  { id: "attendance", label: "إدارة الحضور", icon: ClipboardIcon },
  { id: "exams", label: "إدارة الاختبارات", icon: ClipboardIcon },
  { id: "store", label: "إدارة المتجر", icon: BoxIcon },
  { id: "library", label: "إدارة المكتبة", icon: BookIcon },
  { id: "orders", label: "إدارة الطلبات", icon: CartIcon },
  { id: "news", label: "إدارة الأخبار", icon: MegaphoneIcon },
  { id: "badges", label: "الشارات", icon: TrophyIcon },
];

const SECTION_PERM = {
  members: "members",
  attendance: "attendance",
  exams: "exams",
  store: "store",
  library: "library",
  orders: "orders",
  news: "news",
  badges: "badges",
};

// توافق مع الصلاحيات القديمة المحفوظة عند المديرين الفرعيين —
// الحضور كان ملزوق بـ members والتقديمات بـ news والشارات بـ members
const LEGACY_PERM = {
  attendance: "members",
  badges: "members",
};

export default function AdminDashboard() {
  const {
    currentUser,
    products, orders, exams, news, books, storeSettings, members, profiles,
    logout, isAdmin, isSubadmin, canRead, canWrite,
    attendanceScope,
    addProduct: storeAddProduct,
    updateProduct: storeUpdateProduct,
    deleteProduct: storeDeleteProduct,
    updateOrderStatus: storeUpdateOrderStatus,
    addExam: storeAddExam,
    updateExam: storeUpdateExam,
    deleteExam: storeDeleteExam,
    approveExamResult: storeApproveExamResult,
    allowExamRetake: storeAllowExamRetake,
    addNews: storeAddNews,
    updateNews: storeUpdateNews,
    deleteNews: storeDeleteNews,
    deleteNewsSubmission: storeDeleteNewsSubmission,
    addBook: storeAddBook,
    updateBook: storeUpdateBook,
    deleteBook: storeDeleteBook,
    updateStoreInfo: storeUpdateInfo,
    addCategory: storeAddCategory,
    updateCategory: storeUpdateCategory,
    deleteCategory: storeDeleteCategory,
    addPriceRange: storeAddPriceRange,
    updatePriceRange: storeUpdatePriceRange,
    deletePriceRange: storeDeletePriceRange,
    addAvailability: storeAddAvailability,
    updateAvailability: storeUpdateAvailability,
    deleteAvailability: storeDeleteAvailability,
    addMember: storeAddMember,
    updateMember: storeUpdateMember,
    deleteMember: storeDeleteMember,
  } = useStore();

  // هيكل الحضور: المسئول عن مرحلة/فصل/قائد فصل معيَّن من تاب الهيكل
  // — لهم الدخول على إدارة الحضور حتى لو ماعندهمش صلاحية تانية
  const isAttendanceStaff = Boolean(attendanceScope?.assigned);

  const canReadSection = (id) =>
    id === "attendance"
      ? isAdmin || canRead(SECTION_PERM[id]) || canRead(LEGACY_PERM[id]) || isAttendanceStaff
      : isAdmin || canRead(SECTION_PERM[id]) || canRead(LEGACY_PERM[id]);
  const isReadOnly = (id) => {
    // إدارة الحسابات = أدمن عام بس (حتى لو المدير الفرعي عنده users:write)
    if (id === "users") return !isAdmin;
    // إدارة الحضور: التسجيل لقائد/مسئول الفصل ومسئول المرحلة والأدمن فقط —
    // أصحاب الصلاحيات القديمة (attendance:write) بقوا عرض فقط
    if (id === "attendance")
      return !(isAdmin || isAttendanceStaff);
    return !isAdmin && !(canWrite(SECTION_PERM[id]) || canWrite(LEGACY_PERM[id]));
  };
  const visibleNav = NAV.filter((item) => canReadSection(item.id));

  const noAccess = !isAdmin && visibleNav.length === 0 && !canRead("users");

  const getSectionFromHash = () => {
    const h = window.location.hash;
    if (h.includes("/admin/users")) return "users";
    if (h.includes("/admin/import")) return "import";
    if (h.includes("/admin/attendance")) return "attendance";
    if (h.includes("/admin/exams")) return "exams";
    if (h.includes("/admin/store")) return "store";
    if (h.includes("/admin/library")) return "library";
    if (h.includes("/admin/orders")) return "orders";
    if (h.includes("/admin/news")) return "news";
    if (h.includes("/admin/badges")) return "badges";
    return "members";
  };

  const [section, setSection] = useState(getSectionFromHash());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [submissionFilter, setSubmissionFilter] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);

  // ✅ نسخة احتياطية كاملة — بتنزّل كل بيانات الموقع ملف JSON
  const handleBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const { data, error } = await supabase.rpc("get_app_bundle", { p_private: true });
      if (error) throw error;
      const payload = {
        app: "مجموعة الانبا ابرام الكشفية",
        backup_version: 1,
        created_at: new Date().toISOString(),
        counts: Object.fromEntries(
          Object.entries(data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])
        ),
        data: data ?? {},
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
      a.download = `backup-الانبا-ابرام-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      pushToast("تم تنزيل النسخة الاحتياطية الكاملة بنجاح ✅");
    } catch (err) {
      pushToast("فشل إنشاء النسخة الاحتياطية: " + (err?.message || err), "error");
    } finally {
      setBackupBusy(false);
    }
  };

  useEffect(() => {
    const onHash = () => setSection(getSectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const effectiveSection =
    section === "users"
      ? isAdmin || canRead("users")
        ? "users"
        : (visibleNav[0]?.id ?? "members")
      : section === "import"
        ? isAdmin || canWrite("members")
          ? "import"
          : (visibleNav[0]?.id ?? "members")
        : canReadSection(section)
          ? section
          : (visibleNav[0]?.id ?? "members");

  const pushToast = (message, type = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  const runWrite = async (fn, successMsg) => {
    try {
      await fn();
      pushToast(successMsg);
    } catch (err) {
      pushToast("حدث خطأ: " + (err?.message || err), "error");
    }
  };

  const addProduct = (data) => runWrite(() => storeAddProduct(data), "تم إضافة المنتج");
  const updateProduct = (id, data) => runWrite(() => storeUpdateProduct(id, data), "تم تحديث المنتج");
  const deleteProduct = (id) => runWrite(() => storeDeleteProduct(id), "تم حذف المنتج");

  const handleUpdateStoreInfo = (data) => runWrite(() => storeUpdateInfo(data), "تم تحديث معلومات المتجر");
  const addCategory = (data) => runWrite(() => storeAddCategory(data), "تم إضافة الفئة");
  const updateCategory = (id, data) => runWrite(() => storeUpdateCategory(id, data), "تم تحديث الفئة");
  const deleteCategory = (id) => runWrite(() => storeDeleteCategory(id), "تم حذف الفئة");
  const addPriceRange = (data) => runWrite(() => storeAddPriceRange(data), "تم إضافة نطاق السعر");
  const updatePriceRange = (id, data) => runWrite(() => storeUpdatePriceRange(id, data), "تم تحديث نطاق السعر");
  const deletePriceRange = (id) => runWrite(() => storeDeletePriceRange(id), "تم حذف نطاق السعر");
  const addAvailability = (data) => runWrite(() => storeAddAvailability(data), "تم إضافة التوفر");
  const updateAvailability = (id, data) => runWrite(() => storeUpdateAvailability(id, data), "تم تحديث التوفر");
  const deleteAvailability = (id) => runWrite(() => storeDeleteAvailability(id), "تم حذف التوفر");

  const updateOrderStatus = (id, status) => runWrite(() => storeUpdateOrderStatus(id, status), "تم تحديث حالة الطلب");

  const addExam = (data) => runWrite(() => storeAddExam(data), "تم إضافة الامتحان");
  const updateExam = (id, data) => runWrite(() => storeUpdateExam(id, data), "تم تحديث الامتحان");
  const deleteExam = (id) => runWrite(() => storeDeleteExam(id), "تم حذف الامتحان");

  const approveExamResult = (resultId) =>
    runWrite(() => storeApproveExamResult(resultId), "تم الموافقة على نتيجة الامتحان");
  const allowExamRetake = (resultId) =>
    runWrite(() => storeAllowExamRetake(resultId), "تم السماح بإعادة الامتحان");

  const addNews = (data) => runWrite(() => storeAddNews(data), "تم إضافة الأخبار");
  const updateNews = (id, data) => runWrite(() => storeUpdateNews(id, data), "تم تحديث الأخبار");
  const deleteNews = (id) => runWrite(() => storeDeleteNews(id), "تم حذف الأخبار");
  const deleteNewsSubmission = (newsId, sentAt) => runWrite(() => storeDeleteNewsSubmission(newsId, sentAt), "تم حذف تقديم الأخبار");

  const addBook = (data) => runWrite(() => storeAddBook(data), "تم إضافة الكتاب");
  const updateBook = (id, data) => runWrite(() => storeUpdateBook(id, data), "تم تحديث الكتاب");
  const deleteBook = (id) => runWrite(() => storeDeleteBook(id), "تم حذف الكتاب");

  const addMember = async (data) => {
    const created = await storeAddMember(data);
    pushToast("تم إضافة العضو");
    return created;
  };
  const updateMember = async (id, data) => {
    const updated = await storeUpdateMember(id, data);
    pushToast("تم تحديث بيانات العضو");
    return updated;
  };
  const deleteMember = async (id) => {
    try {
      await storeDeleteMember(id);
      pushToast("تم حذف العضو");
    } catch (err) {
      pushToast("حدث خطأ أثناء حذف العضو: " + (err?.message || err), "error");
    }
  };

  const goTo = (id) => {
    if (id === "members") window.location.hash = "#/admin";
    else window.location.hash = `#/admin/${id}`;
    setSidebarOpen(false);
  };



  const sections = {
    members: (
      <MembersSection
        members={members}
        onAdd={addMember}
        onUpdate={updateMember}
        onDelete={deleteMember}
        readOnly={isReadOnly("members")}
      />
    ),

    attendance: <AttendanceSection readOnly={isReadOnly("attendance")} />,
    users: <UserManagement readOnly={isReadOnly("users")} />,
    import: <ImportMembers />,
    exams: (
      <ExamsSection
        exams={exams}
        onAdd={addExam}
        onUpdate={updateExam}
        onDelete={deleteExam}
        onApproveResult={approveExamResult}
        onAllowRetake={allowExamRetake}
        readOnly={isReadOnly("exams")}
      />
    ),
    store: (
      <StoreSection
        products={products}
        settings={storeSettings}
        onAdd={addProduct}
        onUpdate={updateProduct}
        onDelete={deleteProduct}
        onEditInfo={handleUpdateStoreInfo}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={deleteCategory}
        onAddRange={addPriceRange}
        onUpdateRange={updatePriceRange}
        onDeleteRange={deletePriceRange}
        onAddAvailability={addAvailability}
        onUpdateAvailability={updateAvailability}
        onDeleteAvailability={deleteAvailability}
        readOnly={isReadOnly("store")}
      />
    ),
    orders: <OrdersSection orders={orders} onUpdateStatus={updateOrderStatus} products={products} profiles={profiles} readOnly={isReadOnly("orders")} />,
    library: <LibrarySection books={books} onAdd={addBook} onUpdate={updateBook} onDelete={deleteBook} readOnly={isReadOnly("library")} />,
    news: <NewsSection news={news} onAdd={addNews} onUpdate={updateNews} onDelete={deleteNews} readOnly={isReadOnly("news")} />,
    badges: <BadgesSection />,
  };

  if (noAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-maroon-50/50 px-4 text-center font-sans text-earth-900">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-100 text-3xl">🔒</span>
        <h1 className="mt-4 text-2xl font-extrabold text-earth-900">
          عذراً، ليس لديك صلاحية الوصول إلى لوحة الإدارة
        </h1>
        <p className="mt-2 max-w-sm text-sm text-earth-600">
          لا يمكنك الوصول إلى هذه الصفحة لأن حسابك لا يمتلك الصلاحيات اللازمة. يرجى التواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ.
        </p>
        <button
          type="button"
          onClick={() => { logout(); window.location.hash = "#/home"; }}
          className="mt-6 cursor-pointer rounded-lg bg-maroon-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800"
        >
          العودة إلى الصفحة الرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-maroon-50/50 font-sans text-earth-900">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-maroon-950/40 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-maroon-100 bg-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b border-maroon-100 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-700 text-white">
            <CompassMarkIcon className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-maroon-900">الوحدة 102</p>
            <p className="truncate text-xs text-earth-500">المنطقة المركزية</p>
          </div>
          <button type="button" aria-label="إغلاق القائمة" onClick={() => setSidebarOpen(false)} className="mr-auto cursor-pointer rounded-lg p-1.5 text-earth-500 hover:bg-maroon-50 lg:hidden">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map(({ id, label, icon: NavIcon }) => (
            <button
              key={id}
              type="button"
              onClick={() => goTo(id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${section === id ? "bg-maroon-700 text-white shadow-sm" : "text-earth-800 hover:bg-maroon-50"
                }`}
            >
              <NavIcon className="h-4.5 w-4.5 shrink-0" />
              {label}
            </button>
          ))}

          <div className="my-3 border-t border-maroon-100"></div>

          {/* ✅ زر إدارة الحسابات - يوجه لـ #/admin/users */}
          {(isAdmin || canRead("users")) && (
            <button
              type="button"
              onClick={() => { window.location.hash = "#/admin/users"; setSidebarOpen(false); }}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${section === "users" ? "bg-blue-700 text-white shadow-sm" : "text-earth-800 hover:bg-blue-50 hover:text-blue-800"
                }`}
            >
              <UsersIcon className="h-4.5 w-4.5 shrink-0" />
              إدارة الحسابات والمستخدمين
            </button>
          )}

          {/* ✅ زر الاستيراد */}
          {(isAdmin || canWrite("members")) && (
            <button
              type="button"
              onClick={() => { window.location.hash = "#/admin/import"; setSidebarOpen(false); }}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${section === "import" ? "bg-green-700 text-white shadow-sm" : "text-earth-800 hover:bg-green-50 hover:text-green-800"
                }`}
            >
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              استيراد من Excel
            </button>
          )}
        </nav>

        <div className="space-y-1 border-t border-maroon-100 px-3 py-4">
          {/* ✅ نسخة احتياطية كاملة — للأدمن فقط */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleBackup}
              disabled={backupBusy}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-earth-800 transition hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4.5 w-4.5 text-earth-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              {backupBusy ? "جارِ تجهيز النسخة..." : "نسخة احتياطية (كل البيانات)"}
            </button>
          )}
          {/* ✅ زر عرض الموقع — يفتح الصفحة الرئيسية من غير تسجيل خروج */}
          <button
            type="button"
            onClick={() => { window.location.hash = "#/home"; setSidebarOpen(false); }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-earth-800 transition hover:bg-maroon-50 hover:text-maroon-800"
          >
            <svg className="h-4.5 w-4.5 text-earth-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            عرض الموقع
          </button>
          <button
            type="button"
            onClick={() => { logout(); window.location.hash = "#/home"; }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-earth-800 transition hover:bg-red-50 hover:text-red-700"
          >
            <LogoutIcon className="h-4.5 w-4.5 text-earth-500" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pr-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-maroon-100 bg-white/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-lg border border-earth-200 p-2 text-earth-600 hover:bg-earth-50 lg:hidden"
            aria-label="فتح القائمة"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="mr-auto flex items-center gap-2 text-xs text-earth-500">
            <span className="rounded bg-maroon-100 px-2 py-0.5 font-bold text-maroon-800">{currentUser?.role || "—"}</span>
            <span className="hidden sm:inline">صلاحيات: {isAdmin ? "كلها ✅" : `[${(currentUser?.permissions || []).join(', ')}]`}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {sections[effectiveSection] || sections.members}
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}