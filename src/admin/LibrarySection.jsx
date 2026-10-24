import { useState } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  BookIcon,
} from "./icons.jsx";
import {
  Badge,
  Card,
  ConfirmDialog,
  Field,
  Modal,
  inputCls,
} from "./ui.jsx";
import {
  getLibraryCategory,
  LIBRARY_CATEGORIES,
} from "../utils/libraryCategories.js";

function BookFormModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title ?? "",
          author: initial.author ?? "",
          category: initial.category ?? "",
          description: initial.description ?? "",
          coverUrl: initial.coverUrl ?? "",
          fileUrl: initial.fileUrl ?? "",
        }
      : {
          title: "",
          author: "",
          category: "",
          description: "",
          coverUrl: "",
          fileUrl: "",
        }
  );
  const [errors, setErrors] = useState({});
  const hasLegacyCategory =
    form.category && !getLibraryCategory(form.category);

  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = "عنوان الكتاب مطلوب.";
    if (!form.category.trim()) next.category = "اختر مجلد الكتاب.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      coverUrl: form.coverUrl.trim(),
      fileUrl: form.fileUrl.trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل الكتاب" : "إضافة كتاب"}
      subtitle="تظهر الكتب فوراً في مكتبة الأعضاء."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="عنوان الكتاب" required error={errors.title}>
          <input
            className={inputCls}
            value={form.title}
            onChange={set("title")}
            placeholder="مثال: دليل الكشاف الميداني"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المؤلف">
            <input
              className={inputCls}
              value={form.author}
              onChange={set("author")}
              placeholder="مثال: جمعية الكشافة"
            />
          </Field>
          <Field label="مجلد الكتاب" required error={errors.category}>
            <select
              className={inputCls}
              value={form.category}
              onChange={set("category")}
            >
              <option value="">اختر المجلد</option>
              {LIBRARY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {hasLegacyCategory && (
                <option value={form.category}>
                  التصنيف السابق: {form.category}
                </option>
              )}
            </select>
          </Field>
        </div>
        <Field label="الوصف">
          <textarea
            className={`${inputCls} min-h-24`}
            value={form.description}
            onChange={set("description")}
            placeholder="ملخص قصير يظهر على بطاقة الكتاب."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رابط صورة الغلاف">
            <input
              className={inputCls}
              value={form.coverUrl}
              onChange={set("coverUrl")}
              placeholder="https://example.com/cover.jpg"
            />
          </Field>
          <Field label="رابط ملف الكتاب">
            <input
              className={inputCls}
              value={form.fileUrl}
              onChange={set("fileUrl")}
              placeholder="https://example.com/book.pdf"
            />
          </Field>
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
            {isEdit ? "حفظ التغييرات" : "إضافة كتاب"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function LibrarySection({ books, onAdd, onUpdate, onToggleVisibility, onDelete, readOnly = false }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("الكل");
  const [modal, setModal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [visibilityBusyId, setVisibilityBusyId] = useState(null);
  const [visibilityError, setVisibilityError] = useState("");

  const toggleVisibility = async (book) => {
    setVisibilityBusyId(book.id);
    setVisibilityError("");
    try {
      await onToggleVisibility({ ...book, isVisible: book.isVisible === false });
    } catch (error) {
      setVisibilityError(error?.message || "تعذر تغيير ظهور الكتاب.");
    } finally {
      setVisibilityBusyId(null);
    }
  };

  const uncategorizedCount = books.filter(
    (book) => !getLibraryCategory(book.category)
  ).length;
  const categoryFilters = [
    "الكل",
    ...LIBRARY_CATEGORIES,
    ...(uncategorizedCount > 0 ? ["غير مصنف"] : []),
  ];
  const filtered = books.filter((book) => {
    const matchesCategory =
      categoryFilter === "الكل" ||
      (categoryFilter === "غير مصنف"
        ? !getLibraryCategory(book.category)
        : getLibraryCategory(book.category) === categoryFilter);
    const matchesQuery = `${book.title} ${book.author} ${book.category}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-maroon-900">
              إدارة المكتبة
            </h3>
            <p className="mt-0.5 text-xs text-earth-600">
              رتّب الكتب في المجلدات الاجتماعية والثقافية والكشفية والروحية.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالعنوان أو المؤلف..."
                className={`${inputCls} pl-9 sm:w-56`}
              />
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setModal({ mode: "add" })}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-maroon-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-800 active:scale-[0.98]"
              >
                <PlusIcon className="h-4 w-4" /> إضافة كتاب
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {categoryFilters.map((category) => {
            const count =
              category === "الكل"
                ? books.length
                : category === "غير مصنف"
                  ? uncategorizedCount
                  : books.filter(
                      (book) => getLibraryCategory(book.category) === category
                    ).length;
            const isSelected = categoryFilter === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setCategoryFilter(category)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  isSelected
                    ? "border-maroon-700 bg-maroon-700 text-white"
                    : "border-earth-200 bg-white text-earth-700 hover:border-maroon-300 hover:bg-maroon-50"
                }`}
              >
                <span aria-hidden="true">📁</span>
                {category}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isSelected ? "bg-white/20" : "bg-earth-100"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {visibilityError && (
          <p role="alert" className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            ⚠️ {visibilityError}
          </p>
        )}
        <div className="overflow-x-auto p-5 pt-4">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-maroon-100 text-[11px] tracking-wider text-earth-500 uppercase">
                <th className="pb-3 font-bold">الكتاب</th>
                <th className="pb-3 font-bold">المؤلف</th>
                <th className="pb-3 font-bold">التصنيف</th>
                <th className="pb-3 font-bold">الملف</th>
                <th className="pb-3 text-right font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-maroon-50 transition last:border-0 hover:bg-maroon-50/40"
                >
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      {b.coverUrl ? (
                        <img
                          src={b.coverUrl}
                          alt={b.title}
                          className="h-10 w-10 rounded-lg border border-maroon-100 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-maroon-100 bg-maroon-50 text-lg">
                          📕
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-earth-900">
                          {b.title}
                        </p>
                        {b.description && (
                          <p className="max-w-64 truncate text-xs text-earth-500">
                            {b.description}
                          </p>
                        )}
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${b.isVisible === false ? "bg-earth-200 text-earth-600" : "bg-forest-100 text-forest-800"}`}>
                          {b.isVisible === false ? "مخفي عن الأعضاء" : "ظاهر للأعضاء"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 text-earth-700">{b.author || "—"}</td>
                  <td className="py-3.5">
                    {b.category ? (
                      <Badge tone="maroon">
                        {getLibraryCategory(b.category) ?? b.category}
                      </Badge>
                    ) : (
                      <Badge tone="gray">غير مصنف</Badge>
                    )}
                  </td>
                  <td className="py-3.5">
                    {b.fileUrl ? (
                      <a
                        href={b.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-forest-700 hover:underline"
                      >
                        فتح الملف
                      </a>
                    ) : (
                      <Badge tone="gray">لا يوجد ملف</Badge>
                    )}
                  </td>
                  <td className="py-3.5">
                    {readOnly ? (
                      <span className="text-earth-400">—</span>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={b.isVisible === false ? `إظهار ${b.title} للأعضاء` : `إخفاء ${b.title} عن الأعضاء`}
                          title={b.isVisible === false ? "إظهار للأعضاء" : "إخفاء عن الأعضاء"}
                          onClick={() => toggleVisibility(b)}
                          disabled={visibilityBusyId === b.id}
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-50 ${b.isVisible === false ? "text-forest-700 hover:bg-forest-50" : "text-earth-600 hover:bg-earth-100"}`}
                        >
                          {visibilityBusyId === b.id
                            ? "..."
                            : b.isVisible === false
                              ? "👁️ إظهار"
                              : "🙈 إخفاء"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${b.title}`}
                          onClick={() => setModal({ mode: "edit", book: b })}
                          className="cursor-pointer rounded-lg p-2 text-maroon-700 transition hover:bg-maroon-100"
                        >
                          <EditIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${b.title}`}
                          onClick={() => setPendingDelete(b)}
                          className="cursor-pointer rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-10 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-50 text-maroon-700">
                      <BookIcon className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-sm text-earth-500">
                      {books.length === 0
                        ? 'لا توجد كتب مضافة بعد — اضغط "إضافة كتاب" لإنشاء أول كتاب.'
                        : "لا توجد كتب في هذا المجلد تطابق البحث."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && (
        <BookFormModal
          initial={modal.mode === "edit" ? modal.book : null}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            if (modal.mode === "edit") onUpdate(modal.book.id, data);
            else onAdd(data);
            setModal(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف الكتاب"
        message={`هل أنت متأكد من حذف "${pendingDelete?.title}"؟ لن يراه الأعضاء بعد ذلك في المكتبة.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
