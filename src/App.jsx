import { Component, lazy, Suspense, useEffect, useState } from "react";
import LoginForm from "./components/LoginForm.jsx";
import SetPasswordPage from "./components/SetPasswordPage.jsx";
// لوحة الأدمن وسكان QR بيتحمّلوا عند الطلب بس — الأعضاء مش بينزّلوها
const AdminDashboard = lazy(() => import("./admin/AdminDashboard.jsx"));
const ScanPage = lazy(() => import("./admin/ScanPage.jsx"));
import HomePage from "./home/HomePage.jsx";
import ExamsPage from "./member/ExamsPage.jsx";
import BadgesPage from "./member/BadgesPage.jsx";
import NewsPage from "./member/NewsPage.jsx";
import StorePage from "./member/StorePage.jsx";
import CartPage from "./member/CartPage.jsx";
import LibraryPage from "./member/LibraryPage.jsx";
import ProfilePage from "./member/ProfilePage.jsx";
import { StoreProvider, useStore } from "./store.jsx";
import { isSupabaseConfigured } from "./lib/supabaseClient.js";

import ImportMembers from './admin/ImportMembers.jsx';
import UserManagement from './admin/UserManagement.jsx';
import MemberLayout from "./member/MemberLayout.jsx";

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

// 🎬 دالة التحميل المعدلة بأنيميشن اللوجو المتفكك والمجمع
function AdminFallback({ children, text = "جارِ التحميل..." }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
          <div className="flex flex-col items-center justify-center space-y-6">
            
            {/* حاوية تجمع الأجزاء المتفككة واللوجو الرئيسي */}
            <div className="relative h-28 w-28 flex items-center justify-center">
              {/* ↖️ أعلى أيسر */}
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="جزء 1"
                className="absolute h-24 w-24 object-contain animate-split-tl drop-shadow-md"
              />

              {/* ↗️ أعلى أيمن */}
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="جزء 2"
                className="absolute h-24 w-24 object-contain animate-split-tr drop-shadow-md"
              />

              {/* ↙️ أسفل أيسر */}
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="جزء 3"
                className="absolute h-24 w-24 object-contain animate-split-bl drop-shadow-md"
              />

              {/* ↘️ أسفل أيمن */}
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="جزء 4"
                className="absolute h-24 w-24 object-contain animate-split-br drop-shadow-md"
              />

              {/* 🌟 اللوجو الأساسي في المنتصف */}
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="اللوجو الرئيسي"
                className="relative z-10 h-24 w-24 object-contain animate-core-pulse drop-shadow-2xl"
              />
            </div>

            {/* النص أسفل اللوجو */}
            <p className="text-lg font-bold text-maroon-900 animate-pulse tracking-wide">
              {text}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function InfoPlaceholder({ title }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-100 text-3xl">📄</span>
      <h1 className="mt-4 text-2xl font-extrabold text-earth-900">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-earth-600">هذه الصفحة قيد الإعداد — المحتوى قريباً.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href="#/home" className="rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800">العودة للرئيسية</a>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
      <span className="text-6xl">🧭</span>
      <h1 className="mt-4 text-3xl font-extrabold text-earth-900">404 — الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm text-earth-600">الرابط اللي حاولت الوصول ليه مش موجود أو تم نقله.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href="#/home" className="rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800">العودة للرئيسية</a>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("خطأ غير متوقع:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">⚠️</span>
          <h1 className="mt-4 text-2xl font-extrabold text-earth-900">حدث خطأ غير متوقع</h1>
          <p className="mt-2 max-w-sm text-sm text-earth-600">حاول إعادة تحميل الصفحة أو العودة للرئيسية.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800">إعادة التحميل</button>
            <a href="#/home" className="rounded-lg border border-earth-300 px-6 py-2.5 text-sm font-bold text-earth-800 transition hover:bg-earth-100">العودة للرئيسية</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotAuthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-100 text-3xl">🔒</span>
      <h1 className="mt-4 text-2xl font-extrabold text-earth-900">الصفحة دي للأدمن أو المدير فقط</h1>
      <p className="mt-2 max-w-sm text-sm text-earth-600">لو حسابك مدير، سجّل دخول بالحساب المسؤول — أو ارجع للصفحة الرئيسية.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href="#/login" className="rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800">تسجيل الدخول</a>
        <a href="#/home" className="rounded-lg border border-earth-300 px-6 py-2.5 text-sm font-bold text-earth-800 transition hover:bg-earth-100">الرئيسية</a>
      </div>
    </div>
  );
}

function LoginRequired() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-100 text-3xl">🔐</span>
      <h1 className="mt-4 text-2xl font-extrabold text-earth-900">سجّل دخولك أولاً</h1>
      <p className="mt-2 max-w-sm text-sm text-earth-600">هذه الصفحة تتطلب تسجيل دخول للوصول إلى بياناتك.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href="#/" className="rounded-lg bg-forest-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-forest-800">تسجيل الدخول</a>
        <a href="#/home" className="rounded-lg border border-earth-300 px-6 py-2.5 text-sm font-bold text-earth-800 transition hover:bg-earth-100">العودة للرئيسية</a>
      </div>
    </div>
  );
}

function SupabaseNotConfigured() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-100 text-3xl">🗄️</span>
      <h1 className="mt-4 text-2xl font-extrabold text-earth-900">Supabase غير مُفعّل — راجع .env.local</h1>
      <p className="mt-2 max-w-sm text-sm text-earth-600">
        التطبيق محتاج إعدادات مشروع Supabase (الرابط ومفتاح الوصول) عشان يشتغل.
        ضيف المتغيرات دي في ملف <code dir="ltr" className="font-mono">.env.local</code> وجرب تاني.
      </p>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <SupabaseNotConfigured />;
  }
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Router />
      </StoreProvider>
    </ErrorBoundary>
  );
}

