import { useEffect, useState } from "react";
import QRCode from "qrcode";

// ✅ QR الاستلام الخاص بالطلب — بيتولد تلقائياً من رقم الطلب الحقيقي
// الكود بيشفر لينك سكان: #/scan?order=ORD-...
// المسئول لما يسكّنه بيشوف كل بيانات الطلب وصاحبه — فيتأكد إن
// ده فعلاً صاحب الطلب ده، وبعد الموافقة السكان بيسجل الاستلام
export default function OrderQr({ orderId, title = "📦 QR الاستلام", desc }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!orderId) return undefined;
    const baseUrl = window.location.origin + window.location.pathname;
    const scanUrl = `${baseUrl}#/scan?order=${encodeURIComponent(orderId)}`;
    QRCode.toDataURL(scanUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#4c1d15", light: "#ffffff" },
    }).then(setDataUrl).catch(() => setDataUrl(""));
    return () => setDataUrl("");
  }, [orderId]);

  if (!orderId || !dataUrl) return null;
  return (
    <div className="mt-3 rounded-xl border border-maroon-200 bg-white p-3 flex items-center gap-3">
      <img src={dataUrl} alt={`QR الطلب ${orderId}`} className="h-28 w-28 shrink-0" />
      <div className="text-xs leading-relaxed text-earth-700">
        <p className="font-extrabold text-maroon-800">{title}</p>
        <p className="mt-1">
          {desc ||
            "اعرض الكود ده للقائد وقت التسليم — هي سكّنه ويتأكد إن ده طلبك، ويتسجل الاستلام باسمك فوراً."}
        </p>
      </div>
    </div>
  );
}
