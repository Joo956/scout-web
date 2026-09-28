import { useCallback, useMemo, useState } from "react";
import MemberLayout, { GuestNotice } from "./MemberLayout.jsx";
import ExamRunner from "./ExamRunner.jsx";
import { useStore } from "../store.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { Badge } from "../admin/ui.jsx";
import { stageMatches, stageForMember } from "../utils/stages.js";
import {
  ListIcon,
  ClockIcon,
  CheckIcon,
} from "../admin/icons.jsx";

// =============================================================
// جلسة الامتحان الجارية (متغير على مستوى الموديول — مش state):
// قفل الامتحان بيرجّع الـ hash فوراً لمسار #/exams، بس ممكن الراوتر
// يرندر المسار التاني لحظة (browser back) ويعمل unmount للصفحة.
// الجلسة هنا بتخلي الامتحان يرجع زي ما كان بعد الـ remount —
// الإجابات والسؤال الحالي والمؤقت مش بيضيعوا.
// بتتمسح لما الامتحان يتسلم بنجاح أو يخرج فعلاً.
// =============================================================
let examSession = null;

// ✅ نافذة تأكيد التسليم — من غير أي درجة (الدرجة مخفية لحد الاعتماد)
function ConfirmSubmitModal({ exam, auto, error, busy, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border-2 border-maroon-200 animate-in fade-in zoom-in-95">
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-3xl">
            ⚠️
          </span>
          <h3 className="mt-4 text-lg font-extrabold text-earth-900">
            {auto ? "انتهى وقت الامتحان" : "تأكيد تسليم الامتحان"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-earth-600">
            {auto ? (
              <>
                خلص الوقت المخصص لامتحان
                <span className="mt-1 block font-bold text-maroon-700">
                  {exam.title}
                </span>
              </>
            ) : (
              <>
                هل أنت متأكد من تسليم امتحان:
                <span className="mt-1 block font-bold text-maroon-700">
                  {exam.title}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3 text-sm font-bold text-gold-900">
          📤 النتيجة هتروح لمراجعة قائد الامتحانات — الدرجة هتظهرلك بعد اعتمادها.
        </div>
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          ⚠️ بعد التسليم مش هتقدر تعدل إجاباتك، ومفيش إعادة للامتحان غير لو
          القائد سمح بذلك.
        </div>

        {/* ✅ خطأ الحفظ (لو حصل) — النافذة بتفضل مفتوحة للمحاولة تاني */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {!auto && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 cursor-pointer rounded-lg border-2 border-earth-200 px-4 py-2.5 text-sm font-bold text-earth-700 transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              رجوع للامتحان
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 cursor-pointer rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800 shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "جاري التسليم..." : "✅ تسليم النتيجة"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExamsPage() {
  const {
    exams,
    examResults,
    submitExamResult,
    profile,
    currentUser,
    members,
  } = useStore();

  // Strip 'correct' from questions (defense-in-depth: server-side scoring is authoritative)
  const safeExams = useMemo(() =>
    exams.map(exam => ({
      ...exam,
      questionList: (exam.questionList || []).map(q => {
        const { correct, ...rest } = q;
        return rest;
      })
    })), [exams]);

  const [activeExam, setActiveExam] = useState(examSession?.exam ?? null);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [navWarning, setNavWarning] = useState(examSession?.navWarned ?? false);
  const [justSubmitted, setJustSubmitted] = useState(null);

  // ✅ هوية الممتحن تلقائياً من حساب الدخول (مفيش إدخال يدوي خالص):
  // الاسم = العضو المرتبط بالحساب، واحتياطي اسم البروفايل
  // الرتبة = المرحلة الكشفية بتاعة العضو
  // الإيميل = إيميل الدخول نفسه
  const myMember = currentUser
    ? members.find((m) => m.userId === currentUser.id)
    : null;
  const identity = currentUser
    ? {
        name:
          myMember?.name || profile?.name || currentUser.name || "كشاف",
        email: currentUser.email || "",
        rank: myMember?.scoutStage || "",
      }
    : null;

  // ✅ فلتر دفاعي: الأعضاء يشوفوا الامتحانات المعتمدة (Active) بس —
  // والمسودات متفلتره أصلاً على السيرفر (سياسة exams_read في الـ RLS)
  // ✅ والمرحلة: الامتحان بيظهر لمرحلته هو بس (مذكر/مؤنث معاً) —
  // والامتحانات القديمة من غير مرحلة بتظهر للجميع
  const available = safeExams.filter(
    (e) =>
      e.status === "Active" &&
      stageMatches(e.scoutStage, myMember?.scoutStage)
  );

  // نتيجتي أنا على الامتحان ده — بالـ user_id بتاع الجلسة
  // (السيرفر أصلاً بيرجّع للأعضاء نتايجهم هم بس عن طريق الـ RLS)
  const myResult = (examId) =>
    currentUser
      ? examResults.find(
          (r) => r.examId === examId && r.userId === currentUser.id
        )
      : null;

  // مزامنة جلسة الامتحان (بتستخدم مع remount لحظي وقت القفل)
  const handleSessionUpdate = useCallback((patch) => {
    if (examSession) Object.assign(examSession, patch);
  }, []);

  // محاولة خروج من الامتحان (hashchange) → تحذير inline دائم
  const handleNavAttempt = useCallback(() => {
    if (examSession) examSession.navWarned = true;
    setNavWarning(true);
  }, []);

  // ✅ بوابة كود الامتحان: العضو لازم يدخل كود الامتحان (اللي الأدمن
  // ولّده) عشان يبدأ — الامتحان بيظهر لمرحلته بس، بس الدخول بالكود
  const [codeExam, setCodeExam] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const handleStart = (exam) => {
    // مبتدأش امتحان غير مسجل دخول — التوجيه لتسجيل الدخول
    if (!currentUser) {
      window.location.hash = "#/login";
      return;
    }
    // مفيش كود متولد؟ ندخل على طول (توافق مع القديم)
    if (!exam.examCode) {
      startExam(exam);
      return;
    }
    setCodeExam(exam);
    setCodeInput("");
    setCodeError("");
  };

  const submitCode = (e) => {
    e.preventDefault();
    if (!codeExam) return;
    const ok =
      codeInput.trim().toUpperCase() === (codeExam.examCode || "").toUpperCase();
    if (!ok) {
      setCodeError("الكود غلط — اطلب كود الامتحان الصحيح من القائد.");
      return;
    }
    setCodeError("");
    startExam(codeExam);
  };

  const startExam = (exam) => {
    setCodeExam(null);
    examSession = {
      exam,
      idx: 0,
      answers: {},
      flagged: {},
      deadline: Date.now() + (exam.duration ?? 30) * 60 * 1000,
      navWarned: false,
    };
    setNavWarning(false);
    setJustSubmitted(null);
    setActiveExam(exam);
  };

  // التسليم الفعلي — النتيجة بتتخزن approved=false (تحت المراجعة)
  // ولو الحفظ فشل الخطأ بيتعرض في نافذة التسليم (النتيجة مش بتضيع بصمت)
  const saveResult = async (examId, answers) => {
    if (!currentUser || !identity) {
      setSubmitError("انتهت الجلسة — سجّل الدخول تاني");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      // Build answers map for the RPC: { "0": chosenIndex, "1": chosenIndex, ... }
      const answersMap = {};
      if (typeof answers === 'object' && !Array.isArray(answers)) {
        Object.entries(answers).forEach(([key, val]) => {
          answersMap[key] = val;
        });
      }

      // Call server-side scoring RPC
      const { data: scoringResult, error: scoringError } = await supabase.rpc('score_exam', {
        p_exam_id: examId,
        p_answers: answersMap,
      });

      if (scoringError) throw scoringError;
      if (scoringResult?.error) throw new Error(scoringResult.error);

      const score = scoringResult?.score ?? 0;

      await submitExamResult(examId, {
        name: identity.name,
        rank: identity.rank,
        email: identity.email,
        score,
      });

      examSession = null;
      setPendingSubmission(null);
      setActiveExam(null);
      setNavWarning(false);
      const exam = safeExams.find((e) => e.id === examId);
      setJustSubmitted(exam?.title ?? "امتحانك");
    } catch (err) {
      setSubmitError(
        "فشل حفظ النتيجة: " + (err?.message || err) + " — حاول تاني"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // onRecord من الـ runner: manual (زرار إنهاء الاختبار) أو auto (انتهاء الوقت)
  const handleRecord = (examId, answers, { auto = false } = {}) => {
    if (pendingSubmission || submitting) return; // نافذة التسليم مفتوحة بالفعل
    if (!examSession || examSession.exam.id !== examId) return;
    if (auto) {
      // انتهاء الوقت — تسليم تلقائي بدون تأكيد؛ لو الحفظ فشل
      // نافذة التسليم بتفضل مفتوحة بالخطأ للإعادة
      setPendingSubmission({ examId, answers, auto: true });
      saveResult(examId, answers);
    } else {
      setPendingSubmission({ examId, answers, auto: false });
    }
  };

  const confirmSubmission = () => {
    if (!pendingSubmission || submitting) return;
    saveResult(pendingSubmission.examId, pendingSubmission.answers);
  };

  // رجوع للامتحان من نافذة التأكيد (مش خروج — القفل شغال)
  const cancelSubmission = () => {
    if (submitting) return;
    setPendingSubmission(null);
    setSubmitError("");
  };

  // خروج فعلي من الـ runner (امتحان من غير أسئلة بس)
  const handleExit = () => {
    examSession = null;
    setNavWarning(false);
    setActiveExam(null);
  };

  const currentExamForConfirm = pendingSubmission
    ? (safeExams.find((e) => e.id === pendingSubmission.examId) ??
      examSession?.exam)
    : null;

  // ✅ الامتحان شغال → fullscreen overlay فوق كل حاجة (من غير MemberLayout)
  if (activeExam) {
    return (
      <>
        <ExamRunner
          exam={activeExam}
          examinee={identity}
          session={examSession}
          locked={Boolean(pendingSubmission) || submitting}
          navWarning={navWarning}
          onSessionUpdate={handleSessionUpdate}
          onNavAttempt={handleNavAttempt}
          onExit={handleExit}
          onRecord={(answers, opts) => handleRecord(activeExam.id, answers, opts)}
        />

        {/* نافذة تأكيد التسليم فوق الامتحان */}
        {pendingSubmission && currentExamForConfirm && (
          <ConfirmSubmitModal
            exam={currentExamForConfirm}
            auto={pendingSubmission.auto}
            error={submitError}
            busy={submitting}
            onConfirm={confirmSubmission}
            onCancel={cancelSubmission}
          />
        )}
      </>
    );
  }

  const completed = available
    .map((exam) => ({ exam, result: myResult(exam.id) }))
    .filter((x) => x.result);

  return (
    <MemberLayout active="exams">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {!currentUser && (
          <GuestNotice message="🔒 لازم تسجل دخول علشان تختبر — الامتحانات متاحة لأعضاء المجموعة المسجلين فقط." />
        )}

        {/* ✅ بوابة كود الامتحان — العضو يدخل الكود اللي القائد دههولو */}
        {codeExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCodeExam(null)}>
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <span className="text-4xl">🔑</span>
                <h3 className="mt-2 text-lg font-extrabold text-maroon-900">كود الامتحان</h3>
                <p className="mt-1 text-sm text-earth-600">
                  امتحان <span className="font-bold text-earth-900">{codeExam.title}</span> — اكتب الكود اللي القائد دههولك عشان تبدأ.
                </p>
              </div>
              <form className="mt-4 space-y-3" onSubmit={submitCode}>
                <input
                  autoFocus
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="مثال: EX-JWL-7K2F"
                  dir="ltr"
                  className="w-full rounded-lg border border-earth-300 px-4 py-3 text-center font-mono text-lg font-extrabold tracking-widest text-maroon-900 uppercase focus:border-maroon-500 focus:ring-2 focus:ring-maroon-400/40 focus:outline-none"
                />
                {codeError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-700">
                    ❌ {codeError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCodeExam(null)}
                    className="flex-1 rounded-lg border border-earth-300 bg-white px-4 py-2.5 text-sm font-bold text-earth-700 transition hover:bg-earth-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800"
                  >
                    ابدأ الامتحان
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ رسالة النجاح بعد التسليم */}
        {justSubmitted && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-bold text-forest-800">
            <CheckIcon className="h-4 w-4 shrink-0" />
            امتحانك اتبعت — نتيجتك تحت مراجعة القائد.
          </div>
        )}

        <h1 className="text-3xl font-extrabold text-earth-900">
          الامتحانات{" "}
          <span className="text-lg font-semibold text-earth-500">
            / Exams
          </span>
        </h1>
        <p className="mt-1.5 text-sm text-earth-600">
          الامتحانات المتاحة حاليًا — هوية الممتحن بتتسجل تلقائيًا من حسابك،
          والدرجة بتظهر بعد اعتماد قائد الامتحانات.
        </p>

        {completed.length > 0 && (
          <div className="mt-8 rounded-2xl border border-earth-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-earth-900">
              الامتحانات اللي امتحنتها{" "}
              <span className="text-sm font-semibold text-earth-500">
                / Completed Exams
              </span>
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-earth-200 text-[11px] tracking-wider text-earth-500 uppercase">
                    <th className="pb-3 font-bold">الامتحان</th>
                    <th className="pb-3 font-bold">الحالة</th>
                    <th className="pb-3 text-right font-bold">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map(({ exam, result }) => (
                    <tr
                      key={exam.id}
                      className="border-b border-earth-100 last:border-0"
                    >
                      <td className="py-3 font-semibold text-earth-900">
                        {exam.title}
                      </td>
                      <td className="py-3">
                        {result.approved ? (
                          <Badge tone="green">
                            درجتك: {result.score} /{" "}
                            {result.totalQuestions ||
                              exam.questionList?.length ||
                              exam.questions}
                          </Badge>
                        ) : (
                          <Badge tone="gold">⏳ تحت المراجعة</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-earth-500">
                        {result.submitted || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((exam) => {
            const result = myResult(exam.id);
            const total = exam.questionList?.length ?? exam.questions;

            return (
              <div
                key={exam.id}
                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-xs transition ${
                  result
                    ? "border-forest-200"
                    : "border-earth-200 hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge tone="green">نشط</Badge>
                </div>
                <h3 className="mt-3 text-base font-bold text-earth-900">
                  {exam.title}
                </h3>
                {exam.scoutStage && (
                  <p className="mt-1 text-[11px] font-bold text-maroon-700">
                    🏕️ {stageForMember(exam.scoutStage, myMember?.scoutStage)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-earth-600">
                  <span className="flex items-center gap-1.5">
                    <ListIcon className="h-3.5 w-3.5 text-forest-600" />
                    {total} أسئلة
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5 text-forest-600" />
                    {exam.duration} دقيقة
                  </span>
                </div>

                {result ? (
                  // ✅ امتحان مأخوذ: الدرجة بس لو معتمدة — ومفيش زرار إعادة
                  <div className="mt-4 space-y-2">
                    {result.approved ? (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-bold text-forest-800">
                        <CheckIcon className="h-4 w-4" />
                        درجتك: {result.score} /{" "}
                        {result.totalQuestions || total}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gold-300 bg-gold-50 px-4 py-2.5 text-center text-sm font-bold text-gold-900">
                        امتحان مأخوذ — نتيجتك تحت مراجعة القائد
                      </div>
                    )}
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-earth-200 bg-earth-100 px-4 py-2.5 text-sm font-bold text-earth-400 uppercase opacity-60"
                    >
                      تم الامتحان
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStart(exam)}
                    className="mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-forest-700 px-4 py-2.5 text-sm font-bold text-white uppercase transition hover:bg-forest-800 active:scale-[0.99]"
                  >
                    {currentUser ? "ابدأ الامتحان" : "سجّل الدخول للبدء"}
                  </button>
                )}
              </div>
            );
          })}
          {available.length === 0 && (
            <p className="rounded-2xl border border-earth-200 bg-white p-8 text-center text-sm text-earth-500 sm:col-span-2 lg:col-span-3">
              لا توجد امتحانات مفتوحة حاليًا — تابعنا قريبًا.
            </p>
          )}
        </div>
      </div>
    </MemberLayout>
  );
}
