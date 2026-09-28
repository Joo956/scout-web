import { useEffect, useState } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  PinIcon,
  ClipboardIcon,
} from "./icons.jsx";
import { Badge, Card, ConfirmDialog, Field, Modal, fmtDate, inputCls } from "./ui.jsx";
import { parseLinks as _parseLinks, buildLinksValue as _buildLinksValue, isImageUrl } from "../utils/imageLinks.js";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput.js";

const NEWS_CATEGORY_LABELS = {
  Community: "مجتمع",
  Program: "برنامج",
  Store: "متجر",
  Exams: "امتحانات",
  General: "عام",
};

// ✅ المراحل الكشفية المتاحة لتحديد موجه الخبر
const SCOUT_STAGES_OPTIONS = [
  { value: "الكل", label: "🌐 الكل (عام لكل المراحل)" },
  { value: "أشبال", label: "🐺 أشبال" },
  { value: "زهرات", label: "🌸 زهرات" },
  { value: "كشاف", label: "⚜️ كشاف" },
  { value: "مرشدات", label: "🌼 مرشدات" },
  { value: "متقدم", label: "🎒 متقدم" },
  { value: "رائدات", label: "🎒 رائدات" },
  { value: "جوالة", label: "🧭 جوالة" },
  { value: "قادة", label: "🎖️ قادة" },
];

// ✅ الحد الأقصى لعدد الروابط
const MAX_LINKS = 10;

// ✅ معاينة حية للرابط + تحذير واضح لو الصورة مش هتظهر
function LinkPreview({ url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url?.trim()) return null;
  if (!isImageUrl(url)) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
        ⚠️ الرابط ده مش هيظهر كصورة — الأعضاء هيشوفوه زر بس. عشان تظهر صورة لازم رابط مباشر بينتهي بـ jpg / png / webp
      </p>
    );
  }
  return (
    <div>
      <img
        src={url}
        alt="معاينة"
        dir="ltr"
        className="h-20 rounded-lg border border-earth-200 object-cover"
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {failed && (
        <p className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
          ⚠️ الصورة مش هتظهر للأعضاء — المتصفح مقدرش يحمّلها (الرابط بايظ أو مؤقت أو محجوب). جرّب تفتحه في تاب جديد، ولو فتح مش كصورة يبقى استبدله.
        </p>
      )}
    </div>
  );
}

export const parseLinks = _parseLinks;
export const buildLinksValue = _buildLinksValue;

