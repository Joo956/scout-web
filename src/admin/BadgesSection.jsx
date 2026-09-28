import { useState, useMemo, useEffect } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
} from "./icons.jsx";
import {
  Badge,
  Card,
  ConfirmDialog,
  Field,
  Modal,
  inputCls,
  fmtDate,
} from "./ui.jsx";
import {
  BADGE_CATEGORIES,
  BADGE_LEVELS,
  SCOUT_STAGES,
  loadCustomBadgeCategories,
  saveCustomBadgeCategory,
} from "./badges-seed.js";
import { stagePairLabel, stageMatches } from "../utils/stages.js";
import { sanitizeObject } from "../utils/sanitizeInput.js";
import { useStore } from "../store.jsx";
import { useDebounce } from "../hooks/useDebounce.js";

const PAGE_SIZE = 12;

const BADGE_STATUSES = ["نشط", "متوقف", "مسودة"];
const AWARD_STATUSES = ["pending_start", "in_progress", "submitted", "approved", "revoked"];

const STATUS_TONE = {
  "نشط": "green",
  "متوقف": "gold",
  "مسودة": "gray",
};

const LEVEL_TONE = {
  "مبتدئ": "green",
  "متوسط": "blue",
  "متقدم": "maroon",
  "متخصص": "gold",
};

const AWARD_STATUS_LABEL = {
  pending_start: "طلب بدء",
  in_progress: "قيد العمل",
  submitted: "تم التقديم",
  approved: "معتمد",
  revoked: "ملغي",
};

const AWARD_STATUS_TONE = {
  pending_start: "yellow",
  in_progress: "amber",
  submitted: "blue",
  approved: "green",
  revoked: "red",
};

function ModalActions({ onClose, submitLabel, busy }) {
  return (
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
        disabled={busy}
        className="cursor-pointer rounded-lg bg-maroon-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "جاري الحفظ..." : submitLabel}
      </button>
    </div>
  );
}

/* ───────────── Badge Form Modal ───────────── */
const ADD_CATEGORY_SENTINEL = "__add_new__";

