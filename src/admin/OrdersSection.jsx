import { useState } from "react";

// ExcelJS بيتحمّل عند الطلب بس — بيقلل حجم التحميل الأولي للكل
const loadExcel = () => import("exceljs").then((m) => m.default);
import { SearchIcon, DownloadIcon } from "./icons.jsx";
import { Card, fmtDate, fmtMoney, inputCls } from "./ui.jsx";
import { ORDER_STATUSES } from "./data.js";

const statusStyles = {
  Pending: "border-gold-300 bg-gold-50 text-gold-800 focus:border-gold-500 focus:ring-gold-400/30",
  Approved: "border-forest-200 bg-forest-50 text-forest-800 focus:border-forest-500 focus:ring-forest-400/30",
  Received: "border-blue-200 bg-blue-50 text-blue-800 focus:border-blue-500 focus:ring-blue-400/30",
};

const statusAr = {
  Pending: "قيد الانتظار",
  Approved: "تمت الموافقة",
  Received: "تم الاستلام",
};

// ✅ هوية كل حالة: شريط الصف + لون النقطة + تدرج الكرت
const STATUS_META = {
  Pending: {
    bar: "#f9b426", // gold-400
    dot: "bg-gold-500",
    rowTint: "",
    cardCls: "border-gold-300 from-gold-50 to-white",
    textCls: "text-gold-800",
  },
  Approved: {
    bar: "#38753f", // forest-500
    dot: "bg-forest-500",
    rowTint: "bg-forest-50/40",
    cardCls: "border-forest-300 from-forest-50 to-white",
    textCls: "text-forest-800",
  },
  Received: {
    bar: "#3b82f6", // blue-500
    dot: "bg-blue-500",
    rowTint: "bg-blue-50/50",
    cardCls: "border-blue-300 from-blue-50 to-white",
    textCls: "text-blue-800",
  },
};

const STATUS_CARDS = [
  { key: "Pending", icon: "⏳", label: "قيد الانتظار" },
  { key: "Approved", icon: "✅", label: "تمت الموافقة" },
  { key: "Received", icon: "📦", label: "تم الاستلام" },
];

