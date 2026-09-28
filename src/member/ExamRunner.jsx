import { useEffect, useRef, useState } from "react";
import { PinIcon } from "../admin/icons.jsx";
import { supabase } from "../lib/supabaseClient.js";

// مسار الامتحان — القفل بيرجّع الـ hash له فوراً لو اتغير لأي مسار تاني
const EXAM_HASH = "#/exams";

const STATUS_STYLES = {
  answered: "border-maroon-700 bg-maroon-700 text-white",
  flagged: "border-gold-500 bg-gold-500 text-white",
  current: "border-gold-400 bg-gold-100 text-earth-900 ring-2 ring-gold-400/50",
  unanswered:
    "border-earth-200 bg-white text-earth-700 hover:border-maroon-400 hover:bg-maroon-50/50",
};

const LEGEND = [
  { label: "تمت الإجابة", cls: "bg-maroon-700" },
  { label: "للمراجعة", cls: "bg-gold-500" },
  { label: "السؤال الحالي", cls: "border border-gold-400 bg-gold-100" },
  { label: "لم يتم الإجابة", cls: "border border-earth-300 bg-earth-100" },
];

function AnswerExplorer({ total, idx, answers, flagged, onJump, className = "" }) {
  return (
    <aside
      dir="rtl"
      className={`rounded-2xl border border-maroon-100 bg-white p-4 shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-maroon-900">مستكشف الإجابات</h3>
        <span dir="ltr" className="text-[11px] font-semibold text-earth-500">
          {Object.keys(answers).length} / {total}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {Array.from({ length: total }, (_, i) => {
          const status =
            i === idx
              ? "current"
              : flagged[i]
                ? "flagged"
                : answers[i] !== undefined
                  ? "answered"
                  : "unanswered";
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`السؤال ${i + 1}`}
              aria-current={i === idx ? "true" : undefined}
              className={`h-10 w-full cursor-pointer rounded-lg text-sm font-bold transition active:scale-95 ${STATUS_STYLES[status]}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2 border-t border-maroon-50 pt-3">
        {LEGEND.map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className={`h-3.5 w-3.5 shrink-0 rounded ${cls}`} />
            <span className="font-medium text-earth-600">{label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// =============================================================
// ExamRunner — بيرندر كـ fullscreen overlay (fixed inset-0 z-[100])
// فوق كل حاجة ومن غير MemberLayout — فمفيش قوايم تنقل ظاهرة خالص.
//
// القفل أثناء الامتحان:
//   1) hashchange → لو الـ hash اتغير لأي مسار بيرجّعه فوراً لـ #/exams
//      وينادي onNavAttempt (تحذير inline جوه الامتحان).
//   2) beforeunload → تحذير المتصفح قبل الخروج/التحديث.
//   3) الخروج الوحيد: زرار "إنهاء الاختبار" (سلم النتيجة) أو انتهاء
//      الوقت (auto-submit) — مفيش زرار مغادرة في النص.
//
// session/onSessionUpdate: الامتحان بيتخزن مكانه (الإجابات + السؤال
// الحالي + الـ deadline) عند الأب — لو الـ hash اترجع وحصل remount
// لحظي للصفحة، الامتحان بيكمل من نفس النقطة والمؤقت مش بيرجع من الأول.
// =============================================================
export default function ExamRunner({
  exam,
  examinee,
  session,
  locked = false,
  navWarning = false,
  onSessionUpdate,
  onNavAttempt,
  onExit,
  onRecord,
}) {
  const qs = exam.questionList ?? [];
  const [idx, setIdx] = useState(session?.idx ?? 0);
  const [answers, setAnswers] = useState(session?.answers ?? {});
  const [flagged, setFlagged] = useState(session?.flagged ?? {});
  // المؤقت بيتحسب من deadline ثابت في الجلسة (مش عدّاد تنازلي) —
  // أدق وأمانة أكتر: remount أو تأخير تبويب مبيزودش وقت الامتحان
  const deadlineRef = useRef(
    session?.deadline ?? Date.now() + (exam.duration ?? 30) * 60 * 1000
  );
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
  );


  // ✅ الخروج الوحيد: "إنهاء الاختبار" — بيفتح نافذة تأكيد التسليم عند الأب
  const submit = () => {
    if (locked || qs.length === 0) return;
    onRecord(answers, { auto: false });
  };

  // تسجيل الـ deadline في الجلسة أول ما يشتغل
  useEffect(() => {
    onSessionUpdate?.({ deadline: deadlineRef.current });
  }, [onSessionUpdate]);

  // مزامنة التقدم (الإجابات + السؤال الحالي) مع جلسة الأب
  useEffect(() => {
    onSessionUpdate?.({ idx, answers, flagged });
  }, [idx, answers, flagged, onSessionUpdate]);

  // ✅ قفل التنقل: لو الـ hash اتغير لأي مسار تاني → رجّعه فوراً
  // لمسار الامتحان + اعرض تحذير inline جوه الامتحان
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash !== EXAM_HASH) {
        window.location.hash = EXAM_HASH;
        onNavAttempt?.();
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [onNavAttempt]);

  // ✅ تحذير المتصفح قبل الخروج/التحديث أثناء الامتحان
  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = ""; // chrome يطلب returnValue عشان يعرض التحذير
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // المؤقت — قياس الفرق عن الـ deadline كل ثانية
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ✅ انتهاء الوقت → تسليم تلقائي (auto-submit)
  useEffect(() => {
    if (qs.length === 0 || locked) return;
    if (secondsLeft === 0) onRecord(answers, { auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, locked, qs.length]);

  if (qs.length === 0) {
    return (
      <div dir="rtl" className="fixed inset-0 z-[100] overflow-auto bg-earth-50">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-maroon-100 bg-white p-8 text-center shadow-xs">
            <p className="text-sm text-earth-500">
              هذا الامتحان لا يحتوي على أسئلة بعد.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-6 w-full cursor-pointer rounded-lg bg-maroon-700 px-4 py-3 text-sm font-bold text-white uppercase transition hover:bg-maroon-800"
            >
              رجوع للامتحانات
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = qs[idx];

  return (
    <div dir="rtl" className="fixed inset-0 z-[100] overflow-auto">
      {/* نفس خلفية الموقع (Hero + الطبقة العنابية) — نفس الثيم */}
      <div aria-hidden="true" className="fixed inset-0 z-0">
        <img
          src="/images/Hero.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-maroon-950/85 via-maroon-900/75 to-maroon-950/90" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* ===== شريط الهوية + المؤقت + زرار الإنهاء ===== */}
        <div className="rounded-2xl border border-maroon-100 bg-white/95 p-4 shadow-xs backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-maroon-900">
                {exam.title}
              </h2>
              <p className="mt-0.5 text-xs text-earth-600">
                الممتحن:{" "}
                <span className="font-bold text-earth-900">
                  {examinee?.name || "—"}
                </span>
                {examinee?.email && (
                  <span
                    dir="ltr"
                    className="font-semibold text-maroon-700"
                  >
                    {" "}
                    — {examinee.email}
                  </span>
                )}
                {examinee?.rank && (
                  <span className="text-earth-500"> — {examinee.rank}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                dir="ltr"
                className={`rounded-lg border px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
                  secondsLeft <= 60
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-earth-200 bg-earth-50 text-earth-700"
                }`}
              >
                {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
                {String(secondsLeft % 60).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={locked}
                className="cursor-pointer rounded-lg bg-maroon-700 px-4 py-2 text-xs font-bold text-white uppercase shadow-sm transition hover:bg-maroon-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                إنهاء الاختبار
              </button>
            </div>
          </div>

          {/* ✅ تحذير inline بعد محاولة الخروج من الامتحان */}
          {navWarning && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
              🚫 مينفعش تسيب الامتحان غير لما تخلصه وتسلّمه.
            </div>
          )}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[250px_1fr]">
          <AnswerExplorer
            total={qs.length}
            idx={idx}
            answers={answers}
            flagged={flagged}
            onJump={setIdx}
            className="lg:order-none"
          />

          <div className="rounded-2xl border border-maroon-100 bg-white p-6 shadow-xs sm:p-8 lg:order-none lg:col-start-2 lg:row-start-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-earth-700">
                السؤال {idx + 1} من {qs.length}
              </span>
              <span className="text-xs font-semibold text-earth-500">
                {Object.keys(answers).length} تمت إجابته
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-maroon-100">
              <div
                className="h-full rounded-full bg-maroon-700 transition-all"
                style={{ width: `${((idx + 1) / qs.length) * 100}%` }}
              />
            </div>

            <p className="mt-6 text-lg font-semibold leading-relaxed text-earth-900">
              {q.text}
            </p>

            <div className="mt-5 space-y-2.5">
              {q.choices.map((choice, ci) => {
                const selected = answers[idx] === ci;
                return (
                  <button
                    key={ci}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [idx]: ci }))}
                    className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                      selected
                        ? "border-maroon-600 bg-maroon-50 ring-1 ring-maroon-600"
                        : "border-earth-200 bg-white hover:border-maroon-300 hover:bg-maroon-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? "border-maroon-600" : "border-earth-300"
                      }`}
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-maroon-600" />
                      )}
                    </span>
                    <span className="font-medium text-earth-900">{choice}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setFlagged((f) => ({ ...f, [idx]: !f[idx] }))}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                  flagged[idx]
                    ? "border-gold-500 bg-gold-50 text-gold-800"
                    : "border-earth-200 text-earth-600 hover:bg-earth-50"
                }`}
              >
                <PinIcon className="h-3.5 w-3.5" />
                {flagged[idx] ? "معلمة للمراجعة — إلغاء" : "علّم السؤال للمراجعة"}
              </button>
            </div>

            <div className="mt-7 flex items-center justify-between">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => setIdx((i) => i - 1)}
                className="cursor-pointer rounded-lg border border-earth-200 px-5 py-2.5 text-sm font-semibold text-earth-700 transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                السابق
              </button>
              {idx < qs.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setIdx((i) => i + 1)}
                  className="cursor-pointer rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-800"
                >
                  السؤال التالي
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={locked}
                  className="cursor-pointer rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white uppercase transition hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  إنهاء الاختبار
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