function BadgeFormModal({ initial, exams, categories = BADGE_CATEGORIES, onAddCategory, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial ?? {
      name: "",
      nameEn: "",
      category: BADGE_CATEGORIES[0] ?? "",
      description: "",
      requirements: "",
      level: BADGE_LEVELS[0] ?? "",
      points: "",
      iconUrl: "",
      status: "نشط",
      visible: true,
      scoutStage: "",
      requiredExamId: "",
      applicationFields: [],
    }
  );
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleCategoryChange = (e) => {
    if (e.target.value === ADD_CATEGORY_SENTINEL) {
      setAddingCategory(true);
      return;
    }
    setAddingCategory(false);
    setNewCategory("");
    setForm((f) => ({ ...f, category: e.target.value }));
  };

  const confirmAddCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    if (!categories.includes(name)) onAddCategory?.(name);
    setForm((f) => ({ ...f, category: name }));
    setAddingCategory(false);
    setNewCategory("");
  };

  /* ── Application fields helpers ── */
  const FIELD_TYPES = [
    { value: "text", label: "نص قصير" },
    { value: "textarea", label: "نص طويل" },
    { value: "url", label: "رابط" },
    { value: "image", label: "صورة" },
    { value: "number", label: "رقم" },
  ];

  const addAppField = () => {
    setForm((f) => ({
      ...f,
      applicationFields: [
        ...(f.applicationFields ?? []),
        { key: "", label: "", type: "text", required: false },
      ],
    }));
  };

  const updateAppField = (index, field, value) => {
    setForm((f) => ({
      ...f,
      applicationFields: (f.applicationFields ?? []).map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeAppField = (index) => {
    setForm((f) => ({
      ...f,
      applicationFields: (f.applicationFields ?? []).filter((_, i) => i !== index),
    }));
  };

  const moveAppField = (index, direction) => {
    setForm((f) => {
      const arr = [...(f.applicationFields ?? [])];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= arr.length) return f;
      [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
      return { ...f, applicationFields: arr };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "اسم الشارة مطلوب.";
    if (!form.category) next.category = "اختر التصنيف.";
    if (!form.level) next.level = "اختر المستوى.";
    if (form.points === "" || Number(form.points) < 0)
      next.points = "أدخل عدد نقاط صحيح.";
    // Validate application fields: each must have key and label
    const appFields = form.applicationFields ?? [];
    const fieldErrors = [];
    appFields.forEach((f, i) => {
      if (!f.key?.trim()) fieldErrors[i] = { ...fieldErrors[i], key: "مطلوب" };
      if (!f.label?.trim()) fieldErrors[i] = { ...fieldErrors[i], label: "مطلوب" };
    });
    if (fieldErrors.some(Boolean)) next.appFields = fieldErrors;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        category: form.category,
        description: form.description.trim(),
        requirements: form.requirements.trim(),
        level: form.level,
        points: Number(form.points),
        iconUrl: form.iconUrl.trim(),
        status: form.status || "نشط",
        // المرحلة بتتخزن كزوج (مذكر / مؤنث) — القيم القديمة بتتطابق بمفتاح الزوج
        scoutStage: stagePairLabel(form.scoutStage) || "",
        requiredExamId: form.requiredExamId || null,
        applicationFields: appFields.map((f) => ({
          ...f,
          key: f.key.trim(),
          label: f.label.trim(),
        })),
      });
    } finally {
      setBusy(false);
    }
  };

  const appFields = form.applicationFields ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل الشارة" : "إضافة شارة"}
      subtitle="إدارة شارات الاستحقاق والهوايات الكشفية."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الشارة (عربي)" required error={errors.name}>
            <input
              className={inputCls}
              value={form.name}
              onChange={set("name")}
              placeholder="مثال: شارة الملاح البري"
            />
          </Field>
          <Field label="اسم الشارة (إنجليزي)">
            <input
              className={inputCls}
              value={form.nameEn}
              onChange={set("nameEn")}
              placeholder="e.g. Land Navigation Badge"
              dir="ltr"
            />
          </Field>
        </div>
        <Field label="مرحلة الكشف">
          <select
            className={inputCls}
            value={form.scoutStage || ""}
            onChange={set("scoutStage")}
          >
            <option value="">كل المراحل</option>
            {SCOUT_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {/* قيم قديمة متخزنة بنسخة واحدة (مثلاً "جوالة") — نعرضها كزوج */}
            {form.scoutStage && !SCOUT_STAGES.includes(form.scoutStage) && (
              <option value={form.scoutStage}>{stagePairLabel(form.scoutStage)}</option>
            )}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="التصنيف" required error={errors.category}>
            <select
              className={inputCls}
              value={form.category || ""}
              onChange={handleCategoryChange}
            >
              <option value="">اختر التصنيف</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={ADD_CATEGORY_SENTINEL}>➕ إضافة تصنيف جديد...</option>
            </select>
            {addingCategory && (
              <div className="mt-2 space-y-2">
                <input
                  className={inputCls}
                  value={newCategory}
                  autoFocus
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmAddCategory();
                    }
                  }}
                  placeholder="اسم التصنيف الجديد"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={confirmAddCategory}
                    disabled={!newCategory.trim()}
                    className="cursor-pointer rounded-lg bg-maroon-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategory("");
                    }}
                    className="cursor-pointer rounded-lg border border-earth-200 px-3 py-2 text-sm font-semibold text-earth-700 transition hover:bg-earth-100"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </Field>
          <Field label="المستوى" required error={errors.level}>
            <select
              className={inputCls}
              value={form.level || ""}
              onChange={set("level")}
            >
              <option value="">اختر المستوى</option>
              {BADGE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <select
              className={inputCls}
              value={form.status || ""}
              onChange={set("status")}
            >
              {BADGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-earth-700">
              <input
                type="checkbox"
                checked={form.visible ?? true}
                onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))}
                className="rounded border-earth-300 text-maroon-700 focus:ring-maroon-500"
              />
              ظاهر للأعضاء
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="النقاط" required error={errors.points}>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="1"
              value={form.points}
              onChange={set("points")}
              placeholder="0"
            />
          </Field>
          <Field label="رابط الأيقونة">
            <input
              className={inputCls}
              value={form.iconUrl}
              onChange={set("iconUrl")}
              placeholder="https://..."
              dir="ltr"
            />
          </Field>
        </div>

        <Field label="الوصف">
          <textarea
            className={`${inputCls} min-h-20`}
            value={form.description}
            onChange={set("description")}
            placeholder="وصف مختصر للشارة ومجالها."
          />
        </Field>

        <Field label="المتطلبات">
          <textarea
            className={`${inputCls} min-h-28`}
            value={form.requirements}
            onChange={set("requirements")}
            placeholder="1. المتطلب الأول&#10;2. المتطلب الثاني&#10;..."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الامتحان المطلوب (اختياري)">
            <select
              className={inputCls}
              value={form.requiredExamId || ""}
              onChange={set("requiredExamId")}
            >
              <option value="">بدون امتحان</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ModalActions
          onClose={onClose}
          submitLabel={isEdit ? "حفظ التغييرات" : "إضافة شارة"}
          busy={busy}
        />
      </form>
    </Modal>
  );
}

