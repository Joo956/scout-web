import { useState } from "react";
import MemberLayout, { GuestNotice } from "./MemberLayout.jsx";
import { useStore } from "../store.jsx";
import { fmtMoney } from "../admin/ui.jsx";
import { CheckIcon, TrashIcon } from "../admin/icons.jsx";
import OrderQr from "./OrderQr.jsx";
import { getProductImages } from "../utils/imageLinks.js";

export default function CartPage() {
  const { products, cart, updateCartQty, removeFromCart, clearCart, placeOrder, currentUser, profile } = useStore();
  const [placed, setPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [busy, setBusy] = useState(false);

  const items = cart
    .map((c) => ({ ...c, product: products.find((p) => p.id === c.id) }))
    .filter((c) => c.product);

  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  const checkout = async () => {
    if (busy) return;
    if (!currentUser) { window.location.hash = "#/"; return; }
    setBusy(true);
    setCheckoutError("");
    try {
      // الخصم والتسجيل بيحصلوا على السيرفر في معاملة واحدة —
      // ولو فشل حاجة السلة بتفضل زي ما هي والخطأ بيتعرض
      const order = await placeOrder(
        items.map((i) => ({ product_id: i.product.id, qty: i.qty })),
        profile?.name
      );
      clearCart();
      setPlacedOrder(order ?? null);
      setPlaced(true);
    } catch (err) {
      setCheckoutError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MemberLayout active="cart">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {!currentUser && <GuestNotice />}

        <h1 className="text-3xl font-extrabold text-earth-900">السلة</h1>
        <p className="mt-1.5 text-sm text-earth-600">راجع طلبك قبل إرساله لقائد الوحدة.</p>

        {placed ? (
          <div className="mt-8 rounded-2xl border border-forest-200 bg-white p-10 text-center shadow-xs">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-100 text-forest-700">
              <CheckIcon className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold text-earth-900">تم إرسال طلبك بنجاح!</h2>
            {placedOrder?.orderId && (
              <p className="mt-2 text-sm text-earth-600">
                رقم طلبك:{" "}
                <span className="rounded-md border border-maroon-100 bg-maroon-50 px-2 py-0.5 font-mono font-extrabold text-maroon-800" dir="ltr">
                  {placedOrder.orderId}
                </span>
              </p>
            )}
            <p className="mt-1.5 text-sm text-earth-600">الطلب وصل لقائد الوحدة وهتلاقيه في "طلباتي" في البروفايل.</p>

            {/* ✅ QR الطلب — بيتولد تلقائياً مع كل طلب جديد
                المسئول لما يسكّنه بيشوف كل بيانات الطلب وصاحبه */}
            {placedOrder?.orderId && (
              <div className="mx-auto mt-5 max-w-md text-right">
                <div className="rounded-xl border border-earth-200 bg-earth-50 p-4">
                  <p className="text-xs font-bold text-earth-500">بيانات الطلب</p>
                  <p className="mt-1.5 text-sm font-semibold text-earth-900">{placedOrder.items}</p>
                  <p className="mt-1 text-sm font-extrabold text-maroon-800">
                    {fmtMoney(placedOrder.total)}
                    <span className="mr-2 text-xs font-semibold text-earth-500">
                      — {placedOrder.customer}
                    </span>
                  </p>
                </div>
                <OrderQr
                  orderId={placedOrder.orderId}
                  desc="احتفظ بالكود ده واعرضه للقائد وقت الاستلام — لما يسكّنه بيتأكد إن ده طلبك فعلاً وبيتسجل الاستلام باسمك."
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a href="#/profile" className="rounded-lg bg-forest-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-forest-800">طلباتي</a>
              <a href="#/store" className="rounded-lg border border-earth-300 px-6 py-2.5 text-sm font-bold text-earth-800 transition hover:bg-earth-100">متابعة التسوق</a>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-earth-300 bg-earth-50 px-6 py-16 text-center">
            <span className="text-5xl" aria-hidden="true">🛒</span>
            <h2 className="mt-4 text-lg font-bold text-earth-900">سلتك فاضية</h2>
            <p className="mt-1.5 text-sm text-earth-600">ضيف منتجات من المتجر وستظهر هنا.</p>
            <a href="#/store" className="mt-6 inline-block rounded-lg bg-maroon-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-maroon-800">اذهب للمتجر</a>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_300px]">
            <ul className="space-y-4">
              {items.map(({ product, qty }) => {
                // الصورة ممكن تكون بصيغة روابط متعددة (links://) — بنفك أول واحدة
                const productImg = getProductImages(product.imageUrl)[0];
                return (
                <li key={product.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-earth-200 bg-white p-4 shadow-xs">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-earth-50 to-earth-100 text-3xl">
                    {productImg ? <img src={productImg} alt={product.name} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} /> : <span aria-hidden="true">📦</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-earth-900">{product.name}</h3>
                    <p className="mt-0.5 text-xs text-earth-500">{fmtMoney(product.price)} للقطعة</p>
                    <p className="mt-1 text-sm font-extrabold text-maroon-800">{fmtMoney(product.price * qty)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-earth-200">
                    <button type="button" aria-label="تقليل الكمية" onClick={() => updateCartQty(product.id, qty - 1)} className="cursor-pointer px-3 py-1.5 text-sm font-bold text-earth-700 transition hover:bg-earth-100">−</button>
                    <span className="min-w-8 text-center text-sm font-bold text-earth-900">{qty}</span>
                    <button type="button" aria-label="زيادة الكمية" disabled={qty >= product.stock} onClick={() => updateCartQty(product.id, qty + 1)} className="cursor-pointer px-3 py-1.5 text-sm font-bold text-earth-700 transition hover:bg-earth-100 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                  </div>
                  <button type="button" aria-label={`حذف ${product.name}`} onClick={() => removeFromCart(product.id)} className="cursor-pointer rounded-lg p-2 text-red-600 transition hover:bg-red-50">
                    <TrashIcon className="h-4.5 w-4.5" />
                  </button>
                </li>
                );
              })}
            </ul>

            <aside className="rounded-2xl border border-earth-200 bg-white p-5 shadow-xs lg:sticky lg:top-20">
              <h2 className="text-base font-bold text-earth-900">ملخص الطلب</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-earth-600">
                  <span>عدد المنتجات</span>
                  <span className="font-bold text-earth-900">{items.reduce((s, i) => s + i.qty, 0)}</span>
                </div>
                <div className="flex justify-between border-t border-earth-100 pt-2 text-base">
                  <span className="font-bold text-earth-900">الإجمالي</span>
                  <span className="font-extrabold text-maroon-800">{fmtMoney(total)}</span>
                </div>
              </div>
              {checkoutError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  ⚠️ {checkoutError}
                </div>
              )}
              <button
                type="button"
                onClick={checkout}
                disabled={busy}
                className="mt-5 w-full cursor-pointer rounded-lg bg-maroon-700 px-4 py-3 text-sm font-bold tracking-wider text-white transition hover:bg-maroon-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "جاري إرسال الطلب..." : "إتمام الطلب"}
              </button>
              <p className="mt-3 text-center text-[11px] text-earth-500">الطلب بيوصل لقائد الوحدة للموافقة.</p>
            </aside>
          </div>
        )}
      </div>
    </MemberLayout>
  );
}