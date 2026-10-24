import { useState } from "react";
import MemberLayout from "./MemberLayout.jsx";
import { useStore } from "../store.jsx";
import { BookIcon } from "../admin/icons.jsx";
import {
  getLibraryCategory,
  LIBRARY_CATEGORIES,
} from "../utils/libraryCategories.js";

const CATEGORY_TONES = {
  "Training": "bg-forest-100 text-forest-800",
  "تدريب": "bg-forest-100 text-forest-800",
  "Guides": "bg-gold-100 text-gold-800",
  "أدلة": "bg-gold-100 text-gold-800",
  "References": "bg-maroon-100 text-maroon-800",
  "مراجع": "bg-maroon-100 text-maroon-800",
};

const COVER_GRADIENTS = [
  "from-forest-100 to-forest-300",
  "from-gold-100 to-gold-300",
  "from-maroon-100 to-maroon-300",
  "from-earth-100 to-earth-300",
];

export default function LibraryPage() {
  const { books } = useStore();
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const publishedBooks = books.filter((book) => book.isVisible !== false);
  const uncategorizedCount = publishedBooks.filter(
    (book) => !getLibraryCategory(book.category)
  ).length;
  const categories = [
    "الكل",
    ...LIBRARY_CATEGORIES,
    ...(uncategorizedCount > 0 ? ["غير مصنف"] : []),
  ];
  const visibleBooks = publishedBooks.filter((book) =>
    selectedCategory === "الكل"
      ? true
      : selectedCategory === "غير مصنف"
        ? !getLibraryCategory(book.category)
        : getLibraryCategory(book.category) === selectedCategory
  );

  return (
    <MemberLayout active="library">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold text-earth-900">
          المكتبة <span className="text-lg font-semibold text-earth-500">/ Library</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-earth-600">
          تصفح الكتب والمراجع في المجلدات الاجتماعية والثقافية والكشفية والروحية.
          يضيفها قائد الوحدة بشكل مباشر.
        </p>

        <div className="mt-7 flex flex-wrap gap-2">
          {categories.map((category) => {
            const count =
              category === "الكل"
                ? publishedBooks.length
                : category === "غير مصنف"
                  ? uncategorizedCount
                  : publishedBooks.filter(
                      (book) => getLibraryCategory(book.category) === category
                    ).length;
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(category)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition ${
                  isSelected
                    ? "border-forest-700 bg-forest-700 text-white"
                    : "border-earth-200 bg-white text-earth-700 hover:border-forest-300 hover:bg-forest-50"
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
        {visibleBooks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-earth-300 bg-earth-50 px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
              <BookIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm text-earth-600">
              {publishedBooks.length === 0
                ? "لا توجد كتب مضافة في المكتبة حالياً."
                : `لا توجد كتب مضافة داخل مجلد ${selectedCategory} في الموقع حالياً.`}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleBooks.map((b, i) => (
                  <article
                    key={b.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div
                      className={`flex h-48 items-center justify-center bg-gradient-to-br text-6xl ${
                        COVER_GRADIENTS[i % COVER_GRADIENTS.length]
                      }`}
                    >
                      {b.coverUrl ? (
                        <img
                          src={b.coverUrl}
                          alt={b.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span aria-hidden="true">📕</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <span
                        className={`mb-2 self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          CATEGORY_TONES[getLibraryCategory(b.category)] ??
                          "bg-earth-100 text-earth-700"
                        }`}
                      >
                        {getLibraryCategory(b.category) ??
                          b.category ??
                          "غير مصنف"}
                      </span>
                      <h3 className="text-sm font-bold text-earth-900">
                        {b.title}
                      </h3>
                      {b.author && (
                        <p className="mt-0.5 text-xs text-earth-500">
                          {b.author}
                        </p>
                      )}
                      {b.description && (
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-earth-600">
                          {b.description}
                        </p>
                      )}
                      {b.fileUrl ? (
                        <a
                          href={b.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block w-full cursor-pointer rounded-lg bg-forest-700 px-4 py-2.5 text-center text-xs font-bold text-white uppercase transition hover:bg-forest-800 active:scale-[0.98]"
                        >
                          قراءة الكتاب{" "}
                          <span className="font-semibold">/ Open</span>
                        </a>
                      ) : (
                        <span className="mt-3 block w-full cursor-not-allowed rounded-lg bg-earth-100 px-4 py-2.5 text-center text-xs font-bold text-earth-400 uppercase">
                          غير متاح
                        </span>
                      )}
                    </div>
                  </article>
            ))}
          </div>
        )}
      </div>
    </MemberLayout>
  );
}