export default function OrdersSection({ orders, onUpdateStatus, products, profiles = [], readOnly = false }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [exportNotice, setExportNotice] = useState("");

  // بيانات صاحب الطلب من البروفايلات: الاسم + الإيميل
  const ownerOf = (o) => profiles.find((p) => p.id === o.userId);
  const ownerEmail = (o) => ownerOf(o)?.email || "-";
  // اسم اللي سلّم الطلب (المسئول اللي عمل سكان الـ QR)
  const receivedByName = (uid) => profiles.find((p) => p.id === uid)?.name || "-";
  // اسم اللي وافق على الطلب
  const approvedByName = (uid) => profiles.find((p) => p.id === uid)?.name || "-";
  const fmtDateTime = (t) => {
    try {
      return new Date(t).toLocaleString("ar-EG", {
        day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
      });
    } catch { return t; }
  };
  // صيغة مختصرة لسجل الخطوات جوه الصف
  const fmtShort = (t) => {
    try {
      return new Date(t).toLocaleString("ar-EG", {
        day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      });
    } catch { return t; }
  };

  const filtered = orders.filter(
    (o) =>
      (filter === "All" || o.status === filter) &&
      `${o.orderId} ${o.customer} ${o.items}`.toLowerCase().includes(query.toLowerCase())
  );

  const parseItems = (itemsStr) => {
    if (!itemsStr) return [];
    return itemsStr.split("، ").map((item) => {
      const match = item.match(/^(.+?)\s*[×x]\s*(\d+)$/);
      const name = match ? match[1].trim() : item.trim();
      const qty = match ? parseInt(match[2]) : 1;
      const product = products?.find((p) => p.name === name);
      return { name, qty, price: product?.price ?? 0 };
    });
  };

  // ✅ دالة التصدير الشاملة — كل الطلبات (انتظار/معتمد/مستلم) مع تفاصيل الاستلام
  const exportOrdersDetailed = async () => {
    if (orders.length === 0) {
      setExportNotice("⚠️ لا توجد طلبات للتصدير حالياً");
      setTimeout(() => setExportNotice(""), 3000);
      return;
    }

    const statusLabel = (s) => statusAr[s] ?? s;

    // 1️⃣ ورقة ملخص الطلبات (مع تفاصيل المنتجات والاستلام)
    const summaryData = orders.map((order) => {
      const items = parseItems(order.items);

      // أسماء المنتجات مع الكميات: "T-shirt ×2، بوصلة ×1"
      const productsNames = items.map((i) => `${i.name} ×${i.qty}`).join("، ");

      // تفاصيل كل منتج في سطر منفصل داخل الخلية (زي الصفحة بالظبط)
      const productsDetails = items
        .map((i) => `${i.name}: ${i.qty} × ${i.price.toFixed(2)} = ${(i.price * i.qty).toFixed(2)} ج.م`)
        .join("\n");

      return {
        "رقم الطلب": order.orderId,
        "التاريخ": order.date,
        "العميل": order.customer,
        "إيميل صاحب الطلب": ownerEmail(order),
        "المنتجات": productsNames,
        "تفاصيل الأسعار": productsDetails,
        "عدد القطع": items.reduce((s, i) => s + i.qty, 0),
        "الإجمالي": `${Number(order.total).toFixed(2)} ج.م`,
        "الحالة": statusLabel(order.status),
        "اللي وافق (المسئول)": order.status !== "Pending" && order.approvedAt ? approvedByName(order.approvedBy) : "-",
        "معاد الموافقة": order.status !== "Pending" && order.approvedAt ? fmtDateTime(order.approvedAt) : "-",
        "اللي سلّم (المسئول)": order.status === "Received" ? receivedByName(order.receivedBy) : "-",
        "معاد الاستلام": order.status === "Received" && order.receivedAt ? fmtDateTime(order.receivedAt) : "-",
      };
    });

    // 2️⃣ ورقة تفاصيل المنتجات (صف مستقل لكل منتج)
    const detailsData = [];
    orders.forEach((order) => {
      const items = parseItems(order.items);
      items.forEach((item) => {
        const product = products?.find((p) => p.name === item.name);
        detailsData.push({
          "رقم الطلب": order.orderId,
          "العميل": order.customer,
          "الحالة": statusLabel(order.status),
          "اسم المنتج": item.name,
          "الكمية": item.qty,
          "سعر الوحدة": `${item.price.toFixed(2)} ج.م`,
          "إجمالي الصنف": `${(item.price * item.qty).toFixed(2)} ج.م`,
          "المخزون المتاح": product?.stock ?? 0,
          "التصنيف": product?.category || "غير مصنف",
        });
      });
    });

    // 3️⃣ ورقة سجل الاستلام — الطلبات اللي اتسلمت فعلاً
    const receivedData = orders
      .filter((order) => order.status === "Received")
      .map((order) => ({
        "رقم الطلب": order.orderId,
        "العميل (اللي استلم)": order.customer,
        "المنتجات": order.items,
        "الإجمالي": `${Number(order.total).toFixed(2)} ج.م`,
        "اللي سلّم (المسئول)": receivedByName(order.receivedBy),
        "معاد الاستلام": order.receivedAt ? fmtDateTime(order.receivedAt) : "-",
        "تاريخ الطلب": order.date,
      }));

    // إنشاء الملف
    const ExcelJS = await loadExcel();
    const workbook = new ExcelJS.Workbook();

    // ملخص الطلبات
    const summarySheet = workbook.addWorksheet("ملخص الطلبات");
    const summaryHeaders = Object.keys(summaryData[0]);
    summarySheet.addRow(summaryHeaders);
    summaryData.forEach((row) => summarySheet.addRow(Object.values(row)));
    const summaryColWidths = [12, 12, 22, 26, 32, 45, 10, 14, 14, 18, 20, 20, 22];
    summarySheet.columns = summaryHeaders.map((h, i) => ({
      header: h,
      key: h,
      width: (summaryColWidths[i] ?? 15) / 2,
    }));

    // تفاصيل المنتجات
    const detailsSheet = workbook.addWorksheet("تفاصيل المنتجات");
    const detailsHeaders = Object.keys(detailsData[0]);
    detailsSheet.addRow(detailsHeaders);
    detailsData.forEach((row) => detailsSheet.addRow(Object.values(row)));
    const detailsColWidths = [12, 22, 14, 25, 8, 14, 14, 12, 15];
    detailsSheet.columns = detailsHeaders.map((h, i) => ({
      header: h,
      key: h,
      width: (detailsColWidths[i] ?? 15) / 2,
    }));

    // سجل الاستلام
    if (receivedData.length > 0) {
      const receivedSheet = workbook.addWorksheet("سجل الاستلام");
      const receivedHeaders = Object.keys(receivedData[0]);
      receivedSheet.addRow(receivedHeaders);
      receivedData.forEach((row) => receivedSheet.addRow(Object.values(row)));
      receivedSheet.columns = receivedHeaders.map(() => ({ width: 20 }));
    }

    // المخزون الحالي
    const inventoryData = (products || []).map((product) => ({
      "اسم المنتج": product.name,
      "SKU": product.sku || "-",
      "السعر": `${Number(product.price).toFixed(2)} ج.م`,
      "المخزون المتاح": product.stock,
      "حالة المخزون":
        product.stock === 0 ? "نفذ 🔴" : product.stock <= 10 ? "منخفض 🟡" : "متوفر 🟢",
      "التصنيف": product.category || "غير مصنف",
    }));
    const inventorySheet = workbook.addWorksheet("المخزون الحالي");
    const inventoryHeaders = Object.keys(inventoryData[0]);
    inventorySheet.addRow(inventoryHeaders);
    inventoryData.forEach((row) => inventorySheet.addRow(Object.values(row)));
    inventorySheet.columns = inventoryHeaders.map(() => ({ width: 15 }));

    const fileName = `الطلبات_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ✅ كروت ملخص الحالات — كل كرت بيتصرف كفلتر */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATUS_CARDS.map((c) => {
          const meta = STATUS_META[c.key];
          const count = orders.filter((o) => o.status === c.key).length;
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(active ? "All" : c.key)}
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-gradient-to-br p-4 text-right transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                meta.cardCls
              } ${active ? "ring-2 ring-maroon-600/40 shadow-md" : "shadow-xs"}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                {c.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-extrabold ${meta.textCls}`}>
                  {c.label}
                </span>
                <span className="block text-[11px] font-semibold text-earth-500">
                  اضغط للفلترة
                </span>
              </span>
              <span className={`text-3xl font-extrabold ${meta.textCls}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        {/* Tabs + Search + Export */}
        <div className="flex flex-col gap-4 px-5 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("All")}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold transition ${
                filter === "All"
                  ? "bg-maroon-700 text-white shadow-sm"
                  : "bg-maroon-50 text-maroon-800 hover:bg-maroon-100"
              }`}
            >
              الكل ({orders.length})
            </button>
            {STATUS_CARDS.map((c) => {
              const meta = STATUS_META[c.key];
              const count = orders.filter((o) => o.status === c.key).length;
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(active ? "All" : c.key)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    active
                      ? "bg-maroon-700 text-white shadow-sm"
                      : "bg-maroon-50 text-maroon-800 hover:bg-maroon-100"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {c.label} ({count})
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative lg:w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-earth-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث برقم الطلب أو العميل..."
                className={`${inputCls} pr-9`}
              />
            </div>

            {/* ✅ زر التصدير الشامل */}
            <button
              type="button"
              onClick={exportOrdersDetailed}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              title="تصدير كل الطلبات مع تفاصيل الاستلام والمخزون"
            >
              <DownloadIcon className="h-4 w-4" /> تصدير الطلبات (Excel)
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mx-5 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 text-sm font-medium">
            {exportNotice}
          </div>
        )}

        {/* الجدول */}
        <div className="overflow-x-auto p-5 pt-4">
          <table className="w-full min-w-[700px] text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-maroon-100 text-[11px] tracking-wider text-earth-500">
                <th className="pb-3 pr-2 text-right font-bold w-[100px]">رقم الطلب</th>
                <th className="pb-3 px-2 text-right font-bold w-[120px]">العميل</th>
                <th className="pb-3 px-2 text-right font-bold">المنتجات</th>
                <th className="pb-3 px-2 text-left font-bold w-[100px]">الإجمالي</th>
                <th className="pb-3 px-2 text-center font-bold w-[130px]">الحالة</th>
                <th className="pb-3 pl-2 text-left font-bold w-[110px]">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const items = parseItems(o.items);
                const meta = STATUS_META[o.status] ?? STATUS_META.Pending;
                return (
                  <tr key={o.id} className={`border-b border-maroon-50 transition last:border-0 hover:bg-maroon-50/40 ${meta.rowTint}`}>
                    {/* رقم الطلب + شريط لون الحالة على الحافة */}
                    <td
                      className="border-r-4 py-3 pr-2 text-right font-mono text-xs font-extrabold text-maroon-800 whitespace-nowrap align-top"
                      style={{ borderRightColor: meta.bar }}
                    >
                      {o.orderId}
                    </td>

                    {/* العميل */}
                    <td className="py-3 px-2 text-right font-semibold text-earth-900 whitespace-nowrap align-top">
                      {o.customer}
                      <div className="mt-0.5 text-[10px] font-medium text-earth-500" dir="ltr">
                        {ownerEmail(o)}
                      </div>
                    </td>

                    {/* المنتجات — كل منتج في سطر مرتب */}
                    <td className="py-3 px-2 align-top">
                      <div className="space-y-1.5">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-earth-50/70 px-2.5 py-1.5">
                            <span className="text-sm font-semibold text-earth-900 whitespace-nowrap">{item.name}</span>
                            {item.price > 0 ? (
                              <span className="mr-auto flex items-center gap-1 text-xs text-earth-600 whitespace-nowrap" dir="ltr">
                                <span className="font-extrabold text-maroon-800">{fmtMoney(item.price * item.qty)}</span>
                                <span className="text-earth-400">=</span>
                                <span className="rounded bg-earth-200 px-1.5 py-0.5 text-[10px] font-bold text-earth-700">{item.qty}</span>
                                <span className="text-earth-400">×</span>
                                <span className="font-semibold text-earth-700">{fmtMoney(item.price)}</span>
                              </span>
                            ) : (
                              <span className="mr-auto rounded bg-earth-200 px-1.5 py-0.5 text-[10px] font-bold text-earth-700">
                                ×{item.qty}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* الإجمالي */}
                    <td className="py-3 px-2 text-left text-sm font-extrabold text-earth-900 whitespace-nowrap align-top">
                      {fmtMoney(o.total)}
                    </td>

                    {/* الحالة */}
                    <td className="py-3 px-2 text-center align-top">
                      {readOnly ? (
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${statusStyles[o.status]}`}>
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          {statusAr[o.status] ?? o.status}
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1">
                          <select
                            value={o.status}
                            onChange={(e) => onUpdateStatus(o.id, e.target.value)}
                            className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 ${statusStyles[o.status]}`}
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {statusAr[s] ?? s}
                              </option>
                            ))}
                          </select>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-earth-400">
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {statusAr[o.status] ?? o.status}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* التاريخ + سجل الخطوات (موافقة ← استلام) بسطر نضيف */}
                    <td className="py-3 pl-2 text-left text-xs text-earth-500 whitespace-nowrap align-top">
                      {fmtDate(o.date)}
                      {(o.status !== "Pending" || o.receivedAt) && (
                        <div className="mt-1.5 space-y-0.5 text-[10px] leading-tight">
                          {o.approvedAt && (
                            <p className="font-semibold text-forest-700">
                              ✅ وافقها {approvedByName(o.approvedBy)}
                              <span className="text-earth-400"> · </span>
                              <span className="font-medium text-earth-500">{fmtShort(o.approvedAt)}</span>
                            </p>
                          )}
                          {o.status === "Received" && o.receivedAt && (
                            <p className="font-semibold text-blue-700">
                              📦 سلّمها {receivedByName(o.receivedBy)}
                              <span className="text-earth-400"> · </span>
                              <span className="font-medium text-earth-500">{fmtShort(o.receivedAt)}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-sm text-earth-500">
                    لا توجد طلبات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-maroon-100 px-5 py-3.5 text-xs text-earth-600">
          <span>
            عرض <strong className="text-maroon-900">{filtered.length}</strong> من{" "}
            <strong className="text-maroon-900">{orders.length}</strong> طلب
          </span>
          <span>استخدم القائمة المنسدلة لتحديث حالة الطلب.</span>
        </div>
      </Card>
    </div>
  );
}