/* ───────────── Grant Badge Modal ───────────── */
function GrantBadgeModal({ badges, members, onClose, onSubmit }) {
  const [badgeId, setBadgeId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebounce(memberSearch, 300);

  const [stageFilter, setStageFilter] = useState("");

  const uniqueStages = useMemo(
    () => [...new Set(members.map((m) => m.scoutStage).filter(Boolean))].sort(),
    [members]
  );

  const filteredMembers = useMemo(
    () =>
      members
        // المطابقة بمفتاح الزوج: مرحلة "جوال / جوالة" بتشمل "جوال" و"جوالة"
        .filter((m) => !stageFilter || stageMatches(stageFilter, m.scoutStage))
        .filter((m) =>
          `${m.name} ${m.scoutCode || ""}`
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase())
        ),
    [members, stageFilter, debouncedSearch]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!badgeId) next.badgeId = "اختر الشارة.";
    if (!memberId) next.memberId = "اختر العضو.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await onSubmit(badgeId, memberId, notes.trim());
    } finally {
      setBusy(false);
    }
  };

  const selectedBadge = badges.find((b) => b.id === badgeId);

  return (
    <Modal
      open
      onClose={onClose}
      title="منح شارة لعضو"
      subtitle="اختر الشارة والعضو لتمنحه الشارة مباشرة."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="الشارة" required error={errors.badgeId}>
          <select
            className={inputCls}
            value={badgeId}
            onChange={(e) => setBadgeId(e.target.value)}
          >
            <option value="">اختر الشارة</option>
            {badges
              .filter((b) => b.status === "نشط")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.category} — {b.level})
                </option>
              ))}
          </select>
        </Field>

        {selectedBadge && (
          <div className="rounded-lg bg-earth-50 px-3 py-2 text-xs text-earth-700 space-y-1">
            <p>
              <strong>التصنيف:</strong> {selectedBadge.category} •{" "}
              <strong>المستوى:</strong> {selectedBadge.level} •{" "}
              <strong>النقاط:</strong> {selectedBadge.points}
            </p>
          </div>
        )}

        <Field label="مرحلة الكشافة">
          <select
            className={inputCls}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="">جميع المراحل</option>
            {uniqueStages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="العضو" required error={errors.memberId}>
          <input
            className={`${inputCls} mb-2`}
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الكود..."
          />
          <select
            className={inputCls}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            size={5}
          >
            {filteredMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.scoutCode ? `(${m.scoutCode})` : ""}
              </option>
            ))}
            {filteredMembers.length === 0 && (
              <option disabled>لا توجد نتائج</option>
            )}
          </select>
        </Field>

        <Field label="ملاحظات (اختياري)">
          <textarea
            className={`${inputCls} min-h-16`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات حول منح الشارة..."
          />
        </Field>

        <ModalActions onClose={onClose} submitLabel="منح الشارة" busy={busy} />
      </form>
    </Modal>
  );
}

