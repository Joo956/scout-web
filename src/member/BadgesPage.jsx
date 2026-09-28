import { useState, useMemo } from "react";
import { useStore } from "../store.jsx";
import MemberLayout from "./MemberLayout.jsx";
import { parseLinks } from "../utils/imageLinks.js";
import { SCOUT_STAGES } from "../admin/badges-seed.js";
import { stageMatches, stageForMember, stagePairLabel } from "../utils/stages.js";

const BADGE_COLORS = {
  "هوايات": "bg-purple-100 text-purple-800",
  "مهارات كشفية": "bg-green-100 text-green-800",
  "مهارات حياتية": "bg-rose-100 text-rose-800",
  "خدمة مجتمع": "bg-amber-100 text-amber-800",
  "مهارات تقنية": "bg-blue-100 text-blue-800",
  "مهارات متخصصة": "bg-indigo-100 text-indigo-800",
  "ريادة أعمال": "bg-orange-100 text-orange-800",
  "فنون": "bg-pink-100 text-pink-800",
  "رياضة": "bg-teal-100 text-teal-800",
};

const LEVEL_COLORS = {
  "مبتدئ": "text-green-600",
  "متوسط": "text-blue-600",
  "متقدم": "text-orange-600",
  "متخصص": "text-red-600",
};

import { isDriveLink, toViewableDriveUrl } from "../utils/driveLinks.js";

