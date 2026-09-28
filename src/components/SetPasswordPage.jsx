import { useState } from "react";
import { useStore } from "../store.jsx";

export default function SetPasswordPage() {
  const { currentUser, setOwnPassword, logout } = useStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("⚠️ كلمة المرور وتأكيدها غير متطابقتين");
      return;
    }

    setBusy(true);
    try {
      await setOwnPassword(password);
      setSuccess(true);
      setTimeout(() => {
        window.location.hash = "#/profile";
      }, 1500);
    } catch (err) {
      setError(`❌ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.hash = "#/login";
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 text-center font-sans">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-3xl">✅</span>
        <h1 className="mt-4 text-2xl font-extrabold text-earth-900">تم تعيين كلمة المرور بنجاح!</h1>
        <p className="mt-2 text-sm text-earth-600">جارِ تحويلك للملف الشخصي...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 px-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-100 text-3xl mx-auto">🔑</span>
          <h1 className="mt-4 text-2xl font-extrabold text-maroon-900">أهلاً بك!</h1>
          <p className="mt-2 text-sm text-earth-600">
            أول مرة تسجل دخول — لازم تعمل كلمة مرور جديدة خاصة بيك
          </p>
        </div>

        <div className="bg-white rounded-xl border border-earth-200 p-6 shadow-sm">
          {currentUser && (
            <div className="mb-6 p-3 bg-maroon-50 rounded-lg border border-maroon-100">
              <p className="text-sm text-maroon-700">
                <span className="font-bold">الاسم:</span> {currentUser.name}
              </p>
              <p className="text-sm text-maroon-700">
                <span className="font-bold">البريد:</span> {currentUser.email}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-earth-700 mb-1">🔑 كلمة المرور الجديدة</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2.5 shadow-sm focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 outline-none"
                placeholder="6 أحرف على الأقل"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-earth-700 mb-1">🔑 تأكيد كلمة المرور</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="block w-full rounded-lg border border-earth-300 px-3 py-2.5 shadow-sm focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 outline-none"
                placeholder="أعد كتابة كلمة المرور"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "جارِ الحفظ..." : "تعيين كلمة المرور"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-earth-500 hover:text-red-600 transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}