/* ───────────── Review Awards Sub-tab ───────────── */
function ReviewAwards({ awards, onRevoke, onUpdateStatus, readOnly }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return awards;
    return awards.filter((a) => a.status === statusFilter);
  }, [awards, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    setRevoking(pendingRevoke.id);
    try {
      await onRevoke(pendingRevoke.id, revokeReason.trim() || "إلغاء بواسطة المدير");
    } finally {
      setRevoking(null);
      setRevokeReason("");
      setPendingRevoke(null);
    }
  };

  const handleApprove = async (award) => {
    try {
      await onUpdateStatus(award.id, { status: "approved" });
    } catch {
      /* error handled by toast */
    }
  };

  const handleApproveStart = async (award) => {
    try {
      await onUpdateStatus(award.id, { status: "in_progress" });
    } catch {
      /* error handled by toast */
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-maroon-900">سجل منح الشارات</h3>
          <p className="mt-1 text-sm text-earth-600">
            مراجعة وإدارة الشارات الممنوحة للأعضاء ({awards.length} منحة)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputCls} w-40`}
          >
            <option value="all">كل الحالات</option>
            <option value="pending_start">طلب بدء</option>
            <option value="in_progress">قيد العمل</option>
            <option value="submitted">تم التقديم</option>
            <option value="approved">معتمد</option>
            <option value="revoked">ملغي</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto p-5 pt-4">
        <table className="w-full min-w-[650px] text-right text-sm">
          <thead>
            <tr className="border-b-2 border-maroon-100 text-sm font-bold text-maroon-900 uppercase tracking-wide">
              <th className="pb-3 px-4 w-[25%]">الشارة</th>
              <th className="pb-3 px-4 w-[20%]">العضو</th>
              <th className="pb-3 px-4 w-[15%]">الحالة</th>
              <th className="pb-3 px-4 w-[15%]">التاريخ</th>
              <th className="pb-3 px-4 w-[15%]">ملاحظات</th>
              <th className="pb-3 px-4 w-[10%] text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-earth-100">
            {rows.map((a) => (
              <tr key={a.id} className="transition hover:bg-maroon-50/40">
                <td className="py-3 px-4 align-middle">
                  <div className="flex items-center gap-2">
                    {a.badges?.icon_url ? (
                      <img
                        src={a.badges.icon_url}
                        alt=""
                        className="h-8 w-8 rounded-lg border border-maroon-100 object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-maroon-100 bg-maroon-50 text-base">
                        🏅
                      </span>
                    )}
                    <div>
                      <span className="font-bold text-earth-900 text-sm block leading-tight">
                        {a.badges?.name || "—"}
                      </span>
                      <span className="text-xs text-earth-500">
                        {a.badges?.category} • {a.badges?.level}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 align-middle">
                  <span className="font-medium text-earth-800 text-sm">
                    {a.members?.name || "—"}
                  </span>
                  {a.members?.scout_code && (
                    <span className="block text-xs text-earth-500 font-mono">
                      {a.members.scout_code}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 align-middle">
                  <Badge tone={AWARD_STATUS_TONE[a.status] ?? "gray"}>
                    {AWARD_STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 align-middle text-xs text-earth-600">
                  {a.awarded_at
                    ? fmtDate(a.awarded_at.slice(0, 10))
                    : a.created_at
                      ? fmtDate(a.created_at.slice(0, 10))
                      : "—"}
                </td>
                <td className="py-3 px-4 align-middle text-xs text-earth-600 max-w-[150px] truncate">
                  {a.notes || "—"}
                </td>
                <td className="py-3 px-4 align-middle text-center">
                  {readOnly ? (
                    <span className="text-xs font-semibold text-earth-400">—</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      {a.status === "pending_start" && (
                        <button
                          type="button"
                          onClick={() => handleApproveStart(a)}
                          className="cursor-pointer rounded-lg p-1.5 text-green-600 transition hover:bg-green-50"
                          title="موافقة على الطلب"
                        >
                          ✅
                        </button>
                      )}
                      {a.status === "pending_start" && (
                        <button
                          type="button"
                          onClick={() => setPendingRevoke(a)}
                          className="cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                          title="رفض الطلب"
                        >
                          🚫
                        </button>
                      )}
                      {a.status === "submitted" && (
                        <button
                          type="button"
                          onClick={() => handleApprove(a)}
                          className="cursor-pointer rounded-lg p-1.5 text-green-600 transition hover:bg-green-50"
                          title="اعتماد"
                        >
                          ✅
                        </button>
                      )}
                      {a.status !== "revoked" && a.status !== "pending_start" && (
                        <button
                          type="button"
                          onClick={() => setPendingRevoke(a)}
                          className="cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                          title="إلغاء المنحة"
                        >
                          🚫
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="6" className="py-12 text-center">
                  <div className="text-earth-300 text-4xl mb-3">📋</div>
                  <p className="text-earth-600 font-medium text-base">
                    لا توجد منحات مطابقة
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-maroon-100 px-5 py-4 text-sm text-earth-600 sm:flex-row">
          <span>
            عرض{" "}
            <strong className="text-maroon-900">
              {(safePage - 1) * PAGE_SIZE + 1} –{" "}
              {Math.min(safePage * PAGE_SIZE, filtered.length)}
            </strong>{" "}
            من <strong className="text-maroon-900">{filtered.length}</strong> منحة
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
              className="cursor-pointer rounded-md border border-earth-200 px-3 py-1.5 font-semibold transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              السابق
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`cursor-pointer rounded-md border px-3 py-1.5 font-semibold transition ${n === safePage
                  ? "border-maroon-700 bg-maroon-700 text-white"
                  : "border-earth-200 hover:bg-earth-100"
                  }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={safePage === pages}
              onClick={() => setPage(safePage + 1)}
              className="cursor-pointer rounded-md border border-earth-200 px-3 py-1.5 font-semibold transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        title="إلغاء منحة شارة"
        message={
          pendingRevoke
            ? `هل أنت متأكد من إلغاء منحة "${pendingRevoke.badges?.name || "الشارة"}" من "${pendingRevoke.members?.name || "العضو"}"؟`
            : ""
        }
        confirmLabel="إلغاء المنحة"
        onCancel={() => {
          setPendingRevoke(null);
          setRevokeReason("");
        }}
        onConfirm={handleRevoke}
      />
    </Card>
  );
}

