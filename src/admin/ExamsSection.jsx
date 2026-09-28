import { useState } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  XIcon,
  ListIcon,
  ClockIcon,
  UsersIcon,
  ChartIcon,
  KeyIcon,
} from "./icons.jsx";
import { Badge, Card, ConfirmDialog, Field, Modal, inputCls, uid } from "./ui.jsx";
import { EXAM_STATUSES } from "./data.js";
import { SCOUT_STAGES } from "./badges-seed.js";
import { stagePairKey, stagePairLabel } from "../utils/stages.js";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput.js";

const statusAr = { Active: "نشط", Draft: "مسودة", Closed: "مغلق" };

// بادئة الكود حسب المرحلة + 4 حروف عشوائية — مثال: EX-JWL-7K2F
const STAGE_CODE_PREFIX = {
  ashbal: "ASB",
  kashaf: "KSH",
  mutaqaddim: "MTQ",
  jawwal: "JWL",
  qaid: "QID",
  raed: "RAD",
};

export const generateExamCode = (stageValue) => {
  const pre = STAGE_CODE_PREFIX[stagePairKey(stageValue)] ?? "EX";
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EX-${pre}-${rnd}`;
};

const questionCount = (exam) => {
  const ql = exam.questionList?.length ?? 0;
  return ql > 0 ? ql : (exam.questions ?? 0);
};

function ExamFormModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  // ✅ الامتحان الجديد بيبدأ Draft (مسودة مخفية عن الأعضاء) وكود اتولد تلقائياً —
  // يعتمده القائد بخليه Active عشان يظهر للأعضاء
  const [form, setForm] = useState(
    initial ?? {
      title: "",
      examCode: generateExamCode(""),
      duration: "",
      status: "Draft",
      scoutStage: "",
    }
  );
  const [questions, setQuestions] = useState(
    () => initial?.questionList?.map((q) => ({ ...q, choices: [...q.choices] })) ?? []
  );
  const [errors, setErrors] = useState({});
  const [qErrors, setQErrors] = useState({});

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  // ✅ لما المرحلة تتغير والكود لسه على الوضع التلقائي → كود جديد ببادئة المرحلة
  const setStage = (e) => {
    const stage = e.target.value;
    setForm((f) => ({
      ...f,
      scoutStage: stage,
      // بنعيد التوليد بس لو الكود ماشي على نمط التوليد التلقائي (المستخدم معدلوش يدوي)
      examCode:
        !isEdit && /^EX-[A-Z0-9]{2,3}-[A-Z0-9]{4}$/.test(f.examCode ?? "")
          ? generateExamCode(stage)
          : f.examCode,
    }));
  };

  const updateQuestion = (qid, patch) =>
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));

  const addQuestion = () =>
    setQuestions((qs) => [
      ...qs,
      { id: uid(), text: "", choices: ["", "", ""], correct: 0 },
    ]);

  const setQuestionCount = (raw) => {
    const n = Math.max(0, Math.min(50, Math.floor(Number(raw) || 0)));
    setQuestions((qs) => {
      if (n === qs.length) return qs;
      if (n > qs.length)
        return [
          ...qs,
          ...Array.from({ length: n - qs.length }, () => ({
            id: uid(),
            text: "",
            choices: ["", "", ""],
            correct: 0,
          })),
        ];
      return qs.slice(0, n);
    });
  };

  const removeQuestion = (qid) =>
    setQuestions((qs) => qs.filter((q) => q.id !== qid));

  const addChoice = (qid) =>
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qid && q.choices.length < 4
          ? { ...q, choices: [...q.choices, ""] }
          : q
      )
    );

  const removeChoice = (qid, idx) =>
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== qid || q.choices.length <= 2) return q;
        const choices = q.choices.filter((_, i) => i !== idx);
        let correct = q.correct;
        if (correct === idx) correct = 0;
        else if (correct > idx) correct -= 1;
        return { ...q, choices, correct };
      })
    );

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = "عنوان الامتحان مطلوب.";
    if (!form.scoutStage) next.scoutStage = "اختر المرحلة الكشفية.";
    if (!form.examCode.trim()) next.examCode = "كود الامتحان مطلوب.";
    if (!form.duration || Number(form.duration) <= 0)
      next.duration = "أدخل مدة صالحة.";
    setErrors(next);

    const qErr = {};
    if (questions.length === 0) {
      setQErrors({ _all: "أضف سؤالاً واحداً على الأقل." });
      return;
    }
    questions.forEach((q) => {
      if (!q.text.trim()) qErr[q.id] = "أدخل نص السؤال.";
      else if (q.choices.some((c) => !c.trim()))
        qErr[q.id] = "املأ جميع الخيارات.";
    });
    setQErrors(qErr);

    if (Object.keys(next).length > 0 || Object.keys(qErr).length > 0) return;

    onSubmit({
      ...form,
      title: form.title.trim(),
      examCode: form.examCode.trim().toUpperCase(),
      scoutStage: form.scoutStage || "",
      duration: Number(form.duration),
      questions: questions.length,
      questionList: questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        choices: q.choices.map((c) => c.trim()),
        correct: q.correct,
      })),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل الامتحان" : "إنشاء امتحان"}
      subtitle="أضف الأسئلة والخيارات وحدد الإجابة الصحيحة."
      width="sm:max-w-2xl"
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Field label="عنوان الامتحان" required error={errors.title}>
          <input
            className={inputCls}
            value={form.title}
            onChange={set("title")}
            placeholder="مثال: أساسيات البقاء في البرية"
          />
        </Field>

        {/* ===== كود الامتحان + المرحلة + الحالة ===== */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المرحلة الكشفية" required error={errors.scoutStage}>
            <select className={inputCls} value={form.scoutStage || ""} onChange={setStage}>
              <option value="">— اختر المرحلة —</option>
              {SCOUT_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              {/* قيمة قديمة غير معروفة — نعرضها زي ما هي */}
              {form.scoutStage && !SCOUT_STAGES.includes(form.scoutStage) && (
                <option value={form.scoutStage}>{stagePairLabel(form.scoutStage)}</option>
              )}
            </select>
            <p className="mt-1 text-[11px] text-earth-500">
              الامتحان بيظهر بس لأعضاء المرحلة دي (مذكر ومؤنث معاً).
            </p>
          </Field>
          <Field label="الحالة">
            <select className={inputCls} value={form.status} onChange={set("status")}>
              {EXAM_STATUSES.map((s) => (
                <option key={s} value={s}>{statusAr[s] ?? s}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-earth-500">
              الأعضاء مش هيشوفوا غير الامتحانات النشطة (Active) — اعتمد الامتحان عشان يظهر ليهم.
            </p>
          </Field>
        </div>

        <Field label="كود الامتحان" required error={errors.examCode}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
              <input
                className={`${inputCls} pl-9 font-mono font-bold uppercase tracking-wider`}
                value={form.examCode}
                onChange={(e) => setForm((f) => ({ ...f, examCode: e.target.value.toUpperCase() }))}
                placeholder="مثال: EX-JWL-7K2F"
              />
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, examCode: generateExamCode(f.scoutStage) }))}
              className="shrink-0 cursor-pointer rounded-lg border border-maroon-200 bg-maroon-50 px-3 text-xs font-bold text-maroon-800 transition hover:bg-maroon-100"
              title="توليد كود جديد تلقائياً"
            >
              🔄 توليد
            </button>
          </div>
          <p className="mt-1 text-[11px] text-earth-500">
            الكود متولد تلقائياً — تقدر تعدله أو تعيد توليده، ولازم يكون فريد لكل امتحان.
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المدة (بالدقائق)" required error={errors.duration}>
            <input
              className={inputCls}
              type="number"
              min="1"
              value={form.duration}
              onChange={set("duration")}
              placeholder="45"
            />
          </Field>
          <Field label="عدد الأسئلة">
            <input
              className={inputCls}
              type="number"
              min="0"
              max="50"
              value={questions.length}
              onChange={(e) => setQuestionCount(e.target.value)}
              placeholder="مثال: 5"
            />
          </Field>
        </div>

        <div className="border-t border-maroon-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-earth-800 uppercase">
              الأسئلة ({questions.length})
            </p>
            <button
              type="button"
              onClick={addQuestion}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-maroon-50 px-3 py-1.5 text-xs font-bold text-maroon-800 uppercase transition hover:bg-maroon-100"
            >
              <PlusIcon className="h-3.5 w-3.5" /> إضافة سؤال
            </button>
          </div>

          {qErrors._all && (
            <p className="mt-2 text-xs font-medium text-red-600">{qErrors._all}</p>
          )}

          <div className="mt-3 space-y-4">
            {questions.map((q, qi) => (
              <div
                key={q.id}
                className="rounded-xl border border-maroon-100 bg-maroon-50/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-maroon-800 uppercase">
                    سؤال {qi + 1}
                  </span>
                  <button
                    type="button"
                    aria-label={`إزالة السؤال ${qi + 1}`}
                    onClick={() => removeQuestion(q.id)}
                    className="cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className={`${inputCls} mt-2`}
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  placeholder="اكتب نص السؤال هنا..."
                />
                <p className="mt-3 text-[11px] font-bold tracking-wider text-earth-500 uppercase">
                  الخيارات — علّم الإجابة الصحيحة
                </p>
                <div className="mt-2 space-y-2">
                  {q.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correct === ci}
                        onChange={() => updateQuestion(q.id, { correct: ci })}
                        aria-label={`علّم الخيار ${ci + 1} كإجابة صحيحة`}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-maroon-600"
                      />
                      <input
                        className={inputCls}
                        value={c}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            choices: q.choices.map((x, xi) =>
                              xi === ci ? e.target.value : x
                            ),
                          })
                        }
                        placeholder={`الخيار ${ci + 1}`}
                      />
                      {q.choices.length > 2 && (
                        <button
                          type="button"
                          aria-label={`إزالة الخيار ${ci + 1}`}
                          onClick={() => removeChoice(q.id, ci)}
                          className="cursor-pointer rounded-lg p-1.5 text-earth-500 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {q.choices.length < 4 && (
                    <button
                      type="button"
                      onClick={() => addChoice(q.id)}
                      className="cursor-pointer text-xs font-bold text-maroon-700 uppercase hover:underline"
                    >
                      + إضافة خيار
                    </button>
                  )}
                  <span className="text-[11px] font-semibold text-forest-700">
                    الإجابة الصحيحة: الخيار {q.correct + 1}
                  </span>
                </div>
                {qErrors[q.id] && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {qErrors[q.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-earth-200 px-4 py-2 text-sm font-semibold text-earth-700 transition hover:bg-earth-100"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-maroon-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-800"
          >
            {isEdit ? "حفظ التغييرات" : "إنشاء الامتحان"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResultsModal({ exam, onClose, onApproveResult, onAllowRetake, readOnly = false }) {
  const [pendingRetake, setPendingRetake] = useState(null);
  const totalQuestions = questionCount(exam);
  const approvedCount = exam.results.filter((r) => r.approved).length;
  const pendingCount = exam.results.length - approvedCount;
  const avg =
    exam.results.length > 0 && totalQuestions > 0
      ? Math.round(
        (exam.results.reduce((sum, r) => sum + r.score, 0) /
          exam.results.length /
          totalQuestions) *
        100
      )
      : 0;

  const rankTone = (rank) =>
    rank === "رائد" ? "red" :
    rank === "قائد" ? "maroon" :
      rank === "جوالة" ? "green" :
        rank === "متقدم" ? "gold" :
          rank === "كشاف" ? "gray" : "earth";

  return (
    <Modal
      open
      onClose={onClose}
      title={`النتائج — ${exam.title}`}
      subtitle={`${exam.results.length} إرسال حديث من إجمالي ${exam.submissions}`}
      width="sm:max-w-4xl"
    >
      {exam.results.length === 0 ? (
        <p className="py-8 text-center text-sm text-earth-500">
          لا توجد إرسالات بعد — لم يُجرَ هذا الامتحان بعد.
        </p>
      ) : (
        <>
          {/* ===== شريط ملخص واضح (3 كروت) ===== */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-maroon-100 bg-maroon-50 px-3 py-3 text-center">
              <p className="text-[11px] font-bold tracking-wider text-earth-500">متوسط الدرجات</p>
              <p className="mt-1 text-2xl font-extrabold text-maroon-800">{avg}%</p>
            </div>
            <div className="rounded-xl border border-forest-200 bg-forest-50 px-3 py-3 text-center">
              <p className="text-[11px] font-bold tracking-wider text-earth-500">معتمدة</p>
              <p className="mt-1 text-2xl font-extrabold text-forest-800">{approvedCount}</p>
            </div>
            <div className="rounded-xl border border-gold-300 bg-gold-50 px-3 py-3 text-center">
              <p className="text-[11px] font-bold tracking-wider text-earth-500">تحت المراجعة</p>
              <p className="mt-1 text-2xl font-extrabold text-gold-800">{pendingCount}</p>
            </div>
          </div>

          {/* ===== كارت لكل نتيجة — مفيش سكرول عرضي والإيميل ظاهر كامل ===== */}
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pl-1">
            {exam.results.map((r) => {
              const total = r.totalQuestions || totalQuestions;
              const pct = total > 0 ? Math.round((r.score / total) * 100) : 0;
              return (
                <div
                  key={r.id ?? `${r.name}-${r.submitted}`}
                  className="rounded-xl border border-earth-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* الهوية: الاسم + الرتبة + الحالة + الإيميل + التاريخ */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-extrabold text-earth-900">
                          {r.name ?? "—"}
                        </p>
                        <Badge tone={rankTone(r.rank)}>{r.rank ?? "—"}</Badge>
                        <Badge tone={r.approved ? "green" : "gold"}>
                          {r.approved ? "✅ معتمدة" : "⏳ تحت المراجعة"}
                        </Badge>
                      </div>
                      <p dir="ltr" className="mt-1.5 text-right text-xs font-semibold text-maroon-700">
                        {r.email ?? "—"}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-earth-500">
                        🕒 تاريخ التسليم: {r.submitted ?? "—"}
                      </p>
                    </div>

                    {/* الدرجة: رقم كبير + نسبة ملونة */}
                    <div className="shrink-0 rounded-lg border border-earth-100 bg-earth-50 px-4 py-2 text-center">
                      <p className="text-xl font-extrabold text-earth-900">
                        {r.score}
                        <span className="text-xs font-bold text-earth-500"> / {total}</span>
                      </p>
                      <div className="mt-1">
                        <Badge tone={pct >= 80 ? "green" : pct >= 60 ? "gold" : "red"}>
                          {pct}%
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* الإجراءات (بتختفي تلقائياً في وضع العرض فقط) */}
                  {!readOnly && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-earth-100 pt-3">
                      {!r.approved && (
                        <button
                          type="button"
                          onClick={() => onApproveResult?.(r.id)}
                          className="cursor-pointer rounded-lg border border-forest-200 bg-forest-50 px-3 py-1.5 text-xs font-bold text-forest-800 transition hover:bg-forest-100 active:scale-[0.98]"
                        >
                          ✅ اعتماد النتيجة
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingRetake(r)}
                        className="cursor-pointer rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-xs font-bold text-gold-800 transition hover:bg-gold-100 active:scale-[0.98]"
                      >
                        ↩️ السماح بإعادة الامتحان
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* تأكيد السماح بإعادة الامتحان */}
      <ConfirmDialog
        open={Boolean(pendingRetake)}
        title="السماح بإعادة الامتحان"
        message={`هل أنت متأكد من السماح بـ "${pendingRetake?.name ?? ""}" بإعادة امتحان "${exam.title}"؟ سيتم حذف النتيجة الحالية نهائيًا ويستطيع العضو دخول الامتحان من جديد.`}
        confirmLabel="سماح بإعادة"
        onCancel={() => setPendingRetake(null)}
        onConfirm={() => {
          onAllowRetake?.(pendingRetake.id);
          setPendingRetake(null);
        }}
      />
    </Modal>
  );
}

export default function ExamsSection({
  exams,
  onAdd,
  onUpdate,
  onDelete,
  onApproveResult,
  onAllowRetake,
  readOnly = false,
}) {
  const [modal, setModal] = useState(null);
  const [viewResults, setViewResults] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const statusTone = { Active: "green", Draft: "gold", Closed: "gray" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-earth-600">
          {exams.filter((e) => e.status === "Active").length} امتحان نشط
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModal({ mode: "add" })}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-800 active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4" /> إنشاء امتحان
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exams.map((exam) => (
          <Card key={exam.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={statusTone[exam.status]}>{statusAr[exam.status] ?? exam.status}</Badge>
              {!readOnly && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${exam.title}`}
                    onClick={() => setModal({ mode: "edit", exam })}
                    className="cursor-pointer rounded-lg p-1.5 text-maroon-700 transition hover:bg-maroon-100"
                  >
                    <EditIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${exam.title}`}
                    onClick={() => setPendingDelete(exam)}
                    className="cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <h4 className="mt-3 text-base font-bold text-maroon-900">
              {exam.title}
            </h4>

            {/* ===== كود الامتحان + المرحلة ===== */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {exam.examCode && (
                <div className="inline-flex items-center gap-1.5 self-start rounded-lg border border-maroon-200 bg-maroon-50 px-2.5 py-1">
                  <KeyIcon className="h-3.5 w-3.5 text-maroon-600" />
                  <span className="font-mono text-xs font-extrabold tracking-wider text-maroon-800">
                    {exam.examCode}
                  </span>
                </div>
              )}
              {exam.scoutStage && (
                <div className="inline-flex items-center gap-1 self-start rounded-lg border border-earth-200 bg-earth-50 px-2.5 py-1">
                  🏕️
                  <span className="text-xs font-bold text-earth-700">
                    {stagePairLabel(exam.scoutStage)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-earth-600">
              <span className="flex items-center gap-1.5">
                <ListIcon className="h-3.5 w-3.5 text-maroon-600" />
                {questionCount(exam)} سؤال
              </span>
              <span className="flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-maroon-600" />
                {exam.duration} دقيقة
              </span>
              <span className="flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5 text-maroon-600" />
                {exam.submissions} إرسال
              </span>
            </div>
            <button
              type="button"
              onClick={() => setViewResults(exam)}
              className="mt-4 w-full cursor-pointer rounded-lg border border-maroon-200 bg-maroon-50 px-4 py-2 text-sm font-bold text-maroon-800 uppercase transition hover:bg-maroon-100 active:scale-[0.99]"
            >
              عرض النتائج
            </button>
          </Card>
        ))}
      </div>

      {modal && (
        <ExamFormModal
          initial={modal.mode === "edit" ? modal.exam : null}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            if (modal.mode === "edit") onUpdate(modal.exam.id, sanitizeObject(data, ['questionList']));
            else onAdd(sanitizeObject(data, ['questionList']));
            setModal(null);
          }}
        />
      )}

      {viewResults && (
        <ResultsModal
          exam={viewResults}
          onClose={() => setViewResults(null)}
          onApproveResult={onApproveResult}
          onAllowRetake={onAllowRetake}
          readOnly={readOnly}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف الامتحان"
        message={`هل أنت متأكد من حذف "${pendingDelete?.title}"؟ ستفقد جميع النتائج المرتبطة به.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}