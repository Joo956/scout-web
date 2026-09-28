import { useEffect, useState } from "react";
import { XIcon } from "./icons.jsx";

export const inputCls =
  "w-full rounded-lg border border-earth-200 bg-white px-3.5 py-2.5 text-sm text-earth-900 shadow-xs placeholder:text-earth-400 transition hover:border-earth-300 focus:border-maroon-600 focus:outline-none focus:ring-2 focus:ring-maroon-600/25";

export function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold tracking-wider text-earth-800 uppercase">
        {label}
        {required && <span className="ml-0.5 text-maroon-600">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "sm:max-w-lg",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-maroon-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-maroon-100 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-maroon-900">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-earth-600">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="cursor-pointer rounded-lg p-1.5 text-earth-500 transition hover:bg-maroon-50 hover:text-maroon-700"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "حذف",
  onCancel,
  onConfirm,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="sm:max-w-md">
      <p className="text-sm leading-relaxed text-earth-700">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-lg border border-earth-200 px-4 py-2 text-sm font-semibold text-earth-700 transition hover:bg-earth-100"
        >
          إلغاء
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const badgeTones = {
  green: "border-forest-200 bg-forest-50 text-forest-800",
  gold: "border-gold-300 bg-gold-50 text-gold-800",
  maroon: "border-maroon-200 bg-maroon-50 text-maroon-800",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-earth-200 bg-earth-100 text-earth-700",
  earth: "border-earth-300 bg-earth-50 text-earth-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
};

export function Badge({ tone = "gray", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

// ملخص إنشاء حسابات الدخول للأعضاء — مع جدول الباسوردات المتولدة
// summary: { created, linked, failed: [{ email, reason }], noEmailCount, error, generatedPasswords: { email: password } }
// ملاحظة: الأعضاء من غير إيميل مش بيتعدوا فشل — بس سطر رمادي محايد في آخر الملخص
// ⚠️ الباسوردات بتتعرض مرة واحدة بس هنا — متخزنة مشفرة وميترجعش بعدها
export function MemberAccountsSummary({ summary }) {
  const [copiedEmail, setCopiedEmail] = useState(null);
  if (!summary) return null;

  const passwordRows = Object.entries(summary.generatedPasswords ?? {});

  const copyPwd = async (email, pwd) => {
    try {
      await navigator.clipboard.writeText(pwd);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 1500);
    } catch { /* المتصفح رفض النسخ */ }
  };

  // تنزيل الدليل كامل CSV — يفتح في Excel (UTF-8 مع BOM عشان العربي)
  const downloadCsv = () => {
    const rows = [["البريد الإلكتروني", "كلمة المرور"]];
    for (const [email, pwd] of passwordRows) rows.push([email, pwd]);
    const csv =
      "\uFEFF" +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `حسابات_الأعضاء_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-earth-50 border border-earth-200 rounded-lg px-4 py-3">
      <h4 className="font-bold text-maroon-800 mb-1.5">
        🔑 حسابات الدخول — باسورد فريد اتولد لكل إيميل
      </h4>
      {summary.error ? (
        <p className="text-sm text-red-700">
          فشل إنشاء الحسابات: {summary.error}
        </p>
      ) : (
        <>
          <p className="text-sm text-earth-800">
            اتعمل <strong>{summary.created ?? 0}</strong> حساب دخول بباسورد فريد
            • <strong>{summary.linked ?? 0}</strong> اربطوا
            بحسابات موجودة
            {(summary.failed?.length ?? 0) > 0 && (
              <>
                {" "}• اتخطوا <strong>{summary.failed.length}</strong>
              </>
            )}
          </p>

          {/* جدول الباسوردات — بتتعرض مرة واحدة بس */}
          {passwordRows.length > 0 && (
            <div className="mt-3 rounded-lg border border-gold-200 bg-gold-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-gold-800">
                  ⚠️ كلمات المرور بتتعرض مرة واحدة بس — انسخها أو نزّلها دلوقتي
                </p>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="cursor-pointer rounded-lg bg-green-700 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-green-800"
                >
                  ⬇️ تنزيل Excel (CSV)
                </button>
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs" dir="rtl">
                  <thead>
                    <tr className="border-b border-gold-200 text-gold-800">
                      <th className="pb-1.5 text-right font-bold">الإيميل</th>
                      <th className="pb-1.5 text-right font-bold">كلمة المرور</th>
                      <th className="pb-1.5 w-16 text-center font-bold">نسخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passwordRows.map(([email, pwd]) => (
                      <tr key={email} className="border-b border-gold-100 last:border-0">
                        <td className="py-1.5 font-semibold text-earth-900" dir="ltr">{email}</td>
                        <td className="py-1.5">
                          <span className="rounded bg-white border border-earth-200 px-2 py-0.5 font-mono font-extrabold text-maroon-800" dir="ltr">
                            {pwd}
                          </span>
                        </td>
                        <td className="py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => copyPwd(email, pwd)}
                            className="cursor-pointer rounded border border-earth-200 bg-white px-2 py-0.5 text-[10px] font-bold text-earth-700 transition hover:bg-earth-100"
                          >
                            {copiedEmail === email ? "✓ تم" : "نسخ"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* حالة الإرسال التلقائي على الإيميلات */}
          {summary.emailResults && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
              {summary.emailResults.loading ? (
                <p className="text-xs font-bold text-blue-800">
                  📧 جاري إرسال بيانات الدخول على إيميلات الأعضاء...
                </p>
              ) : summary.emailResults.error ? (
                <p className="text-xs font-bold text-red-700">
                  ⚠️ الإرسال التلقائي فشل: {summary.emailResults.error} —
                  الباسوردات لسه ظاهرة فوق، انسخها وابعتها يدوي.
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-blue-800">
                    📧 اتبعتت على الإيميل: <strong>{summary.emailResults.sent ?? 0}</strong>
                    {" "}• فشل: <strong>{summary.emailResults.failed ?? 0}</strong>
                  </p>
                  {(summary.emailResults.results ?? [])
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <p key={r.email} className="mt-1 text-[11px] font-semibold text-red-700" dir="auto">
                        • {r.email}: {r.error}
                      </p>
                    ))}
                </>
              )}
            </div>
          )}

          {(summary.failed?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1 border-t border-earth-200 pt-2">
              {summary.failed.map((f, i) => (
                <li key={i} className="text-sm text-red-700">
                  • {f.email || "(بدون إيميل)"}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          {(summary.noEmailCount ?? 0) > 0 && (
            <p className="text-sm text-earth-500 mt-2">
              {summary.noEmailCount} عضو لسه من غير إيميل — الحساب هيتعمل
              تلقائي أول ما تضيف الإيميل
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed left-5 bottom-5 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${t.type === "error" ? "bg-red-600" : "bg-maroon-800"
            }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-xl border border-maroon-100 bg-white shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

export const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("ar-EG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const fmtMoney = (n) => `${n.toFixed(2)} ج.م`;

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