/* ── Application Form Modal ─────────────────────────────────── */
function ApplicationFormModal({ award, badge, exams, onClose, onSubmit }) {
  // If badge has no custom applicationFields, fall back to the generic evidence form
  const appFields = badge?.applicationFields?.length > 0 ? badge.applicationFields : null;

  // Custom fields form state
  const [fieldValues, setFieldValues] = useState(() => {
    if (!appFields) return {};
    const existing = award?.application_data ?? {};
    const init = {};
    appFields.forEach((f) => { init[f.key] = existing[f.key] ?? ""; });
    return init;
  });
  const [appNotes, setAppNotes] = useState(award?.notes || "");
  const [appErrors, setAppErrors] = useState({});
  const [appSubmitting, setAppSubmitting] = useState(false);

  // Generic evidence form state (fallback) — رابط Google Drive واحد بس
  const [driveUrl, setDriveUrl] = useState(award?.evidence?.[0]?.url || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  /* ── Custom fields handlers ── */
  const handleCustomSubmit = async () => {
    const errs = {};
    appFields.forEach((f) => {
      if (f.required && !fieldValues[f.key]?.toString().trim()) {
        errs[f.key] = "هذا الحقل إجباري";
        return;
      }
      // ✅ روابط Drive فقط في حقول الروابط/الصور
      if ((f.type === "url" || f.type === "image") && fieldValues[f.key]?.toString().trim()) {
        if (!isDriveLink(fieldValues[f.key])) {
          errs[f.key] = "لازم يكون رابط Google Drive — افتح الملف في Drive وانسخ الرابط من شريط العنوان";
        }
      }
    });
    setAppErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setAppSubmitting(true);
    try {
      // Build application_data from fieldValues
      const applicationData = {};
      appFields.forEach((f) => {
        const val = fieldValues[f.key];
        if (val !== undefined && val !== "") {
          const clean = val.toString().trim();
          // صورة Drive بتتحول لرابط عرض يشتغل كصورة، والرابط العادي بيفضل زي ما هو
          applicationData[f.key] =
            f.type === "image"
              ? toViewableDriveUrl(clean, "image")
              : f.type === "number"
                ? Number(clean)
                : clean;
        }
      });
      await onSubmit(award.id, {
        status: "submitted",
        applicationData,
        notes: appNotes.trim(),
      });
    } finally {
      setAppSubmitting(false);
    }
  };

  /* ── Generic evidence handlers ── */
  const handleGenericSubmit = async () => {
    const clean = driveUrl.trim();
    if (!clean) {
      setSubmitError("لازم تحط رابط Google Drive للدليل الأول.");
      return;
    }
    if (!isDriveLink(clean)) {
      setSubmitError("لازم يكون رابط Google Drive — افتح الملف في Drive وانسخ الرابط من شريط العنوان.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      await onSubmit(award.id, {
        status: "submitted",
        evidence: [{ type: "link", url: clean }],
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = appFields ? appSubmitting : submitting;

  /* ── Find exam info ── */
  const requiredExam = badge?.requiredExamId && exams
    ? exams.find((e) => e.id === badge.requiredExamId)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-maroon-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-extrabold text-maroon-900">
              {appFields ? "استمارة التقديم" : "تقديم أدلّة الشارة"}
            </h2>
            <p className="text-sm text-earth-600 mt-0.5">{badge.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-earth-400 hover:text-earth-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Badge info pills */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              BADGE_COLORS[badge.category] || "bg-gray-100 text-gray-800"
            }`}
          >
            {badge.category}
          </span>
          <span className={`text-[10px] font-bold ${LEVEL_COLORS[badge.level]}`}>
            {badge.level}
          </span>
          <span className="text-[10px] font-bold text-maroon-700">{badge.points} نقطة</span>
        </div>

        {/* Exam requirement info */}
        {badge.requiredExamId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 space-y-1">
            <p className="font-bold">📝 هذه الشارة تتطلب اجتياز امتحان</p>
            {requiredExam && (
              <p>الامتحان: <strong>{requiredExam.title}</strong></p>
            )}
          </div>
        )}

        {/* ── Custom application fields form ── */}
        {appFields && (
          <div className="space-y-4">
            <h3 className="font-bold text-earth-900 text-sm">📋 حقول الاستمارة</h3>
            {appFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="font-bold text-earth-900 text-sm flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500 text-xs">*</span>}
                </label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={fieldValues[field.key] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.label}
                    className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white"
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={fieldValues[field.key] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.label}
                    rows={3}
                    className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white resize-none"
                  />
                )}

                {field.type === "url" && (
                  <>
                    <input
                      type="url"
                      value={fieldValues[field.key] ?? ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder="https://drive.google.com/..."
                      dir="ltr"
                      className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white"
                    />
                    {fieldValues[field.key]?.trim() && !isDriveLink(fieldValues[field.key]) && (
                      <p className="text-red-500 text-xs font-bold">
                        ⚠️ لازم يكون رابط Google Drive
                      </p>
                    )}
                  </>
                )}

                {field.type === "image" && (
                  <>
                    <input
                      type="url"
                      value={fieldValues[field.key] ?? ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder="https://drive.google.com/file/d/..."
                      dir="ltr"
                      className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white"
                    />
                    {fieldValues[field.key]?.trim() && !isDriveLink(fieldValues[field.key]) && (
                      <p className="text-red-500 text-xs font-bold">
                        ⚠️ لازم يكون رابط Google Drive
                      </p>
                    )}
                  </>
                )}

                {field.type === "number" && (
                  <input
                    type="number"
                    value={fieldValues[field.key] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.label}
                    className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white"
                  />
                )}

                {appErrors[field.key] && (
                  <p className="text-red-500 text-xs">{appErrors[field.key]}</p>
                )}
              </div>
            ))}

            {/* Notes */}
            <div className="space-y-1">
              <label className="font-bold text-earth-900 text-sm">📝 ملاحظات</label>
              <textarea
                value={appNotes}
                onChange={(e) => setAppNotes(e.target.value)}
                rows={3}
                placeholder="أي ملاحظات إضافية للمراجع..."
                className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Generic evidence form (fallback) — رابط Google Drive واحد ── */}
        {!appFields && (
          <div className="space-y-3">
            <h3 className="font-bold text-earth-900 text-sm">📎 رابط الدليل</h3>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
              ارفع دليلك (صور / فيديو / مستند) على <strong>Google Drive</strong> وانسخ الرابط هنا.
              <br />
              مهم: من Drive اعمل «مشاركة» واختار <strong>«أي شخص لديه الرابط»</strong> عشان المراجع يقدر يفتحه.
            </div>
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-400 bg-white"
              dir="ltr"
            />
            {driveUrl.trim() && !isDriveLink(driveUrl) && (
              <p className="text-red-500 text-xs font-bold">
                ⚠️ لازم يكون رابط Google Drive — الروابط التانية مش هتتقبل
              </p>
            )}
            {submitError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {submitError}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={appFields ? handleCustomSubmit : handleGenericSubmit}
            disabled={isBusy}
            className="flex-1 py-2.5 rounded-xl bg-maroon-700 text-white font-bold text-sm hover:bg-maroon-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? "جاري التقديم..." : "تقديم للمراجعة"}
          </button>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="px-6 py-2.5 rounded-xl border-2 border-earth-300 text-earth-700 font-bold text-sm hover:bg-earth-100 transition disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function BadgesPage() {
  const { badges, badgeAwards, currentUser, members, exams, updateBadgeAward, startBadge: storeStartBadge } = useStore();
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [filterCategory, setFilterCategory] = useState("الكل");
  const [stageFilter, setStageFilter] = useState("my"); // "my" = member's stage, or a specific stage, or "all"
  const [tab, setTab] = useState("catalog"); // "my" | "catalog"
  const [evidenceModalAward, setEvidenceModalAward] = useState(null);
  const [toast, setToast] = useState(null);

  // ── عضويّة الكشاف الحالي ──
  // المحاولة الأولى: من مصفوفة members (تعمل للمشرفين والأعضاء العاديين)
  // الاحتياط: إذا لم نجد myMember لكن badgeAwards فيه بيانات (RLS فلترة لصالح المستخدم)
  // نستخرج member_id من أي سجل — RLS يضمن أنها تخص المستخدم الحالي فقط
  const myMember = useMemo(
    () => members?.find((m) => m.userId === currentUser?.id),
    [members, currentUser]
  );

  const myMemberId = useMemo(() => {
    if (myMember?.id) return myMember.id;
    // احتياط: استخرج member_id من badgeAwards (RLS يضمن ملكية المستخدم)
    if (badgeAwards.length > 0 && currentUser?.id) {
      const firstMemberId = badgeAwards[0]?.member_id;
      if (firstMemberId) return firstMemberId;
    }
    return null;
  }, [myMember, badgeAwards, currentUser]);

  const myAwards = useMemo(
    () => myMemberId
      ? badgeAwards.filter((a) => a.member_id === myMemberId)
      : [],   // لا member_id معروف = لا شارات
    [badgeAwards, myMemberId]
  );

  const approvedIds = useMemo(
    () => new Set(myAwards.filter((a) => a.status === "approved").map((a) => a.badge_id)),
    [myAwards]
  );

  const inProgressIds = useMemo(
    () => new Set(myAwards.filter((a) => a.status === "in_progress").map((a) => a.badge_id)),
    [myAwards]
  );

  const submittedIds = useMemo(
    () => new Set(myAwards.filter((a) => a.status === "submitted").map((a) => a.badge_id)),
    [myAwards]
  );

  const pendingStartIds = useMemo(
    () => new Set(myAwards.filter((a) => a.status === "pending_start").map((a) => a.badge_id)),
    [myAwards]
  );

  const revokedIds = useMemo(
    () => new Set(myAwards.filter((a) => a.status === "revoked").map((a) => a.badge_id)),
    [myAwards]
  );

  const myAwardBadgeIds = useMemo(
    () => new Set(myAwards.map((a) => a.badge_id)),
    [myAwards]
  );

  const categories = useMemo(() => {
    const visibleBadges = badges.filter((b) => b.visible !== false);
    const cats = new Set(visibleBadges.map((b) => b.category));
    return ["الكل", ...cats];
  }, [badges]);

  const filtered = useMemo(
    () => badges
      .filter((b) => filterCategory === "الكل" || b.category === filterCategory)
      .filter((b) => {
        // Catalog: hide invisible badges
        if (tab === "catalog" && b.visible === false) return false;
        // "My Badges" tab: only badges the user has an award for
        if (tab === "my" && !myAwardBadgeIds.has(b.id)) return false;
        // "My Badges" tab: show hidden badges if user earned them
        return true;
      })
      .filter((b) => {
        // Stage filter only applies to catalog tab
        if (tab !== "catalog") return true;
        if (stageFilter === "all") return true;
        const targetStage = stageFilter === "my" ? myMember?.scoutStage : stageFilter;
        if (!targetStage) return true; // no stage known → show all
        // المطابقة بمفتاح الزوج: شارة "جوال / جوالة" بتظهر لـ "جوال" و"جوالة"
        // (والشارات من غير مرحلة بتظهر للجميع)
        return stageMatches(b.scoutStage, targetStage);
      }),
    [badges, filterCategory, tab, myAwardBadgeIds, stageFilter, myMember]
  );

  const totalPoints = useMemo(
    () =>
      myAwards
        .filter((a) => a.status === "approved")
        .reduce((sum, a) => sum + (a.badges?.points ?? 0), 0),
    [myAwards]
  );

  /* ── Start badge ─────────────────────────────────── */
  const startBadge = async (badge) => {
    if (!myMember) return;
    try {
      await storeStartBadge(badge.id, myMember.id);
      setToast({ type: "success", msg: `تم إرسال الطلب — مستنى موافقة القائد ⏳` });
    } catch {
      setToast({ type: "error", msg: "حصل خطأ، حاول تاني" });
    }
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Submit evidence ─────────────────────────────── */
  const handleSubmitEvidence = async (awardId, updates) => {
    try {
      await updateBadgeAward(awardId, updates);
      setEvidenceModalAward(null);
      setToast({ type: "success", msg: "تم تقديم الأدلّة للمراجعة ✅" });
    } catch (err) {
      setToast({ type: "error", msg: err?.message || "حدث خطأ، حاول مرة أخرى" });
    }
    setTimeout(() => setToast(null), 3500);
  };

  if (!currentUser) {
    return (
      <MemberLayout active="badges">
        <div className="text-center py-20 text-earth-600">سجّل دخولك عشان تشوف شاراتك</div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout active="badges">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-maroon-900">🏅 الشارات والإنجازات</h1>
            <p className="text-sm text-earth-600 mt-1">
              {approvedIds.size} شارة معتمدة — {totalPoints} نقطة إجمالي
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("my")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === "my"
                  ? "bg-maroon-700 text-white"
                  : "bg-earth-100 text-earth-700 hover:bg-earth-200"
              }`}
            >
              شاراتي ({myAwardBadgeIds.size})
            </button>
            <button
              onClick={() => setTab("catalog")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                tab === "catalog"
                  ? "bg-maroon-700 text-white"
                  : "bg-earth-100 text-earth-700 hover:bg-earth-200"
              }`}
            >
              كتالوج الشارات
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                filterCategory === cat
                  ? "bg-maroon-700 text-white"
                  : "bg-earth-100 text-earth-600 hover:bg-earth-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stage filter (catalog tab only) */}
        {tab === "catalog" && (
          <div className="flex items-center gap-3 mt-2">
            <label className="text-xs font-bold text-earth-700">مرحلة الكشف:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-earth-300 bg-white px-3 py-1.5 text-xs font-bold text-earth-800 focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400"
            >
              <option value="my">مرحلتي{myMember?.scoutStage ? ` (${myMember.scoutStage})` : ""}</option>
              <option value="all">كل المراحل</option>
              {SCOUT_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {myMember?.scoutStage && stageFilter === "my" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-maroon-100 border border-maroon-200 px-2.5 py-0.5 text-[11px] font-bold text-maroon-800">
                🏕️ {myMember.scoutStage}
              </span>
            )}
          </div>
        )}

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((badge) => {
              const isApproved = approvedIds.has(badge.id);
              const isInProgress = inProgressIds.has(badge.id);
              const isSubmitted = submittedIds.has(badge.id);
              const isPendingStart = pendingStartIds.has(badge.id);
              const isRevoked = revokedIds.has(badge.id);
              const award = myAwards.find((a) => a.badge_id === badge.id);
              const canStart = !isApproved && !isInProgress && !isSubmitted && !isPendingStart;

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`relative cursor-pointer rounded-xl border-2 p-4 transition hover:shadow-lg ${
                  isApproved
                    ? "border-green-400 bg-green-50"
                    : isSubmitted
                    ? "border-blue-400 bg-blue-50"
                    : isInProgress
                    ? "border-amber-400 bg-amber-50"
                    : isPendingStart
                    ? "border-yellow-400 bg-yellow-50"
                    : isRevoked
                    ? "border-red-300 bg-red-50"
                    : "border-earth-200 bg-white hover:border-maroon-300"
                }`}
              >
                {/* Status indicator */}
                <div className="absolute top-3 left-3">
                  {isApproved && <span className="text-lg">✅</span>}
                  {isSubmitted && <span className="text-lg">🔒</span>}
                  {!isApproved && !isSubmitted && isInProgress && (
                    <span className="text-lg">⏳</span>
                  )}
                  {isPendingStart && <span className="text-lg">🟡</span>}
                  {isRevoked && <span className="text-lg">❌</span>}
                  {!isApproved && !isInProgress && !isSubmitted && !isPendingStart && !isRevoked && (
                    <span className="text-lg opacity-30">⚪</span>
                  )}
                </div>

                {/* Icon */}
                <div className="flex justify-center mb-3 mt-2">
                  {badge.iconUrl ? (
                    <img src={badge.iconUrl} alt={badge.name} className="w-16 h-16 object-contain" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-maroon-100 flex items-center justify-center text-2xl">
                      🏅
                    </div>
                  )}
                </div>

                {/* Name & Category */}
                <h3 className="text-center font-bold text-earth-900 text-sm">{badge.name}</h3>
                <div className="flex justify-center gap-2 mt-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      BADGE_COLORS[badge.category] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {badge.category}
                  </span>
                  {badge.scoutStage && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-maroon-100 text-maroon-800">
                      {myMember?.scoutStage
                        ? stageForMember(badge.scoutStage, myMember.scoutStage)
                        : stagePairLabel(badge.scoutStage)}
                    </span>
                  )}
                </div>

                {/* Level & Points */}
	                <div className="flex justify-between mt-3 text-xs">
	                  <span className={`font-bold ${LEVEL_COLORS[badge.level] || "text-gray-600"}`}>
	                    {badge.level}
	                  </span>
	                  <span className="font-bold text-maroon-700">{badge.points} نقطة</span>
	                </div>

	                {/* Exam requirement tag */}
	                {badge.requiredExamId && (
	                  <div className="mt-2 text-center">
	                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
	                      📝 تتطلب امتحان
	                    </span>
	                  </div>
	                )}

                {/* Status actions / labels */}
                {isInProgress && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-earth-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: "50%" }} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvidenceModalAward(award);
                      }}
                      className="mt-1.5 w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition"
                    >
                      أكمل الشارة
                    </button>
                  </div>
                )}

                {isSubmitted && (
                  <div className="mt-2 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                      🔒 ⏳ قيد المراجعة
                    </span>
                  </div>
                )}

                {isPendingStart && (
                  <div className="mt-2 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
                      ⏳ في انتظار موافقة القائد
                    </span>
                  </div>
                )}

                {isApproved && award?.awarded_at && (
                  <p className="text-[10px] text-green-600 mt-2 text-center">
                    ✅ معتمدة — {new Date(award.awarded_at).toLocaleDateString("ar-EG")}
                  </p>
                )}

                {isRevoked && (
                  <p className="text-[10px] text-red-600 mt-2 text-center">❌ مرفوضة</p>
                )}

                {/* Start badge button */}
                {canStart && (
                  <button
                   
                    className="mt-2 w-full py-1.5 rounded-lg bg-maroon-700 hover:bg-maroon-800 text-white text-xs font-bold transition"
                  >
                   أقراء البنود وابدأ الشارة
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && tab === "my" && (
          <div className="text-center py-16 text-earth-500">لم تحصل على أي شارات بعد</div>
        )}
        {filtered.length === 0 && tab === "catalog" && (
          <div className="text-center py-16 text-earth-500">مفيش شارات في الفئة دي</div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-xl text-sm font-bold transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-extrabold text-maroon-900">{selectedBadge.name}</h2>
              <button
                onClick={() => setSelectedBadge(null)}
                className="text-earth-400 hover:text-earth-700 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${
                  BADGE_COLORS[selectedBadge.category] || "bg-gray-100"
                }`}
              >
                {selectedBadge.category}
              </span>
              <span className={`text-xs font-bold ${LEVEL_COLORS[selectedBadge.level]}`}>
                {selectedBadge.level}
              </span>
              <span className="text-xs font-bold text-maroon-700">
                {selectedBadge.points} نقطة
              </span>
            </div>

            {/* Exam requirement info */}
            {selectedBadge.requiredExamId && (() => {
              const exam = exams?.find((e) => e.id === selectedBadge.requiredExamId);
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 space-y-1">
                  <p className="font-bold">📝 هذه الشارة تتطلب اجتياز امتحان</p>
                  {exam && <p>الامتحان: <strong>{exam.title}</strong></p>}
                </div>
              );
            })()}

            {selectedBadge.description && (
              <p className="text-sm text-earth-700">{selectedBadge.description}</p>
            )}

            {selectedBadge.requirements && (
              <div>
                <h3 className="font-bold text-earth-900 text-sm mb-2">📋 المتطلبات</h3>
                <div className="text-sm text-earth-700 whitespace-pre-line leading-relaxed bg-earth-50 rounded-lg p-4">
                  {selectedBadge.requirements}
                </div>
              </div>
            )}

            {approvedIds.has(selectedBadge.id) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                ✅ لديك هذه الشارة!
              </div>
            )}
            {inProgressIds.has(selectedBadge.id) && (() => {
              const award = myAwards.find((a) => a.badge_id === selectedBadge.id);
              return (
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    ⏳ تعمل على هذه الشارة حالياً
                  </div>
                  <button
                    onClick={() => {
                      setSelectedBadge(null);
                      setEvidenceModalAward(award);
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition"
                  >
                    أكمل الشارة
                  </button>
                </div>
              );
            })()}
            {submittedIds.has(selectedBadge.id) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                🔒 ⏳ قيد المراجعة — تم تقديم الأدلّة
              </div>
            )}
            {pendingStartIds.has(selectedBadge.id) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                ⏳ في انتظار موافقة القائد — لن يمكنك ملء الاستمارة إلا بعد الموافقة
              </div>
            )}
            {revokedIds.has(selectedBadge.id) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ❌ مرفوضة
              </div>
            )}
            {!approvedIds.has(selectedBadge.id) &&
              !inProgressIds.has(selectedBadge.id) &&
              !submittedIds.has(selectedBadge.id) &&
              !pendingStartIds.has(selectedBadge.id) &&
              !revokedIds.has(selectedBadge.id) && (
                <button
                  onClick={() => {
                    setSelectedBadge(null);
                    startBadge(selectedBadge);
                  }}
                  className="w-full py-2 rounded-xl bg-maroon-700 hover:bg-maroon-800 text-white font-bold text-sm transition"
                >
                  طلب الشارة
                </button>
              )}
          </div>
        </div>
      )}

      {/* Application Submission Modal */}
      {evidenceModalAward && (
        <ApplicationFormModal
          award={evidenceModalAward}
          badge={evidenceModalAward.badges || badges.find((b) => b.id === evidenceModalAward.badge_id)}
          exams={exams}
          onClose={() => setEvidenceModalAward(null)}
          onSubmit={handleSubmitEvidence}
        />
      )}
    </MemberLayout>
  );
}