/* ───────────── Main BadgesSection ───────────── */
export default function BadgesSection({ readOnly = false }) {
  const {
    badges,
    badgeAwards,
    members,
    exams,
    addBadge,
    updateBadge,
    deleteBadge,
    awardBadge,
    revokeBadge,
    updateBadgeAward,
    seedBadges,
  } = useStore();

  const [activeTab, setActiveTab] = useState("badges");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scoutStageFilter, setScoutStageFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // التصنيفات: الأساسية + المضافة من المسئول + أي تصنيف مستخدم في شارة قائمة
  const [customCategories, setCustomCategories] = useState(() => loadCustomBadgeCategories());
  const allCategories = useMemo(() => {
    const set = new Set(BADGE_CATEGORIES);
    customCategories.forEach((c) => set.add(c));
    badges.forEach((b) => b.category && set.add(b.category));
    return [...set];
  }, [badges, customCategories]);
  const handleAddCategory = (name) => setCustomCategories(saveCustomBadgeCategory(name));

  // Stats
  const stats = useMemo(() => {
    const totalBadges = badges.length;
    const totalAwards = badgeAwards.length;
    // Most popular badge by award count
    const awardCounts = {};
    badgeAwards
      .filter((a) => a.status === "approved" || a.status === "pending")
      .forEach((a) => {
        const id = a.badge_id;
        awardCounts[id] = (awardCounts[id] || 0) + 1;
      });
    let popularId = null;
    let popularCount = 0;
    for (const [id, count] of Object.entries(awardCounts)) {
      if (count > popularCount) {
        popularCount = count;
        popularId = id;
      }
    }
    const popularBadge = badges.find((b) => b.id === popularId);
    const totalPoints = badges.reduce((sum, b) => sum + (b.points || 0), 0);
    const activeBadges = badges.filter((b) => b.status === "نشط").length;
    return { totalBadges, totalAwards, popularBadge, popularCount, totalPoints, activeBadges };
  }, [badges, badgeAwards]);

  // Filtered badges
  const filtered = useMemo(() => {
    return badges.filter((b) => {
      const matchesQuery =
        `${b.name} ${b.nameEn || ""} ${b.category} ${b.level}`
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || b.category === categoryFilter;
      const matchesStage =
        scoutStageFilter === "all" || b.scoutStage === scoutStageFilter;
      return matchesQuery && matchesCategory && matchesStage;
    });
  }, [badges, debouncedQuery, categoryFilter, scoutStageFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, categoryFilter, scoutStageFilter]);

  // Badge form submit
  const handleBadgeSubmit = async (data) => {
    setBusy(true);
    setNotice(null);
    try {
      const clean = sanitizeObject(data, ["iconUrl"]);
      if (modal.initial) {
        await updateBadge(modal.initial.id, clean);
        setNotice({ type: "success", message: "تم تحديث الشارة بنجاح." });
      } else {
        await addBadge(clean);
        setNotice({ type: "success", message: "تم إضافة الشارة بنجاح." });
      }
      setModal(null);
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل ${modal.initial ? "تحديث" : "إضافة"} الشارة: ${err?.message || err}`,
      });
    } finally {
      setBusy(false);
    }
  };

  // Delete badge
  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteBadge(pendingDelete.id);
      setNotice({ type: "success", message: "تم حذف الشارة بنجاح." });
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل حذف الشارة: ${err?.message || err}`,
      });
    } finally {
      setPendingDelete(null);
    }
  };

  // Grant badge submit
  const handleGrant = async (badgeId, memberId, notes) => {
    setBusy(true);
    setNotice(null);
    try {
      await awardBadge(badgeId, memberId, notes);
      setNotice({ type: "success", message: "تم منح الشارة بنجاح." });
      setModal(null);
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل منح الشارة: ${err?.message || err}`,
      });
    } finally {
      setBusy(false);
    }
  };

  // Seed badges
  const handleSeed = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await seedBadges();
      setNotice({
        type: "success",
        message: `تم إضافة ${result.inserted} شارة جديدة (${result.skipped} موجودة مسبقاً).`,
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل تهيئة الشارات: ${err?.message || err}`,
      });
    } finally {
      setBusy(false);
    }
  };

  // Revoke badge award
  const handleRevokeAward = async (awardId, reason) => {
    try {
      await revokeBadge(awardId, reason);
      setNotice({ type: "success", message: "تم إلغاء المنحة." });
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل إلغاء المنحة: ${err?.message || err}`,
      });
    }
  };

  // Update award status
  const handleUpdateAwardStatus = async (awardId, updates) => {
    try {
      await updateBadgeAward(awardId, updates);
      setNotice({ type: "success", message: "تم تحديث حالة المنحة." });
    } catch (err) {
      setNotice({
        type: "error",
        message: `فشل تحديث المنحة: ${err?.message || err}`,
      });
    }
  };

  const dismissNotice = () => setNotice(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-maroon-100 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-maroon-900 flex items-center gap-2">
            🏅 إدارة الشارات
          </h2>
          <p className="text-sm text-earth-600 mt-1">
            شارات الاستحقاق والهوايات الكشفية
          </p>
        </div>

        <div className="flex bg-earth-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("badges")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === "badges"
              ? "bg-white text-maroon-800 shadow-sm"
              : "text-earth-600 hover:text-maroon-700"
              }`}
          >
            🏅 الشارات
          </button>
          <button
            onClick={() => setActiveTab("awards")}
            className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === "awards"
              ? "bg-white text-maroon-800 shadow-sm"
              : "text-earth-600 hover:text-maroon-700"
              }`}
          >
            📋 المراجعات
          </button>
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${notice.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
            }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={dismissNotice}
            className="shrink-0 leading-none opacity-60 hover:opacity-100"
            title="إخفاء"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-maroon-700 to-maroon-900 text-white rounded-xl p-4 shadow-lg ring-2 ring-maroon-500/30">
          <div className="text-3xl font-extrabold">{stats.totalBadges}</div>
          <div className="text-sm opacity-90 mt-1">إجمالي الشارات</div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-800 text-white rounded-xl p-4 shadow-lg">
          <div className="text-3xl font-extrabold">{stats.activeBadges}</div>
          <div className="text-sm opacity-90 mt-1">شارات نشطة</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl p-4 shadow-lg">
          <div className="text-3xl font-extrabold">{stats.totalAwards}</div>
          <div className="text-sm opacity-90 mt-1">إجمالي المنحات</div>
        </div>
        <div className="bg-gradient-to-br from-gold-600 to-gold-800 text-white rounded-xl p-4 shadow-lg">
          <div className="text-3xl font-extrabold">{stats.totalPoints}</div>
          <div className="text-sm opacity-90 mt-1">إجمالي النقاط</div>
        </div>
        <div className="bg-gradient-to-br from-earth-600 to-earth-800 text-white rounded-xl p-4 shadow-lg">
          <div className="text-lg font-extrabold leading-tight">
            {stats.popularBadge?.name || "—"}
          </div>
          <div className="text-sm opacity-90 mt-1">
            الأكثر منحاً{stats.popularCount > 0 ? ` (${stats.popularCount})` : ""}
          </div>
        </div>
      </div>

      {/* Badges Tab */}
      {activeTab === "badges" && (
        <Card>
          <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-maroon-900">شارات الاستحقاق</h3>
              <p className="mt-1 text-sm text-earth-600">
                إدارة شارات الهوايات والمهارات الكشفية ({badges.length} شارة)
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو التصنيف..."
                  className={`${inputCls} pr-9 sm:w-56 text-right`}
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">كل التصنيفات</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={scoutStageFilter}
                onChange={(e) => setScoutStageFilter(e.target.value)}
                className={inputCls}
              >
                <option value="all">كل المراحل</option>
                {SCOUT_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "add" })}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800 active:scale-[0.98]"
                  >
                    <PlusIcon className="h-4 w-4" /> إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ kind: "grant" })}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-maroon-200 px-4 py-2.5 text-sm font-bold text-maroon-700 transition hover:bg-maroon-50"
                  >
                    🎯 منح شارة
                  </button>
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={busy}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-earth-300 px-4 py-2.5 text-sm font-bold text-earth-700 transition hover:bg-earth-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🌱 تهيئة الشارات
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Badge Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5 pt-4">
            {rows.map((b) => (
              <div
                key={b.id}
                className="group rounded-xl border border-earth-200 bg-white p-4 shadow-xs transition hover:border-maroon-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  {b.iconUrl ? (
                    <img
                      src={b.iconUrl}
                      alt={b.name}
                      className="h-12 w-12 rounded-lg border border-maroon-100 object-cover shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-maroon-100 bg-maroon-50 text-2xl shadow-sm shrink-0">
                      🏅
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-earth-900 text-sm leading-tight truncate">
                      {b.name}
                    </h4>
                    {b.nameEn && (
                      <p className="text-xs text-earth-500 truncate mt-0.5" dir="ltr">
                        {b.nameEn}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[b.status] ?? "gray"}>
                    {b.status}
                  </Badge>
                  <Badge tone={LEVEL_TONE[b.level] ?? "gray"}>
                    {b.level}
                  </Badge>
                  <Badge tone="earth">{b.category}</Badge>
                  {b.scoutStage && (
                    <Badge tone="maroon">{stagePairLabel(b.scoutStage)}</Badge>
                  )}
                  {b.visible === false && (
                    <Badge tone="gray">👁️‍🗨️ مخفي</Badge>
                  )}
                </div>

                {b.description && (
                  <p className="mt-2 text-xs text-earth-600 line-clamp-2 leading-relaxed">
                    {b.description}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-gold-50 border border-gold-200 px-2.5 py-1 text-xs font-bold text-gold-800">
                    ⭐ {b.points} نقطة
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`تعديل ${b.name}`}
                        onClick={() => setModal({ kind: "edit", initial: b })}
                        className="cursor-pointer rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-50"
                        title="تعديل"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`حذف ${b.name}`}
                        onClick={() => setPendingDelete(b)}
                        className="cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {b.requiredExamId && (
                  <p className="mt-2 text-[10px] text-earth-500">
                    📝 يتطلب امتحان
                  </p>
                )}
              </div>
            ))}
            {rows.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <div className="text-earth-300 text-4xl mb-3">🏅</div>
                <p className="text-earth-600 font-medium text-base">
                  لا توجد شارات مطابقة
                </p>
                <p className="text-earth-500 text-sm mt-1">
                  جرب تغيير البحث أو الفلتر أو أضف شارة جديدة
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-maroon-100 px-5 py-4 text-sm text-earth-600 sm:flex-row">
              <span>
                عرض{" "}
                <strong className="text-maroon-900">
                  {filtered.length === 0
                    ? 0
                    : (safePage - 1) * PAGE_SIZE + 1}{" "}
                  – {Math.min(safePage * PAGE_SIZE, filtered.length)}
                </strong>{" "}
                من أصل{" "}
                <strong className="text-maroon-900">{filtered.length}</strong>{" "}
                شارة
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                  className="cursor-pointer rounded-md border border-earth-200 px-3 py-1.5 font-semibold transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  السابق
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 font-semibold transition ${n === safePage
                      ? "border-maroon-700 bg-maroon-700 text-white"
                      : "border-earth-200 hover:bg-earth-100"
                      }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage === pages}
                  onClick={() => setPage(safePage + 1)}
                  className="cursor-pointer rounded-md border border-earth-200 px-3 py-1.5 font-semibold transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Awards Tab */}
      {activeTab === "awards" && (
        <ReviewAwards
          awards={badgeAwards}
          onRevoke={handleRevokeAward}
          onUpdateStatus={handleUpdateAwardStatus}
          readOnly={readOnly}
        />
      )}

      {/* ───── Modals ───── */}

      {modal?.kind === "add" && (
        <BadgeFormModal
          exams={exams}
          categories={allCategories}
          onAddCategory={handleAddCategory}
          onClose={() => setModal(null)}
          onSubmit={handleBadgeSubmit}
        />
      )}

      {modal?.kind === "edit" && (
        <BadgeFormModal
          initial={modal.initial}
          exams={exams}
          categories={allCategories}
          onAddCategory={handleAddCategory}
          onClose={() => setModal(null)}
          onSubmit={handleBadgeSubmit}
        />
      )}

      {modal?.kind === "grant" && (
        <GrantBadgeModal
          badges={badges}
          members={members}
          onClose={() => setModal(null)}
          onSubmit={handleGrant}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف الشارة"
        message={
          pendingDelete
            ? `هل أنت متأكد من حذف "${pendingDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
