import { useState, useMemo, useEffect } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  XIcon,
} from "./icons.jsx";
import {
  Badge,
  Card,
  ConfirmDialog,
  Field,
  Modal,
  fmtMoney,
  inputCls,
} from "./ui.jsx";
import { AVAILABILITY_TYPES } from "./data.js";
import { parseLinks, buildLinksValue, getProductImages } from "../utils/imageLinks.js";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput.js";
import { useDebounce } from "../hooks/useDebounce.js";

const PAGE_SIZE = 6;

const fmtRange = (min, max) =>
  max === null || max === ""
    ? `${Number(min).toFixed(0)}+ ج.م`
    : `${Number(min).toFixed(0)} – ${Number(max).toFixed(0)} ج.م`;

function stockBadge(stock) {
  if (stock === 0) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-red-100 text-red-800 border-2 border-red-300 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
        <span className="text-base font-extrabold">نفذ المخزون</span>
      </span>
    );
  }
  if (stock <= 10) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-yellow-100 text-yellow-800 border-2 border-yellow-300 shadow-sm">
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-600 animate-pulse"></span>
        <span className="text-base font-extrabold">مخزون منخفض</span>
        <span className="ml-1 px-2 py-0.5 rounded-md bg-yellow-200 text-yellow-900 text-sm font-black">
          ({stock})
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-green-100 text-green-800 border-2 border-green-300 shadow-sm">
      <span className="w-2.5 h-2.5 rounded-full bg-green-600"></span>
      <span className="text-base font-extrabold">متاح</span>
      <span className="ml-1 px-2 py-0.5 rounded-md bg-green-200 text-green-900 text-sm font-black">
        ({stock})
      </span>
    </span>
  );
}

function ModalActions({ onClose, submitLabel }) {
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
        className="cursor-pointer rounded-lg bg-maroon-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-maroon-800"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function SettingsRow({ children, onEdit, onDelete, editLabel, deleteLabel, readOnly }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-earth-100 bg-earth-50/70 px-3 py-2.5">
      <span className="flex-1 truncate text-sm font-medium text-earth-800">
        {children}
      </span>
      {!readOnly && (
        <>
          <button
            type="button"
            aria-label={editLabel}
            onClick={onEdit}
            className="cursor-pointer rounded-md p-1.5 text-maroon-700 transition hover:bg-maroon-100"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={deleteLabel}
            onClick={onDelete}
            className="cursor-pointer rounded-md p-1.5 text-red-600 transition hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </li>
  );
}

function SettingsGroup({ title, onAdd, addLabel, emptyText, children, readOnly }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold tracking-wider text-earth-500 uppercase">
          {title}
        </h4>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="flex cursor-pointer items-center gap-1 rounded-md bg-maroon-50 px-2.5 py-1.5 text-xs font-bold text-maroon-700 transition hover:bg-maroon-100"
          >
            <PlusIcon className="h-3.5 w-3.5" /> {addLabel}
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {children}
        <li className="text-xs text-earth-400">{emptyText}</li>
      </ul>
    </div>
  );
}

function CategoryModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📦");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("اسم التصنيف مطلوب.");
      return;
    }
    onSubmit({ name: name.trim(), emoji: emoji.trim() || "📦" });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل التصنيف" : "إضافة تصنيف"}
      subtitle="التصنيفات تظهر كفلاتر في صفحة المتجر العامة."
      width="sm:max-w-md"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="اسم التصنيف" required error={error}>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: معدات التخييم"
          />
        </Field>
        <Field label="أيقونة Emoji">
          <input
            className={inputCls}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength="4"
            placeholder="🏕️"
          />
        </Field>
        <ModalActions onClose={onClose} submitLabel={isEdit ? "حفظ" : "إضافة"} />
      </form>
    </Modal>
  );
}

function PriceRangeModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [min, setMin] = useState(initial?.min ?? "");
  const [max, setMax] = useState(initial?.max ?? "");
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (min === "" || Number(min) < 0) next.min = "أدخل حد أدنى صحيح.";
    if (max !== "" && Number(max) <= Number(min))
      next.max = "الحد الأقصى يجب أن يكون أكبر من الحد الأدنى.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      min: Number(min),
      max: max === "" ? null : Number(max),
      label: fmtRange(Number(min), max === "" ? null : Number(max)),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل نطاق السعر" : "إضافة نطاق سعر"}
      subtitle="اترك الحد الأقصى فارغاً لنطاق مفتوح."
      width="sm:max-w-md"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="أقل سعر (ج.م)" required error={errors.min}>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="1"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="أعلى سعر (ج.م)" error={errors.max}>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="1"
              value={max ?? ""}
              onChange={(e) => setMax(e.target.value)}
              placeholder="بدون حد"
            />
          </Field>
        </div>
        <p className="rounded-lg bg-earth-50 px-3 py-2 text-xs text-earth-600">
          معاينة النطاق:{" "}
          <strong className="text-maroon-800">
            {min === "" ? "—" : fmtRange(Number(min), max === "" ? null : Number(max))}
          </strong>
        </p>
        <ModalActions onClose={onClose} submitLabel={isEdit ? "حفظ" : "إضافة"} />
      </form>
    </Modal>
  );
}

function AvailabilityModal({ initial, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState(initial?.type ?? "inStock");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("العنوان مطلوب.");
      return;
    }
    onSubmit({ label: label.trim(), type });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل خيار التوفر" : "إضافة خيار توفر"}
      subtitle="خيارات التوفر مرتبطة بمستويات المخزون الفعلية."
      width="sm:max-w-md"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="العنوان المعروض" required error={error}>
          <input
            className={inputCls}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثال: جاهز للشحن"
          />
        </Field>
        <Field label="يتطابق مع مستوى المخزون" required>
          <select
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {AVAILABILITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <ModalActions onClose={onClose} submitLabel={isEdit ? "حفظ" : "إضافة"} />
      </form>
    </Modal>
  );
}

function StoreInfoModal({ initial, onClose, onSubmit }) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [whatsappNumber, setWhatsappNumber] = useState(
    initial.whatsappNumber ?? ""
  );
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("عنوان الصفحة مطلوب.");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      whatsappNumber: whatsappNumber.replace(/[^\d]/g, "").trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="تعديل معلومات صفحة المتجر"
      subtitle="العنوان والمقدمة المعروضة فوق المنتجات."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="عنوان الصفحة" required error={error}>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="المتجر"
          />
        </Field>
        <Field label="الوصف">
          <textarea
            className={`${inputCls} min-h-24`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مقدمة قصيرة تظهر تحت العنوان."
          />
        </Field>
        <Field label="📱 رقم واتساب الاستلام">
          <input
            className={`${inputCls} dir-ltr`}
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="2010XXXXXXXX"
          />
          <p className="mt-1 text-[11px] text-earth-500">
            بكود الدولة من غير + — الأعضاء هيلاقوا زرار واتساب على الطلبات
            المعتمدة يحددوا بيه يوم استلام الطلب. سيبه فاضي لتعطيل الزرار.
          </p>
        </Field>
        <ModalActions onClose={onClose} submitLabel="حفظ التغييرات" />
      </form>
    </Modal>
  );
}

