import { useStore } from "../store.jsx";
import { Badge, fmtDate, fmtMoney } from "../admin/ui.jsx";
import OrderQr from "./OrderQr.jsx";

// مكون صغير لعرض البيانات بشكل منظم
function InfoField({ label, value, isPhone = false }) {
  return (
    <div>
      <label className="text-xs font-bold text-earth-500 uppercase tracking-wide">
        {label}
      </label>
      <p className={`mt-1.5 font-semibold text-earth-900 text-sm ${isPhone ? "dir-ltr text-right" : ""}`}>
        {value || "غير محدد"}
      </p>
    </div>
  );
}

// حالة الطلب بالعربي + لون الـ Badge
const ORDER_STATUS = {
  Pending: { label: "قيد الانتظار", tone: "gold" },
  Approved: { label: "تمت الموافقة — جاهز للاستلام", tone: "green" },
  Received: { label: "تم الاستلام ✓", tone: "blue" },
};

export default function ProfilePage() {
  const { profile, members, orders, currentUser, profiles, storeSettings } = useStore();

  // البحث عن بيانات الكشاف الكاملة:
  // أولوية أولى بالربط الحقيقي (members.user_id = الحساب الحالي)،
  // ولو مش موجود نرجع للمطابقة بالإيميل زيما كانت.
  const memberByUser = currentUser
    ? members.find(m => m.userId === currentUser.id)
    : null;
  const memberByEmail = !memberByUser && profile?.email
    ? members.find(m => m.email === profile.email)
    : null;
  const memberData = memberByUser || memberByEmail || {};

  // طلبات الكشاف الحالي (mapOrder بيرجّع userId = orders.user_id)
  const myOrders = currentUser
    ? orders.filter(o => o.userId === currentUser.id)
    : [];

  // حساب الأحرف الأولى للاسم بأمان
  const initials = (profile?.name || "م")
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ✅ تم إزالة الـ Header والـ Footer من هنا ليتم توفيرهم بواسطة MemberLayout
  return (
    <div className="max-w-4xl mx-auto w-full p-4 sm:p-6">
      <h2 className="text-2xl font-extrabold text-maroon-900 mb-6 flex items-center gap-2">
        <span>👤</span> الملف الشخصي
      </h2>

      <div className="bg-white rounded-2xl border border-earth-200 p-6 sm:p-8 space-y-8 shadow-sm">

        {/* كود الكشاف */}
        <div className="bg-gradient-to-r from-maroon-50 to-white border border-maroon-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-maroon-700">كود الكشاف الرسمي</p>
            <p className="font-mono text-2xl sm:text-3xl font-extrabold text-maroon-900 mt-1 tracking-wider">
              {memberData.scoutCode || "جاري التوليد..."}
            </p>
          </div>
          <div className="hidden sm:block text-4xl opacity-80">⚜️</div>
        </div>

        {/* البيانات الشخصية */}
        <section>
          <h3 className="text-base font-bold text-earth-900 mb-4 border-b border-earth-200 pb-2 flex items-center gap-2">
            <span>📋</span> البيانات الشخصية
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoField label="الاسم الرباعي" value={profile?.name} />
            <InfoField label="اسم الأب الاعتراف" value={memberData.fatherName} />
            <InfoField label="اسم الأم" value={memberData.motherName} />
            <InfoField
              label="تاريخ الميلاد"
              value={memberData.birthDate ? new Date(memberData.birthDate).toLocaleDateString('ar-EG') : undefined}
            />
            <InfoField
              label="عدد الإخوة"
              value={memberData.siblingsCount > 0 ? `${memberData.siblingsCount} إخوة` : 'لا يوجد'}
            />
            <InfoField label="اسم أب الاعتراف" value={memberData.confessor} />
          </div>
        </section>

        {/* البيانات الكشفية والدراسية */}
        <section>
          <h3 className="text-base font-bold text-earth-900 mb-4 border-b border-earth-200 pb-2 flex items-center gap-2">
            <span>🎓</span> البيانات الكشفية والدراسية
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-earth-500 uppercase tracking-wide">المرحلة الكشفية</label>
              <div className="mt-1.5">
                <span className="inline-block bg-gold-100 text-gold-800 px-3 py-1.5 rounded-lg text-sm font-bold border border-gold-200">
                  {memberData.scoutStage || "غير محدد"}
                </span>
              </div>
            </div>
            <InfoField label="المرحلة الدراسية" value={memberData.educationStage} />
            <InfoField label="رقم الكشاف" value={memberData.scoutNumber} />
            <InfoField label="الكلية" value={memberData.college} />
          </div>
        </section>

        {/* العنوان */}
        <section>
          <h3 className="text-base font-bold text-earth-900 mb-4 border-b border-earth-200 pb-2 flex items-center gap-2">
            <span>📍</span> العنوان
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoField label="المحافظة" value={memberData.governorate} />
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-earth-500 uppercase tracking-wide">العنوان بالتفصيل</label>
              <p className="mt-1.5 font-medium text-earth-900 bg-earth-50 p-3 rounded-lg border border-earth-200 text-sm">
                {memberData.address || "غير محدد"}
              </p>
            </div>
          </div>
        </section>

        {/* طلباتي */}
        <section>
          <h3 className="text-base font-bold text-earth-900 mb-4 border-b border-earth-200 pb-2 flex items-center gap-2">
            <span>🧾</span> طلباتي
          </h3>
          {myOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-earth-300 bg-earth-50 px-6 py-10 text-center">
              <span className="text-4xl" aria-hidden="true">🛒</span>
              <p className="mt-3 text-sm font-semibold text-earth-700">
                مفيش طلبات لسه — اتفرج على المتجر واطلب أول حاجة
              </p>
              <a
                href="#/store"
                className="mt-4 inline-block rounded-lg bg-maroon-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-maroon-800"
              >
                اذهب للمتجر
              </a>
            </div>
          ) : (
            <ul className="space-y-3">
              {myOrders.map((o) => {
                const status = ORDER_STATUS[o.status] ?? { label: o.status, tone: "gray" };
                const receivedByProfile = o.receivedBy
                  ? profiles.find((p) => p.id === o.receivedBy)
                  : null;
                return (
                  <li
                    key={o.id}
                    className="rounded-xl border border-earth-200 bg-earth-50 p-4 transition hover:border-earth-300"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-extrabold text-maroon-800 tracking-wider" dir="ltr">
                        {o.orderId}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-earth-500">
                      {o.date ? fmtDate(o.date) : "غير محدد"}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-earth-900">
                      {o.items || "غير محدد"}
                    </p>
                    <p className="mt-2 text-sm font-extrabold text-maroon-800">
                      {fmtMoney(o.total)}
                    </p>
                    {/* QR الاستلام للطلبات المعتمدة */}
                    {o.status === "Approved" && <OrderQr orderId={o.orderId} />}
                    {/* زر واتساب — تأكيد الطلب وتحديد يوم الاستلام */}
                    {o.status === "Approved" && storeSettings?.whatsappNumber && (
                      <a
                        href={`https://wa.me/${storeSettings.whatsappNumber}?text=${encodeURIComponent(
                          `أهلاً 👋\nعايز أأكد استلام طلبي وأحدد معاك يوم التسليم:\n\n📦 رقم الطلب: ${o.orderId}\n🧾 المنتجات: ${o.items}\n💰 الإجمالي: ${fmtMoney(o.total)}\n👤 الاسم: ${profile?.name || ""}\n\nتحب نحدد إمتى أستلمه؟`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-extrabold text-white transition hover:brightness-95 active:scale-[0.99]"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        تواصل واتساب — حدد يوم الاستلام
                      </a>
                    )}
                    {/* تفاصيل الاستلام */}
                    {o.status === "Received" && o.receivedAt && (
                      <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-semibold text-blue-900 leading-relaxed">
                        📦 استلمت الطلب — سلّمك: {receivedByProfile?.name || "-"}
                        <br />
                        🕒 {new Date(o.receivedAt).toLocaleString("ar-EG", {
                          day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
