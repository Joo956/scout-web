import { useState, useEffect } from "react";
import { useStore } from "../store.jsx";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30_000; // 30 seconds

// أسماء ملفات الصور الموجودة في public/images مباشرة
const IMAGE_NAMES = [
"https://i.postimg.cc/zGC8yTTt/2.jpg","https://i.postimg.cc/Z0kzRqnT/4.jpg","https://i.postimg.cc/wBxMHwnZ/5.jpg","https://i.postimg.cc/X7wY5Mbt/8.jpg"
  ];

export default function LoginForm() {
  const { login } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // C8: Client-side rate limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // حالة الصورة الحالية في السلايدر
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  // التبديل التلقائي للصور كل 3.5 ثواني
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % IMAGE_NAMES.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  // Countdown timer during lockout
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutSeconds(remaining);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil && Date.now() < lockoutUntil;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isLockedOut) return;

    if (!email.trim() || !password) {
      setError("⚠️ أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      setFailedAttempts(0);
      setLockoutUntil(null);
      try {
        const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
        const redirect = params.get("redirect");
        if (redirect) {
          window.location.hash = redirect;
          return;
        }
      } catch { /* ignore */ }
      window.location.hash =
        user.role === "admin" || user.role === "subadmin" ? "#/admin" : "#/profile";
    } catch (err) {
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      if (next >= MAX_FAILED_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        setError(`🔒 كترت المحاولات الفاشلة — انتظر ${LOCKOUT_DURATION_MS / 1000} ثانية قبل ما تحاول تاني`);
      } else {
        setError(`❌ ${err.message} (${MAX_FAILED_ATTEMPTS - next} محاولات متاحة)`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4 sm:p-6 bg-gray-950">
      
      {/* 1️⃣ خلفية سلايدر الصور ملء الشاشة */}
      <div className="absolute inset-0 z-0">
        {IMAGE_NAMES.map((fileName, index) => (
          <img
            key={fileName}
            src={fileName}
            alt="صور الكشافة"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === currentImgIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            style={{ transitionProperty: "opacity, transform" }}
          />
        ))}

        {/* طبقة إعتام خفيفة جداً لفتح وتوضيح الصور */}
        <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" />
      </div>

      {/* 2️⃣ البوكس الشفاف المطفي اللي بيبيّن الصور من وراه */}
      <div className="relative z-10 w-full max-w-md bg-white/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/30 animate-slide-up">
        
        <div className="text-center space-y-2 mb-6">
          <img
            src="/images/Logo_Scout-removebg.png"
            alt="شعار كشافة"
            className="mx-auto h-28 w-28 object-contain drop-shadow-md transition-transform hover:scale-105 duration-300"
          />
          <h2 className="text-2xl font-extrabold text-maroon-950 drop-shadow-sm">تسجيل الدخول</h2>
          <p className="text-sm font-medium text-gray-900 drop-shadow-sm">سجّل دخولك بالبريد الإلكتروني وكلمة المرور</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">📧 البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLockedOut}
              className="block w-full rounded-xl border border-white/50 px-3.5 py-2.5 bg-white/75 text-gray-900 placeholder-gray-600 shadow-sm focus:border-maroon-700 focus:ring-2 focus:ring-maroon-700 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">🔑 كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLockedOut}
              className="block w-full rounded-xl border border-white/50 px-3.5 py-2.5 bg-white/75 text-gray-900 placeholder-gray-600 shadow-sm focus:border-maroon-700 focus:ring-2 focus:ring-maroon-700 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/80 backdrop-blur-sm p-3 text-sm text-white text-center font-medium shadow-md">
              {error}
            </div>
          )}

          {isLockedOut && lockoutSeconds > 0 && (
            <div className="rounded-xl bg-yellow-500/80 backdrop-blur-sm p-3 text-sm text-white text-center font-medium shadow-md">
              ⏳ انتظر {lockoutSeconds} ثانية قبل المحاولة مرة أخرى
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || isLockedOut}
            className="w-full rounded-xl bg-maroon-800 px-4 py-3 text-sm font-bold text-white shadow-lg transition duration-200 hover:bg-maroon-900 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "جارِ الدخول..." : isLockedOut ? `🔒 انتظر ${lockoutSeconds}ث` : "دخول"}
          </button>
        </form>
      </div>

    </div>
  );
}