function Router() {
  const hash = useHashRoute();
  const { currentUser, loading } = useStore();

  // ✅ عنوان الصفحة حسب القسم — للتبويب ومشاركة الروابط ومحركات البحث
  useEffect(() => {
    const routeTitles = {
      "#/home": "الرئيسية",
      "#/news": "الأخبار",
      "#/exams": "الامتحانات",
      "#/store": "المتجر",
      "#/library": "المكتبة",
      "#/badges": "الشارات",
      "#/profile": "الملف الشخصي",
      "#/cart": "السلة",
      "#/login": "تسجيل الدخول",
      "#/admin": "لوحة الإدارة",
    };
    const section =
      Object.entries(routeTitles).find(([path]) => hash.startsWith(path))?.[1] ??
      "الرئيسية";
    document.title = `${section} | مجموعة الأنبا إبرام الكشفية`;
  }, [hash]);

  const isAdminOrManager =
    currentUser?.role === "admin" || currentUser?.role === "subadmin";
  const protectedRoutes = ["#/profile", "#/cart"];
  const isProtected = protectedRoutes.some(route => hash.startsWith(route));

  // ✅ التوجيهات الداخلية تتم في useEffect بدلاً من جسم الـ render
  useEffect(() => {
    if (hash.startsWith("#/login") && currentUser) {
      window.location.hash = isAdminOrManager ? "#/admin" : "#/home";
    } else if (hash === "" || hash === "#") {
      window.location.hash = "#/home";
    }
  }, [hash, currentUser, isAdminOrManager]);

  // ✅ شاشة تحميل أثناء جلب البيانات الأولية
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative h-28 w-28 flex items-center justify-center">
            <img src="/images/Logo_Scout-removebg.png" alt="جزء 1" className="absolute h-24 w-24 object-contain animate-split-tl drop-shadow-md" />
            <img src="/images/Logo_Scout-removebg.png" alt="جزء 2" className="absolute h-24 w-24 object-contain animate-split-tr drop-shadow-md" />
            <img src="/images/Logo_Scout-removebg.png" alt="جزء 3" className="absolute h-24 w-24 object-contain animate-split-bl drop-shadow-md" />
            <img src="/images/Logo_Scout-removebg.png" alt="جزء 4" className="absolute h-24 w-24 object-contain animate-split-br drop-shadow-md" />
            <img src="/images/Logo_Scout-removebg.png" alt="اللوجو الرئيسي" className="relative z-10 h-24 w-24 object-contain animate-core-pulse drop-shadow-2xl" />
          </div>
          <p className="text-lg font-bold text-maroon-900 animate-pulse tracking-wide">جارِ التحميل...</p>
        </div>
      </div>
    );
  }

  // ✅ تعيين كلمة المرور أول مرة
  if (currentUser && currentUser.passwordSet === false) {
    return <SetPasswordPage />;
  }

  let page;

  // ✅ 1. صفحة تسجيل الدخول
  if (hash.startsWith("#/login")) {
    if (currentUser) return null;
    page = <LoginPage />;
  }
  // ✅ 2. رابط فاضي → الرئيسية
  else if (hash === "" || hash === "#") {
    return null;
  }
  // ✅ 3. صفحة سكان الحضور من QR
  else if (hash.startsWith("#/scan")) {
    page = <AdminFallback text="جارِ تحميل شاشة المسح..."><ScanPage /></AdminFallback>;
  }
  // ✅ 4. لوحة التحكم
  else if (hash.startsWith("#/admin")) {
    if (isAdminOrManager) {
      page = (
        <AdminFallback text="جارِ تحميل لوحة الإدارة...">
          <AdminDashboard />
        </AdminFallback>
      );
    } else {
      page = <NotAuthorized />;
    }
  }
  // ✅ 5. الصفحات المحمية (محتاجة تسجيل دخول)
  else if (isProtected && !currentUser) {
    page = <LoginRequired />;
  }
  // ✅ 6. صفحات الأعضاء
  else if (hash.startsWith("#/exams")) page = <ExamsPage />;
  else if (hash.startsWith("#/badges")) page = <BadgesPage />;
  else if (hash.startsWith("#/news")) page = <NewsPage />;
  else if (hash.startsWith("#/store")) page = <StorePage />;
  else if (hash.startsWith("#/cart")) page = <CartPage />;
  else if (hash.startsWith("#/library")) page = <LibraryPage />;
  else if (hash.startsWith("#/profile")) page = <MemberLayout active="profile"><ProfilePage /></MemberLayout>;
  else if (hash.startsWith("#/home")) page = <MemberLayout active="home"><HomePage /></MemberLayout>;
  else page = <NotFound />;

  return page;
}
// قائمة أسماء الصور بعد تحويلها إلى روابط مباشرة (Direct Image URLs)
const LOGIN_SLIDER_IMAGES = [
  "https://i.postimg.cc/zGC8yTTt/2.jpg",
  "https://i.postimg.cc/Z0kzRqnT/4.jpg",
  "https://i.postimg.cc/wBxMHwnZ/5.jpg",
  "https://i.postimg.cc/X7wY5Mbt/8.jpg"
];

function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-earth-50 font-sans">
      <LoginForm />
    </div>
  );
}