// ✅ مصغّرة قايمة الإعلانات — لو الصورة بايظة تظهر تحذير بدل ما تختفي
function ListThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (failed) {
    return (
      <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
        ⚠️ الصورة مش هتظهر
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-16 rounded-lg border border-earth-200 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function NewsFormModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  // ✅ تحليل الروابط من imageUrl القديم (links:// prefix)
  const initialLinks = parseLinks(initial?.imageUrl) ?? [];
  const [form, setForm] = useState(
    initial ?? {
      title: "",
      body: "",
      description: "",
      category: "Community",
      targetStage: "الكل", // 👈 إضافة الخاصية المبدئية للمرحلة
      imageUrl: "",
      pinned: false,
    }
  );
  // ✅ روابط متعددة: مصفوفة { url, label }
  const [links, setLinks] = useState(
    initialLinks.length > 0
      ? initialLinks
      : [{ url: "", label: "" }]
  );
  const [attachForm, setAttachForm] = useState(Boolean(initial?.form));
  const [formFields, setFormFields] = useState(
    () => initial?.form?.fields.map((f) => f.label).join("\n") ?? ""
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const addLink = () => {
    if (links.length >= MAX_LINKS) return;
    setLinks((prev) => [...prev, { url: "", label: "" }]);
  };

  const removeLink = (idx) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLink = (idx, field, value) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = "العنوان مطلوب.";
    if (!form.body.trim()) next.body = "نص الإعلان مطلوب.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      // ✅ بناء قيمة imageUrl من الروابط
      const validLinks = links
        .filter((l) => l.url.trim())
        .map((l) => ({ url: l.url.trim(), label: (l.label ?? "").trim() }));
      const imageUrl = buildLinksValue(validLinks);

      const attachedForm = attachForm
        ? {
            fields: formFields
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((label) => ({ label })),
          }
        : null;
      onSubmit({
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category || "General",
        targetStage: form.targetStage || "الكل", // 👈 حفظ المرحلة المحددة
        description: (form.description ?? "").trim(),
        imageUrl,
        form: attachedForm,
      });
    } catch (err) {
      // لا حاجة لمعالجة خاصة — الخطأ يظهر كـ exception
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل الإعلان" : "نشر إعلان"}
      subtitle="يُنشر فوراً للأعضاء المحددين حسب المرحلة."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="العنوان" required error={errors.title}>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="مثال: فتح تسجيل المعسكر الصيفي يوم الجمعة"
          />
        </Field>

        {/* 🎯 اختيار المرحلة الموجه لها الخبر */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المرحلة الموجه لها الخبر">
            <select
              className={inputCls}
              value={form.targetStage ?? "الكل"}
              onChange={(e) => setForm((f) => ({ ...f, targetStage: e.target.value }))}
            >
              {SCOUT_STAGES_OPTIONS.map((stg) => (
                <option key={stg.value} value={stg.value}>
                  {stg.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end pb-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-earth-800">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                className="h-4 w-4 cursor-pointer rounded border-earth-300 accent-maroon-600"
              />
              تثبيت أعلى الصفحة📌
            </label>
          </div>
        </div>

        <Field label="النص" required error={errors.body}>
          <textarea
            className={`${inputCls} min-h-[140px] resize-y`}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="اكتب تفاصيل الإعلان..."
          />
        </Field>

        <Field label="وصف مختصر">
          <textarea
            rows={2}
            className={`${inputCls} min-h-[52px] resize-y`}
            value={form.description ?? ""}
            onChange={set("description")}
            placeholder="سطرين ملخصين الخبر — بيظهروا على كرت الخبر تحت العنوان."
          />
        </Field>

        <Field label="روابط">
          <div className="space-y-2.5">
            {links.map((lnk, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="grid flex-1 gap-1.5 sm:grid-cols-2">
                  <input
                    className={inputCls}
                    value={lnk.url}
                    onChange={(e) => updateLink(idx, "url", e.target.value)}
                    placeholder="https://example.com"
                    dir="ltr"
                  />
                  <input
                    className={inputCls}
                    value={lnk.label ?? ""}
                    onChange={(e) => updateLink(idx, "label", e.target.value)}
                    placeholder="عنوان الرابط (اختياري)"
                  />
                </div>
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    className="mt-1.5 cursor-pointer rounded-lg border border-red-200 px-2.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <button
                type="button"
                onClick={addLink}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-earth-200 px-3 py-2 text-xs font-bold text-maroon-700 transition hover:bg-maroon-50"
              >
                <PlusIcon className="h-3.5 w-3.5" /> إضافة رابط
              </button>
            )}
            {/* ✅ معاينة أول رابط صورة + تحذير لو مش هتظهر */}
            {links.filter((l) => l.url.trim()).map((l, i) => (
              <LinkPreview key={i} url={l.url} />
            ))}
            <p className="text-[11px] text-earth-500">
              أقصى عدد {MAX_LINKS} روابط — اكتب الرابط ثم عنوان اختياري يظهر بدل الرابط. الروابط اللي بتنتهي بـ .jpg / .png / .webp بتظهر كصور، وغيرها بتظهر كأزرار.
            </p>
          </div>
        </Field>

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
            disabled={saving}
            className="cursor-pointer rounded-lg bg-maroon-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التغييرات" : "نشر الإعلان"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function NewsSection({
  news,
  onAdd,
  onUpdate,
  onDelete,
  onViewSubmissions,
  readOnly = false,
}) {
  const [modal, setModal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const sorted = [...news].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-earth-600">
          {news.length} إعلان منشور
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setModal({ mode: "add" })}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-800 active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4" /> نشر إعلان
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sorted.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {/* روابط الخبر — عرض عدد الروابط بدل الصورة + تحذير لو مفيش صورة صالحة */}
                  {parseLinks(item.imageUrl) && (
                    parseLinks(item.imageUrl).some((l) => isImageUrl(typeof l === "string" ? l : l?.url))
                      ? <Badge tone="gray">🔗 {parseLinks(item.imageUrl).length} رابط</Badge>
                      : <Badge tone="gold">⚠️ مفيش صورة — الروابط هتظهر كأزرار</Badge>
                  )}
                  {/* صورة الخبر القديمة (لو مش links://) — backward compat */}
                  {item.imageUrl && !item.imageUrl.startsWith("links://") && (
                    isImageUrl(item.imageUrl)
                      ? <ListThumb src={item.imageUrl} alt={item.title} />
                      : <Badge tone="gold">⚠️ الرابط مش صورة مباشرة — مش هيظهر كصورة</Badge>
                  )}
                  {item.category && (
                    <Badge tone="gray">{NEWS_CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                  )}
                  {/* 🎯 إظهار مرحلة الخبر كـ Badge في القائمة */}
                  <Badge tone="maroon">
                    🎯 {item.targetStage || "الكل"}
                  </Badge>
                  {item.pinned && (
                    <Badge tone="gold">
                      <PinIcon className="h-3 w-3" /> مثبت
                    </Badge>
                  )}
                  <span className="text-xs font-medium text-earth-500">
                    {fmtDate(item.date)}
                  </span>
                </div>
                <h4 className="mt-2 text-base font-bold text-maroon-900">
                  {item.title}
                </h4>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-earth-700">
                  {item.body}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {item.form && (
                  <button
                    type="button"
                    onClick={() => onViewSubmissions(item.id)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-maroon-200 px-2.5 py-1.5 text-xs font-bold text-maroon-700 transition hover:bg-maroon-50"
                  >
                    <ClipboardIcon className="h-4 w-4" />
                    {item.submissions?.length ?? 0}
                  </button>
                )}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => setModal({ mode: "edit", item })}
                      className="cursor-pointer rounded-lg p-2 text-maroon-700 transition hover:bg-maroon-100"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => setPendingDelete(item)}
                      className="cursor-pointer rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {news.length === 0 && (
          <Card className="p-10 text-center text-sm text-earth-500">
            لا توجد إعلانات بعد — انشر أول إعلان.
          </Card>
        )}
      </div>

      {modal && (
        <NewsFormModal
          initial={modal.mode === "edit" ? modal.item : null}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            if (modal.mode === "edit") onUpdate(modal.item.id, sanitizeObject(data, ['imageUrl']));
            else onAdd(sanitizeObject(data, ['imageUrl']));
            setModal(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف الإعلان"
        message={`هل أنت متأكد من حذف "${pendingDelete?.title}"؟`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}