function ProductImage({ product, emojiFor }) {
  const imgs = getProductImages(product.imageUrl);
  if (imgs.length > 0) {
    return (
      <div className="flex -space-x-1 rtl:space-x-reverse">
        {imgs.slice(0, 3).map((url, i) => (
          <img key={i} src={url} alt={product.name}
            className="h-10 w-10 rounded-lg border-2 border-white object-cover shadow-sm" />
        ))}
        {imgs.length > 3 && (
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-100 text-xs font-bold text-maroon-700 border-2 border-white">+{imgs.length - 3}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-maroon-100 bg-maroon-50 text-2xl shadow-sm">
      {emojiFor(product.category)}
    </div>
  );
}

function ProductFormModal({ initial, categories, onClose, onSubmit }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial ?? {
      name: "",
      sku: "",
      category: categories[0]?.id ?? "",
      price: "",
      stock: "",
      imageUrl: "",
    }
  );
  const [errors, setErrors] = useState({});
  // Parse existing images into a flat URL string array
  const initialUrls = getProductImages(initial?.imageUrl);
  const [imageUrls, setImageUrls] = useState(
    initialUrls.length > 0 ? initialUrls : [""]
  );

  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));

  const handleAddImage = () => {
    if (imageUrls.length < 10) setImageUrls((prev) => [...prev, ""]);
  };

  const handleRemoveImage = (i) => {
    setImageUrls((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length === 0 ? [""] : next;
    });
  };

  const handleImageUrlChange = (i, value) => {
    setImageUrls((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "اسم المنتج مطلوب.";
    if (form.price === "" || Number(form.price) <= 0)
      next.price = "أدخل سعر صحيح.";
    if (form.stock === "" || Number(form.stock) < 0)
      next.stock = "أدخل مستوى مخزون صحيح.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Build imageUrl: 0 images → "", 1 image → plain URL, 2+ → links://
    const validUrls = imageUrls.map((u) => u.trim()).filter(Boolean);
    const imageUrl =
      validUrls.length === 0
        ? ""
        : validUrls.length === 1
          ? validUrls[0]
          : buildLinksValue(validUrls);
    onSubmit({
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim() || `SL-${Math.floor(1000 + Math.random() * 9000)}`,
      category: form.category || (categories[0]?.id ?? ""),
      price: Number(form.price),
      stock: Number(form.stock),
      imageUrl,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل المنتج" : "إضافة منتج"}
      subtitle="إدارة معدات الكشافة وشارات الاستحقاق."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Field label="اسم المنتج" required error={errors.name}>
          <input
            className={inputCls}
            value={form.name}
            onChange={set("name")}
            placeholder="مثال: الزي الكشفي الرسمي"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <input
              className={inputCls}
              value={form.sku}
              onChange={set("sku")}
              placeholder="يتم إنشاؤه تلقائياً إذا ترك فارغاً"
            />
          </Field>
          <Field label="التصنيف">
            <select
              className={inputCls}
              value={form.category}
              onChange={set("category")}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="السعر (ج.م)" required error={errors.price}>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={set("price")}
              placeholder="0.00"
            />
          </Field>
          <Field label="المخزون" required error={errors.stock}>
            <input
              className={inputCls}
              type="number"
              min="0"
              value={form.stock}
              onChange={set("stock")}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="صور المنتج">
          <div className="space-y-2">
            {imageUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    className={inputCls + " w-full"}
                    value={url}
                    onChange={(e) => handleImageUrlChange(i, e.target.value)}
                    placeholder={i === 0 ? "رابط الصورة الرئيسية (https://...)" : `رابط الصورة ${i + 1} (https://...)`}
                  />
                  {i === 0 && url.trim() && (
                    <span className="absolute top-1/2 left-2 -translate-y-1/2 rounded bg-maroon-100 px-1.5 py-0.5 text-[10px] font-bold text-maroon-700">
                      رئيسية
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  aria-label={`حذف الصورة ${i + 1}`}
                  className="shrink-0 cursor-pointer rounded-md p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                  title="حذف"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {imageUrls.length < 10 && (
              <button
                type="button"
                onClick={handleAddImage}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-earth-300 px-3 py-2 text-xs font-bold text-earth-600 transition hover:border-maroon-400 hover:bg-maroon-50 hover:text-maroon-700"
              >
                <PlusIcon className="h-3.5 w-3.5" /> إضافة صورة
              </button>
            )}
            {imageUrls.length > 1 && (
              <p className="text-[11px] text-earth-500">
                الصورة الأولى هي الرئيسية وتظهر في بطاقة المنتج.
              </p>
            )}
          </div>
        </Field>
        <ModalActions
          onClose={onClose}
          submitLabel={isEdit ? "حفظ التغييرات" : "إضافة منتج"}
        />
      </form>
    </Modal>
  );
}

function StoreSettingsCard({
  settings,
  onEditInfo,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAddRange,
  onEditRange,
  onDeleteRange,
  onAddAvailability,
  onEditAvailability,
  onDeleteAvailability,
  readOnly,
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-maroon-900">إعدادات المتجر</h3>
          <p className="mt-0.5 text-sm text-earth-600">
            التحكم في الفلاتر والمعلومات المعروضة في صفحة المتجر العامة.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onEditInfo}
            className="flex cursor-pointer items-center justify-center gap-1.5 self-start rounded-lg border border-maroon-200 px-4 py-2 text-sm font-semibold text-maroon-700 transition hover:bg-maroon-50 sm:self-auto"
          >
            <EditIcon className="h-4 w-4" /> تعديل معلومات الصفحة
          </button>
        )}
      </div>

      <div className="grid gap-6 p-5 pt-4 md:grid-cols-3">
        <SettingsGroup
          title="التصنيفات"
          addLabel="إضافة"
          onAdd={onAddCategory}
          readOnly={readOnly}
          emptyText={settings.categories.length === 0 ? "لا توجد تصنيفات بعد." : ""}
        >
          {settings.categories.map((c) => (
            <SettingsRow
              key={c.id}
              editLabel={`تعديل التصنيف ${c.name}`}
              deleteLabel={`حذف التصنيف ${c.name}`}
              onEdit={() => onEditCategory(c)}
              onDelete={() => onDeleteCategory(c)}
              readOnly={readOnly}
            >
              <span className="mr-1.5 text-lg">{c.emoji}</span>
              {c.name}
            </SettingsRow>
          ))}
        </SettingsGroup>

        <SettingsGroup
          title="نطاقات الأسعار"
          addLabel="إضافة"
          onAdd={onAddRange}
          readOnly={readOnly}
          emptyText={settings.priceRanges.length === 0 ? "لا توجد نطاقات بعد." : ""}
        >
          {settings.priceRanges.map((r) => (
            <SettingsRow
              key={r.id}
              editLabel={`تعديل نطاق السعر ${r.label}`}
              deleteLabel={`حذف نطاق السعر ${r.label}`}
              onEdit={() => onEditRange(r)}
              onDelete={() => onDeleteRange(r)}
              readOnly={readOnly}
            >
              {r.label}
            </SettingsRow>
          ))}
        </SettingsGroup>

        <SettingsGroup
          title="حالة التوفر"
          addLabel="إضافة"
          onAdd={onAddAvailability}
          readOnly={readOnly}
          emptyText={settings.availability.length === 0 ? "لا توجد خيارات بعد." : ""}
        >
          {settings.availability.map((a) => (
            <SettingsRow
              key={a.id}
              editLabel={`تعديل خيار التوفر ${a.label}`}
              deleteLabel={`حذف خيار التوفر ${a.label}`}
              onEdit={() => onEditAvailability(a)}
              onDelete={() => onDeleteAvailability(a)}
              readOnly={readOnly}
            >
              {a.label}
              <span className="mr-2 rounded-full bg-earth-200/70 px-2 py-0.5 text-[10px] font-bold text-earth-600 uppercase">
                {a.type}
              </span>
            </SettingsRow>
          ))}
        </SettingsGroup>
      </div>
    </Card>
  );
}

export default function StoreSection({
  products,
  settings,
  onAdd,
  onUpdate,
  onDelete,
  onEditInfo,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddRange,
  onUpdateRange,
  onDeleteRange,
  onAddAvailability,
  onUpdateAvailability,
  onDeleteAvailability,
  readOnly = false,
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const emojiFor = (categoryId) =>
    settings.categories.find((c) => c.id === categoryId)?.emoji ?? "📦";
  const categoryName = (categoryId) =>
    settings.categories.find((c) => c.id === categoryId)?.name ?? "غير مصنف";

  const filtered = useMemo(() =>
    products.filter((p) =>
      `${p.name} ${p.sku} ${categoryName(p.category)}`
        .toLowerCase()
        .includes(debouncedQuery.toLowerCase())
    ),
    [products, debouncedQuery, settings.categories]
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when debounced search changes
  useEffect(() => { setPage(1); }, [debouncedQuery]);

  const deleteTargets = {
    category: {
      title: "حذف التصنيف",
      message: (item) => `هل أنت متأكد من حذف التصنيف "${item.name}"؟ المنتجات التابعة له ستظهر كـ "غير مصنف".`,
      onConfirm: (item) => onDeleteCategory(item.id),
    },
    range: {
      title: "حذف نطاق السعر",
      message: (item) => `هل أنت متأكد من حذف نطاق السعر "${item.label}"؟`,
      onConfirm: (item) => onDeleteRange(item.id),
    },
    availability: {
      title: "حذف خيار التوفر",
      message: (item) => `هل أنت متأكد من حذف خيار التوفر "${item.label}"؟`,
      onConfirm: (item) => onDeleteAvailability(item.id),
    },
  };

  const settingsModalSubmit = (data) => {
    if (modal.kind === "category")
      modal.initial ? onUpdateCategory(modal.initial.id, data) : onAddCategory(data);
    else if (modal.kind === "range")
      modal.initial ? onUpdateRange(modal.initial.id, data) : onAddRange(data);
    else if (modal.kind === "availability")
      modal.initial ? onUpdateAvailability(modal.initial.id, data) : onAddAvailability(data);
    else if (modal.kind === "info") onEditInfo(data);
    setModal(null);
  };

  return (
    <div className="space-y-6">
      <StoreSettingsCard
        settings={settings}
        readOnly={readOnly}
        onEditInfo={() => setModal({ kind: "info" })}
        onAddCategory={() => setModal({ kind: "category" })}
        onEditCategory={(c) => setModal({ kind: "category", initial: c })}
        onDeleteCategory={(c) => setPendingDelete({ kind: "category", item: c })}
        onAddRange={() => setModal({ kind: "range" })}
        onEditRange={(r) => setModal({ kind: "range", initial: r })}
        onDeleteRange={(r) => setPendingDelete({ kind: "range", item: r })}
        onAddAvailability={() => setModal({ kind: "availability" })}
        onEditAvailability={(a) => setModal({ kind: "availability", initial: a })}
        onDeleteAvailability={(a) => setPendingDelete({ kind: "availability", item: a })}
      />

      <Card>
        <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-maroon-900">مخزون المنتجات</h3>
            <p className="mt-1 text-sm text-earth-600">
              إدارة معدات الكشافة وشارات الاستحقاق المتاحة.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالاسم أو SKU..."
                className={`${inputCls} pr-9 sm:w-64 text-right`}
              />
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setModal({ kind: "product" })}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-maroon-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800 active:scale-[0.98]"
              >
                <PlusIcon className="h-4 w-4" /> إضافة منتج
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto p-5 pt-4">
          <table className="w-full min-w-[700px] text-right text-sm">
            <thead>
              <tr className="border-b-2 border-maroon-100 text-sm font-bold text-maroon-900 uppercase tracking-wide">
                <th className="pb-3 px-4 w-[10%]">SKU</th>
                <th className="pb-3 px-4 w-[30%]">اسم المنتج</th>
                <th className="pb-3 px-4 w-[15%]">التصنيف</th>
                <th className="pb-3 px-4 w-[15%]">السعر</th>
                <th className="pb-3 px-4 w-[15%]">حالة المخزون</th>
                <th className="pb-3 px-4 w-[15%] text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-100">
              {rows.map((p) => (
                <tr key={p.id} className="transition hover:bg-maroon-50/40">
                  <td className="py-4 px-4 align-middle">
                    <code className="font-mono text-xs font-bold text-maroon-700 bg-maroon-50 px-2 py-1.5 rounded border border-maroon-100 block text-center">
                      {p.sku}
                    </code>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <div className="flex items-center gap-3">
                      <ProductImage product={p} emojiFor={emojiFor} />
                      <span className="font-bold text-earth-900 text-base leading-tight">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                      {categoryName(p.category)}
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    <span className="font-bold text-maroon-800 text-base dir-ltr text-right block">
                      {fmtMoney(p.price)}
                    </span>
                  </td>
                  <td className="py-4 px-4 align-middle">
                    {stockBadge(p.stock)}
                  </td>
                  <td className="py-4 px-4 align-middle text-center">
                    {readOnly ? (
                      <span className="text-xs font-semibold text-earth-400">—</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          aria-label={`تعديل ${p.name}`}
                          onClick={() => setModal({ kind: "product", initial: p })}
                          className="cursor-pointer rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                          title="تعديل"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${p.name}`}
                          onClick={() => setPendingDelete({ kind: "product", item: p })}
                          className="cursor-pointer rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center">
                    <div className="text-earth-300 text-4xl mb-3">📦</div>
                    <p className="text-earth-600 font-medium text-base">لا توجد منتجات مطابقة للبحث</p>
                    <p className="text-earth-500 text-sm mt-1">جرب تغيير كلمات البحث أو أضف منتجاً جديداً</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-maroon-100 px-5 py-4 text-sm text-earth-600 sm:flex-row">
          <span>
            عرض{" "}
            <strong className="text-maroon-900">
              {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} إلى{" "}
              {Math.min(safePage * PAGE_SIZE, filtered.length)}
            </strong>{" "}
            من أصل <strong className="text-maroon-900">{filtered.length}</strong>{" "}
            منتج
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
                className={`cursor-pointer rounded-md border px-3 py-1.5 font-semibold transition ${
                  n === safePage
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
      </Card>

      {/* Modals */}
      {modal?.kind === "product" && (
        <ProductFormModal
          initial={modal.initial ?? null}
          categories={settings.categories}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            if (modal.initial) onUpdate(modal.initial.id, sanitizeObject(data, ['imageUrl']));
            else onAdd(sanitizeObject(data, ['imageUrl']));
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "category" && (
        <CategoryModal
          initial={modal.initial ?? null}
          onClose={() => setModal(null)}
          onSubmit={settingsModalSubmit}
        />
      )}

      {modal?.kind === "range" && (
        <PriceRangeModal
          initial={modal.initial ?? null}
          onClose={() => setModal(null)}
          onSubmit={settingsModalSubmit}
        />
      )}

      {modal?.kind === "availability" && (
        <AvailabilityModal
          initial={modal.initial ?? null}
          onClose={() => setModal(null)}
          onSubmit={settingsModalSubmit}
        />
      )}

      {modal?.kind === "info" && (
        <StoreInfoModal
          initial={{ title: settings.title, description: settings.description }}
          onClose={() => setModal(null)}
          onSubmit={settingsModalSubmit}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === "product"
            ? "حذف المنتج"
            : deleteTargets[pendingDelete?.kind]?.title ?? "حذف"
        }
        message={
          pendingDelete?.kind === "product"
            ? `هل أنت متأكد من حذف "${pendingDelete?.item?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : deleteTargets[pendingDelete?.kind]?.message?.(pendingDelete?.item)
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete.kind === "product")
            onDelete(pendingDelete.item.id);
          else deleteTargets[pendingDelete.kind].onConfirm(pendingDelete.item);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}