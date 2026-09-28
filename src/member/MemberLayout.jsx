import { useState } from "react";
import { useStore } from "../store.jsx";
import { CartIcon } from "../admin/icons.jsx";

const NAV = [
  { id: "home", label: "الرئيسية", href: "#/home" },
  { id: "store", label: "المتجر", href: "#/store" },
  { id: "exams", label: "الامتحانات", href: "#/exams" },
  { id: "badges", label: "شاراتي", href: "#/badges" },
  { id: "news", label: "الأخبار", href: "#/news" },
  { id: "library", label: "المكتبة", href: "#/library" },
];

// إشعار الزائر — message اختياري
export function GuestNotice({ message }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm font-medium text-gold-900">
      <span>{message ?? "👀 أنت في وضع المعاينة فقط — سجّل الدخول لتتمكن من المشاركة."}</span>
      <a href="#/login" className="rounded-lg bg-maroon-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-maroon-800">
        تسجيل الدخول
      </a>
    </div>
  );
}

export default function MemberLayout({ active, children }) {
  const { currentUser, profile, logout, cart } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false); // حالة فتح قائمة الموبايل

  const cartCount = (cart ?? []).reduce((s, c) => s + (c.qty || 0), 0);
  const isAdminOrSubadmin = currentUser?.role === "admin" || currentUser?.role === "subadmin";

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileNavOpen(false);
    logout();
    window.location.hash = "#/home";
  };

  const navLinks = (onClickExtra) =>
    NAV.map((l) => (
      <a
        key={l.id}
        href={l.href}
        onClick={() => {
          if (onClickExtra) onClickExtra();
        }}
        className={`whitespace-nowrap text-sm transition ${
          active === l.id
            ? "font-bold text-maroon-800 underline decoration-maroon-700 decoration-2 underline-offset-8"
            : "font-medium text-earth-600 hover:text-maroon-700"
        }`}
      >
        {l.label}
      </a>
    ));

  return (
    <div className="relative flex min-h-screen flex-col font-sans">
      {/* ============ الخلفية الثابتة ============ */}
      <div aria-hidden="true" className="fixed inset-0 z-0">
        <img
          src="/images/Hero.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-maroon-950/85 via-maroon-900/75 to-maroon-950/90" />
      </div>

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 border-b border-maroon-100 bg-white/95 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          
          {/* الشعار واسم الكشافة */}
          <a href="#/home" className="flex items-center gap-2">
            <img src="/images/Logo_Scout-removebg.png" alt="شعار الكشافة" className="h-9 w-9 object-contain" />
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-maroon-800">
              مجموعة الأنبا إبرام الكشفية
            </span>
          </a>

          {/* روابط التصفح للشاشات الكبيرة (Desktop) */}
          <nav className="hidden items-center gap-7 lg:flex">{navLinks()}</nav>

          {/* الجانب الأيسر: زر السلة والحساب وقائمة الموبايل */}
          <div className="flex items-center gap-2">
            {isAdminOrSubadmin && (
              <a
                href="#/admin"
                className="hidden items-center gap-1.5 whitespace-nowrap rounded-lg border border-earth-200 px-3 py-1.5 text-sm font-semibold text-maroon-800 transition hover:border-maroon-300 hover:bg-maroon-50 sm:inline-flex"
              >
                <span aria-hidden="true">⚙️</span>
                لوحة التحكم
              </a>
            )}

            {/* السلة */}
            <a
              href="#/cart"
              aria-label={`السلة — ${cartCount}`}
              className={`relative rounded-full p-2 transition ${
                active === "cart" ? "bg-maroon-100 text-maroon-900" : "text-maroon-800 hover:bg-maroon-50"
              }`}
            >
              <CartIcon className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-maroon-700 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </a>

            {/* زر الحساب أو تسجيل الدخول */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-earth-200 px-2.5 py-1.5 transition hover:border-maroon-300 hover:bg-maroon-50"
                >
                  <span className="text-xs sm:text-sm font-semibold text-earth-800">
                    {currentUser.name || profile?.name || "مستخدم"}
                  </span>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div role="menu" className="absolute left-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-earth-200 bg-white shadow-xl">
                      <div className="flex items-center gap-3 border-b border-earth-100 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-earth-900">{currentUser.name || "مستخدم"}</p>
                          <p className="truncate text-xs text-earth-500">{currentUser.email || ""}</p>
                        </div>
                      </div>
                      <a href="#/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-earth-800 transition hover:bg-maroon-50 hover:text-maroon-800">
                        الملف الشخصي
                      </a>
                      <button type="button" onClick={handleLogout} className="block w-full cursor-pointer px-4 py-2.5 text-right text-sm font-semibold text-red-600 transition hover:bg-red-50">
                        تسجيل الخروج
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a href="#/login" className="rounded-lg bg-maroon-700 px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-maroon-800">
                تسجيل الدخول
              </a>
            )}

            {/* زر الهامبرغر للموبايل (☰) */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="p-2 text-maroon-800 hover:bg-maroon-50 rounded-lg lg:hidden"
              aria-label="فتح القائمة"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* القائمة المنسدلة للشاشات الصغيرة عند ضغط الزر */}
        {mobileNavOpen && (
          <nav className="flex flex-col gap-3 border-t border-maroon-100 bg-white px-4 py-4 lg:hidden text-right shadow-lg">
            {navLinks(() => setMobileNavOpen(false))}
            {isAdminOrSubadmin && (
              <a
                href="#/admin"
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 block rounded-lg bg-maroon-50 px-3 py-2 text-sm font-bold text-maroon-800"
              >
                ⚙️ لوحة التحكم
              </a>
            )}
          </nav>
        )}
      </header>

      {/* ============ المحتوى الرئيسي ============ */}
      <main className="relative z-10 flex-1 bg-earth-50/90 backdrop-blur-sm">
        {children}
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-earth-200 bg-white/95 backdrop-blur dir-rtl py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            
            {/* الهوية واللوجو */}
            <div className="flex items-center gap-3">
              <img
                src="/images/Logo_Scout-removebg.png"
                alt="شعار الكشافة"
                className="h-10 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
              />
              <div className="text-right">
                <span className="block font-bold text-earth-900 text-sm sm:text-base leading-tight">
                  مجموعة الأنبا إبرام الكشفية
                </span>
                <span className="text-[11px] text-earth-500 font-medium">
                  المنصة الرسمية
                </span>
              </div>
            </div>

            {/* روابط التواصل */}
            <div className="flex items-center gap-2.5">
              <a href="https://www.facebook.com/share/1KR9wsUFhf/?mibextid=wwXIfr" className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-100/80 text-earth-700 transition-all duration-200 hover:bg-maroon-700 hover:text-white shadow-sm" aria-label="Facebook">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/ava_ebram_scout?stkn=aGZocGNoejFxemtm" className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-100/80 text-earth-700 transition-all duration-200 hover:bg-maroon-700 hover:text-white shadow-sm" aria-label="Instagram">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="https://www.tiktok.com/@avaebramscout?is_from_webapp=1&sender_device=pc" className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-100/80 text-earth-700 transition-all duration-200 hover:bg-maroon-700 hover:text-white shadow-sm" aria-label="TikTok">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.28-2.85 1.18-5.74 3.64-7.14 1.54-.88 3.38-1.17 5.12-.85v4.16c-.84-.19-1.74-.08-2.5.31-.91.45-1.57 1.35-1.72 2.35-.23 1.26.31 2.56 1.35 3.27.97.67 2.27.76 3.32.22 1.01-.5 1.63-1.57 1.67-2.7.04-3.83.02-7.66.02-11.49-.01-1.34 0-2.68-.01-4.02z" />
                </svg>
              </a>
              <a href="https://www.youtube.com/channel/UCgXIcjERYDJTsGu4TvuiX1Q?si=gSmxZVVfy-naLzTE" className="flex h-9 w-9 items-center justify-center rounded-full bg-earth-100/80 text-earth-700 transition-all duration-200 hover:bg-maroon-700 hover:text-white shadow-sm" aria-label="Youtube">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}