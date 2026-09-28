import MemberLayout from "./MemberLayout.jsx";
import { useStore } from "../store.jsx";
import { BookIcon } from "../admin/icons.jsx";

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

  return (
    <MemberLayout active="library">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold text-earth-900">
          المكتبة <span className="text-lg font-semibold text-earth-500">/ Library</span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-earth-600">
          مكتبة رقمية شاملة تحتوي على كتيبات التدريب والأدلة والمراجع الأساسية
          لكل كشاف — يضيفها قائد الوحدة بشكل مباشر.
        </p>

        {books.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-earth-300 bg-earth-50 px-6 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
              <BookIcon className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-earth-900">
              لا توجد كتب في الوقت الحالي
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-earth-600">
              لم يضف المسؤول أي كتب بعد — تابعنا لاحقاً وستجد هنا كتيبات التدريب
              والأدلة والمراجع.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {books.map((b, i) => (
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
                  {b.category && (
                    <span
                      className={`mb-2 self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        CATEGORY_TONES[b.category] ??
                        "bg-earth-100 text-earth-700"
                      }`}
                    >
                      {b.category}
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-earth-900">{b.title}</h3>
                  {b.author && (
                    <p className="mt-0.5 text-xs text-earth-500">{b.author}</p>
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
                      قراءة الكتاب <span className="font-semibold">/ Open</span>
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
