import { useState } from "react";
import MemberLayout, { GuestNotice } from "./MemberLayout.jsx";
import { useStore } from "../store.jsx";
import { fmtMoney } from "../admin/ui.jsx";
import { SearchIcon, CheckIcon, XIcon } from "../admin/icons.jsx";
import { getProductImages } from "../utils/imageLinks.js";
import ImageLightbox from "../components/ImageLightbox.jsx";

const PAGE_SIZE = 6;

const SORT_OPTIONS = [
  { value: "featured", label: "المميز", fn: null },
  { value: "price-asc", label: "السعر — من الأقل", fn: (a, b) => a.price - b.price },
  { value: "price-desc", label: "السعر — من الأعلى", fn: (a, b) => b.price - a.price },
  { value: "name", label: "الاسم (أ-ي)", fn: (a, b) => a.name.localeCompare(b.name) },
];

const stockLabel = (stock) =>
  stock === 0 ? "نفذ من المخزون" : stock <= 10 ? `باقي ${stock} فقط` : `${stock} متاح`;
const stockType = (stock) =>
  stock === 0 ? "outOfStock" : stock <= 10 ? "lowStock" : "inStock";



function FilterCard({ title, children }) {
  return (
    <div className="rounded-xl border border-earth-200 bg-white p-4 shadow-xs">
      <h3 className="mb-2 text-sm font-bold text-earth-900">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CheckItem({ label, note, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition hover:bg-earth-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-earth-300 accent-maroon-700"
      />
      <span className="font-medium text-earth-700">{label}</span>
      {note !== undefined && (
        <span className="ml-auto text-xs text-earth-400">{note}</span>
      )}
    </label>
  );
}

function FilterChip({ label, onClear }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-maroon-300 bg-maroon-50 py-1 pr-1.5 pl-3 text-xs font-bold text-maroon-800">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="cursor-pointer rounded-full p-0.5 text-maroon-500 transition hover:bg-maroon-100 hover:text-maroon-800"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav
      aria-label="Store pages"
      className="mt-10 flex items-center justify-center gap-1.5"
    >
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className="cursor-pointer rounded-lg border border-earth-200 px-3 py-1.5 text-sm font-bold text-earth-700 transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-current={n === page ? "page" : undefined}
          className={`min-w-9 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
            n === page
              ? "border-maroon-700 bg-maroon-700 text-white shadow-sm"
              : "border-earth-200 text-earth-700 hover:bg-earth-100"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className="cursor-pointer rounded-lg border border-earth-200 px-3 py-1.5 text-sm font-bold text-earth-700 transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </nav>
  );
}

export default function StorePage() {
  const { products, storeSettings: settings, currentUser, addToCart } = useStore();
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRanges, setSelectedRanges] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [orderedId, setOrderedId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images: string[], index: number } or null

  const catById = (id) => settings.categories.find((c) => c.id === id);
  const catName = (id) => catById(id)?.name ?? "غير مصنف";
  const catEmoji = (id) => catById(id)?.emoji ?? "📦";
  const rangeById = (id) => settings.priceRanges.find((r) => r.id === id);
  const availById = (id) => settings.availability.find((a) => a.id === id);

  const makeToggle = (setter) => (id) => {
    setPage(1);
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const toggleCategory = makeToggle(setSelectedCategories);
  const toggleRange = makeToggle(setSelectedRanges);
  const toggleAvailability = makeToggle(setSelectedAvailability);

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedRanges([]);
    setSelectedAvailability([]);
    setPage(1);
  };

  const filtered = products.filter((p) => {
    if (query && !`${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()))
      return false;
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(p.category)
    )
      return false;
    if (selectedRanges.length > 0) {
      const inRange = selectedRanges.some((rid) => {
        const r = rangeById(rid);
        return r && p.price >= r.min && (r.max === null || p.price <= r.max);
      });
      if (!inRange) return false;
    }
    if (
      selectedAvailability.length > 0 &&
      !selectedAvailability.includes(stockType(p.stock))
    )
      return false;
    return true;
  });

  const sorter = SORT_OPTIONS.find((s) => s.value === sort)?.fn;
  const sorted = sorter ? [...filtered].sort(sorter) : filtered;

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeChips = [
    ...selectedCategories.map((id) => ({
      key: `c-${id}`,
      label: catName(id),
      clear: () => toggleCategory(id),
    })),
    ...selectedRanges.map((id) => ({
      key: `r-${id}`,
      label: rangeById(id)?.label ?? "",
      clear: () => toggleRange(id),
    })),
    ...selectedAvailability.map((id) => ({
      key: `a-${id}`,
      label: availById(id)?.label ?? "",
      clear: () => toggleAvailability(id),
    })),
  ];

  const handleAddToCart = (p) => {
    if (!currentUser) {
      window.location.hash = "#/";
      return;
    }
    addToCart(p.id);
    setOrderedId(p.id);
    setTimeout(() => setOrderedId((cur) => (cur === p.id ? null : cur)), 1600);
  };

  return (
    <MemberLayout active="store">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {!currentUser && <GuestNotice />}

        <h1 className="text-3xl font-extrabold tracking-tight text-earth-900">
          {settings.title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-earth-600">
          {settings.description}
        </p>

        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="mt-5 cursor-pointer rounded-lg border border-earth-200 bg-white px-4 py-2 text-sm font-bold text-earth-800 shadow-xs transition hover:bg-earth-50 lg:hidden"
        >
          الفلاتر
          {activeChips.length > 0 && (
            <span className="ml-2 rounded-full bg-maroon-700 px-2 py-0.5 text-[10px] text-white">
              {activeChips.length}
            </span>
          )}
        </button>

        <div className="mt-5 grid items-start gap-7 lg:grid-cols-[230px_1fr]">
          <aside
            className={`space-y-4 ${filtersOpen ? "block" : "hidden"} lg:block`}
          >
            <FilterCard title="التصنيفات">
              {settings.categories.map((c) => (
                <CheckItem
                  key={c.id}
                  label={`${c.emoji} ${c.name}`}
                  note={products.filter((p) => p.category === c.id).length}
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                />
              ))}
              {settings.categories.length === 0 && (
                <p className="px-1.5 py-1 text-xs text-earth-400">
                  لا توجد تصنيفات بعد.
                </p>
              )}
            </FilterCard>

            <FilterCard title="نطاق السعر">
              {settings.priceRanges.map((r) => (
                <CheckItem
                  key={r.id}
                  label={r.label}
                  checked={selectedRanges.includes(r.id)}
                  onChange={() => toggleRange(r.id)}
                />
              ))}
              {settings.priceRanges.length === 0 && (
                <p className="px-1.5 py-1 text-xs text-earth-400">
                  لا توجد نطاقات أسعار بعد.
                </p>
              )}
            </FilterCard>

            <FilterCard title="التوفر">
              {settings.availability.map((a) => (
                <CheckItem
                  key={a.id}
                  label={a.label}
                  checked={selectedAvailability.includes(a.id)}
                  onChange={() => toggleAvailability(a.id)}
                />
              ))}
              {settings.availability.length === 0 && (
                <p className="px-1.5 py-1 text-xs text-earth-400">
                  لا توجد خيارات توفر بعد.
                </p>
              )}
            </FilterCard>
          </aside>

          <section>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-earth-500 uppercase">
                  الفلاتر النشطة:
                </span>
                {activeChips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    onClear={chip.clear}
                  />
                ))}
                {activeChips.length === 0 && (
                  <span className="text-xs text-earth-400">لا يوجد</span>
                )}
                {activeChips.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="cursor-pointer text-xs font-bold text-maroon-700 uppercase transition hover:text-maroon-900 hover:underline"
                  >
                    مسح الكل
                  </button>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="ابحث عن منتجات..."
                    className="w-40 rounded-lg border border-earth-200 bg-white py-2 pr-3 pl-9 text-xs shadow-xs transition placeholder:text-earth-400 focus:border-maroon-600 focus:ring-2 focus:ring-maroon-600/25 focus:outline-none sm:w-48"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort products"
                  className="cursor-pointer rounded-lg border border-earth-200 bg-white px-3 py-2 text-xs font-bold text-earth-800 shadow-xs transition hover:border-earth-300 focus:border-maroon-600 focus:outline-none"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <article
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-earth-200 bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-earth-50 to-earth-100 text-6xl">
                    {(() => {
                      const imgs = getProductImages(p.imageUrl);
                      if (imgs.length > 0) {
                        return (
                          <div className="relative h-full w-full">
                            <img
                              src={imgs[0]}
                              alt={p.name}
                              className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                              onClick={() => setLightbox({ images: imgs, index: 0 })}
                            />
                            {imgs.length > 1 && (
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
                                {imgs.map((_, i) => (
                                  <span
                                    key={i}
                                    className={`rounded-full transition-all ${
                                      i === 0
                                        ? "h-2 w-2 bg-maroon-600 shadow-sm"
                                        : "h-1.5 w-1.5 bg-white/70"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <span aria-hidden="true">{catEmoji(p.category)}</span>;
                    })()}
                    {p.stock === 0 && (
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                        نفذ
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm leading-snug font-bold text-earth-900">
                        {p.name}
                      </h3>
                      <span className="shrink-0 text-sm font-extrabold text-maroon-800">
                        {fmtMoney(p.price)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-earth-500">
                      {catName(p.category)} · {stockLabel(p.stock)}
                    </p>
                    <button
                      type="button"
                      disabled={p.stock === 0}
                      onClick={() => handleAddToCart(p)}
                      className={`mt-3.5 w-full rounded-lg px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition active:scale-[0.98] ${
                        p.stock === 0
                          ? "cursor-not-allowed bg-earth-100 text-earth-400"
                          : orderedId === p.id
                            ? "bg-forest-100 text-forest-800"
                            : "cursor-pointer bg-maroon-700 text-white hover:bg-maroon-800"
                      }`}
                    >
                      {p.stock === 0 ? (
                        "نفذ من المخزون"
                      ) : orderedId === p.id ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <CheckIcon className="h-3.5 w-3.5" /> أُضيف إلى السلة
                        </span>
                      ) : currentUser ? (
                        "أضف إلى السلة"
                      ) : (
                        "سجّل الدخول للطلب"
                      )}
                    </button>
                  </div>
                </article>
              ))}

              {visible.length === 0 && (
                <p className="rounded-xl border border-dashed border-earth-300 bg-earth-50 p-10 text-center text-sm text-earth-500 sm:col-span-2 xl:col-span-3">
                  لا توجد منتجات مطابقة للفلاتر المحددة.
                </p>
              )}
            </div>

            <Pagination page={safePage} pages={pages} onPage={setPage} />
          </section>
        </div>
      </div>

      <ImageLightbox
        images={lightbox?.images ?? []}
        initial={lightbox?.index ?? 0}
        open={lightbox !== null}
        onClose={() => setLightbox(null)}
      />
    </MemberLayout>
  );
}
