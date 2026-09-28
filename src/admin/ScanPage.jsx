import { useState, useEffect } from "react";
import { useStore } from "../store.jsx";
import { supabase } from "../lib/supabaseClient.js";

export default function ScanPage() {
  const { currentUser, isAdmin, isSubadmin, canWrite, profiles, receiveOrder, attendanceScope } =
    useStore();
  const [scanned, setScanned] = useState(false);

  // حالة طلب المتجر: انتظار القراءة → عرض للتأكيد → تم
  const [orderState, setOrderState] = useState({
    phase: "idle",
    order: null,
    result: null,
    message: "",
  });
  const [confirmBusy, setConfirmBusy] = useState(false);

  // حالة الحضور: قراءة بيانات العضو → تأكيد يدوي (بدون تسجيل تلقائي)
  const [lookup, setLookup] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  // استخراج الكود من URL — code = كود كشافي (حضور) أو order = رقم طلب (استلم)
  // ولو رقم الطلب جاي في code (بيبدأ بـ ORD-) نحوله لطلب
  const { code, orderCode } = (() => {
    try {
      const params = new URLSearchParams(
        window.location.hash.split("?")[1] || ""
      );
      const order = params.get("order") || "";
      const c = params.get("code") || "";
      const ord = order || (c.toUpperCase().startsWith("ORD-") ? c : "");
      return { code: ord ? "" : c, orderCode: ord };
    } catch {
      return { code: "", orderCode: "" };
    }
  })();

  // لو مش مسجل دخول → حول لصفحة اللوجين وبعدين ارجع هنا
  useEffect(() => {
    if (!currentUser && !scanned) {
      window.location.hash = `#/login?redirect=${encodeURIComponent(
        window.location.hash
      )}`;
    }
  }, [currentUser, scanned]);

  const isOrder = Boolean(orderCode);
  // الحضور: التسجيل لقائد/مسئول الفصل ومسئول المرحلة والأدمن فقط
  const canConfirm = isOrder
    ? isAdmin || canWrite("orders")
    : Boolean(attendanceScope?.is_admin || attendanceScope?.assigned);

  // قراءة بيانات الكشاف للعرض فقط — مفيش أي تسجيل تلقائي
  useEffect(() => {
    if (!code || !currentUser || isOrder) return;

    if (lookup || lookupBusy) return;

    if (!canConfirm) {
      setLookup({ found: false, message: "ليس لديك صلاحية تسجيل الحضور" });
      return;
    }

    setLookupBusy(true);
    supabase
      .rpc("lookup_scout_for_attendance", { p_scout_code: code.trim() })
      .then(({ data, error }) => {
        if (error) throw error;
        setLookup(data ?? { found: false, message: "الكود غير موجود" });
      })
      .catch((err) => {
        setLookup({ found: false, message: err?.message || "فشل قراءة البيانات" });
      })
      .finally(() => setLookupBusy(false));
  }, [code, currentUser, canConfirm, isOrder, lookup, lookupBusy]);

  // ✅ التأكيد الفعلي — بيعمل على السيرفر (record_attendance) بكل الفحوصات:
  // العضو لازم يكون متوزع على فصل والمسئول يكون تابع لفصله/مرحلته
  const handleConfirmAttendance = async () => {
    if (!lookup?.scoutCode || attendanceBusy) return;
    setAttendanceBusy(true);
    try {
      const { data, error } = await supabase.rpc("record_attendance", {
        p_scout_code: lookup.scoutCode,
      });
      if (error) throw error;
      setAttendanceResult(data);
    } catch (err) {
      setAttendanceResult({ success: false, message: err?.message || "فشل التسجيل" });
    } finally {
      setAttendanceBusy(false);
    }
  };

  // ✅ استلام الطلب: السكان بيعرضوا البيانات الأول — والتأكيد بزرار
  useEffect(() => {
    if (!orderCode || !currentUser || orderState.phase !== "idle") return;

    setOrderState((s) => ({ ...s, phase: "loading" }));

    supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderCode.trim())
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setOrderState({
            phase: "error",
            message:
              (error && error.code === "PGRST116") || !data
                ? "الطلب غير موجود — تأكد من الكود أو من صلاحيتك على الطلبات"
                : error?.message || "فشل قراءة الطلب",
          });
          return;
        }
        setOrderState({ phase: "confirm", order: data });
      });
  }, [orderCode, currentUser, orderState.phase]);

  // ✅ التأكيد الفعلي — بيحصل على السيرفر (receive_order) بكل الفحوصات
  const handleConfirmReceive = async () => {
    if (confirmBusy) return;
    setConfirmBusy(true);
    try {
      const received = await receiveOrder(orderCode.trim());
      setOrderState({ phase: "done", result: received });
    } catch (err) {
      setOrderState({
        phase: "done",
        result: { success: false, message: err?.message || String(err) },
      });
    } finally {
      setConfirmBusy(false);
    }
  };

  // زر الرجوع
  const goBack = () => {
    if (isAdmin || isSubadmin) {
      window.location.hash = "#/admin";
    } else {
      window.location.hash = "#/home";
    }
  };

  const ownerEmailOf = (uid) =>
    profiles.find((p) => p.id === uid)?.email || "-";

  const receivedByName = (uid) =>
    profiles.find((p) => p.id === uid)?.name || "-";

  const fmtTime = (t) => {
    try {
      return new Date(t).toLocaleString("ar-EG", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return t;
    }
  };

  const statusLabel = {
    Pending: { text: "⏳ قيد الانتظار — محتاج موافقة المسئول على الطلب الأول", cls: "bg-gold-50 border-gold-300 text-gold-800" },
    Approved: { text: "✅ معتمد وجاهز للاستلام", cls: "bg-forest-50 border-forest-300 text-forest-800" },
    Received: { text: "📦 تم استلامه من قبل", cls: "bg-blue-50 border-blue-300 text-blue-800" },
  };

  const order = orderState.order;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-earth-50 flex items-center justify-center p-4 font-sans"
    >
      <div className="w-full max-w-md">
        {/* العنوان */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-maroon-900">
            {isOrder ? "📦 استلام طلب" : "📱 تسجيل الحضور"}
          </h1>
          <p className="text-sm text-earth-600 mt-1">
            {isOrder ? "راجع بيانات الطلب قبل التأكيد" : "راجع بيانات الكشاف قبل التأكيد"}
          </p>
        </div>

        {/* ===== مسار الطلب: عرض البيانات → تأكيد → تم ===== */}
        {isOrder && orderState.phase === "loading" && (
          <div className="bg-white rounded-xl border border-earth-200 p-8 shadow-sm text-center">
            <span className="animate-spin text-3xl">⏳</span>
            <p className="mt-3 text-sm font-semibold text-earth-600">
              جارِ قراءة بيانات الطلب...
            </p>
          </div>
        )}

        {isOrder && orderState.phase === "error" && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-6 shadow-sm text-center">
            <span className="text-4xl">❌</span>
            <p className="mt-3 font-bold text-red-700">{orderState.message}</p>
          </div>
        )}

        {isOrder && order && orderState.phase === "confirm" && (
          <div className="bg-white rounded-2xl border-2 border-maroon-300 shadow-xl overflow-hidden">
            {/* رأس الكرت */}
            <div className="bg-gradient-to-l from-maroon-800 to-maroon-700 px-5 py-4 text-center">
              <p className="text-[11px] font-bold text-gold-300">
                راجع البيانات قبل التأكيد
              </p>
              <p className="font-mono text-lg font-extrabold text-white tracking-wider" dir="ltr">
                {order.order_id}
              </p>
            </div>

            {/* البيانات */}
            <div className="p-5 space-y-3 text-sm">
              <div className="rounded-xl bg-earth-50 border border-earth-200 p-3.5 space-y-1.5">
                <p className="text-earth-900">
                  <span className="font-bold text-earth-500">العميل (اللي استلم):</span>{" "}
                  <span className="font-extrabold">{order.customer}</span>
                </p>
                <p className="text-earth-700">
                  <span className="font-bold text-earth-500">إيميل صاحب الحساب:</span>{" "}
                  <span className="font-mono text-xs" dir="ltr">
                    {ownerEmailOf(order.user_id)}
                  </span>
                </p>
                <p className="text-earth-900">
                  <span className="font-bold text-earth-500">المنتجات:</span>{" "}
                  <span className="font-semibold">{order.items}</span>
                </p>
                <p className="text-maroon-800">
                  <span className="font-bold text-earth-500">الإجمالي:</span>{" "}
                  <span className="font-extrabold">
                    {Number(order.total).toFixed(2)} ج.م
                  </span>
                </p>
              </div>

              {/* حالة الطلب */}
              <div className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold leading-relaxed ${statusLabel[order.status]?.cls}`}>
                {statusLabel[order.status]?.text}
              </div>

              {/* لو متسلم قبل كده → اعرف مين سلّمه وامتى */}
              {order.status === "Received" && order.received_at && (
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-xs font-semibold text-blue-900">
                  📦 سلّمه: {receivedByName(order.received_by)}
                  <span className="text-blue-400"> · </span>
                  {fmtTime(order.received_at)}
                </div>
              )}

              {/* أزرار التأكيد — بتظهر بس للمعتمد وصاحب الصلاحية */}
              {order.status === "Approved" && canConfirm ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 rounded-xl border border-earth-300 bg-white px-4 py-3 text-sm font-bold text-earth-700 transition hover:bg-earth-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReceive}
                    disabled={confirmBusy}
                    className="flex-[2] cursor-pointer rounded-xl bg-forest-700 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-forest-800 active:scale-[0.99] disabled:opacity-60"
                  >
                    {confirmBusy ? "جارِ التأكيد..." : "✅ تأكيد استلام الطلب"}
                  </button>
                </div>
              ) : order.status === "Pending" ? (
                <p className="rounded-xl bg-gold-50 border border-gold-200 px-3.5 py-2.5 text-[11px] font-semibold text-gold-800">
                  اعتمد الطلب من قسم الطلبات الأول — وبعدها سيبقى جاهز للاستلام.
                </p>
              ) : !canConfirm ? (
                <p className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-[11px] font-semibold text-red-700">
                  ليس لديك صلاحية تسجيل استلام الطلبات.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {/* نتيجة التأكيد */}
        {isOrder && orderState.phase === "done" && (
          <div
            className={`rounded-xl border p-6 shadow-sm ${
              orderState.result?.success === false || orderState.result?.error
                ? "bg-red-50 border-red-200"
                : "bg-green-50 border-green-200"
            }`}
          >
            <div className="text-center mb-4">
              {orderState.result?.success === false || orderState.result?.error ? (
                <>
                  <span className="text-4xl">❌</span>
                  <p className="mt-2 text-lg font-bold text-red-700">
                    {orderState.result?.message ||
                      orderState.result?.error ||
                      "فشل التأكيد"}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-4xl">✅</span>
                  <p className="mt-2 text-lg font-extrabold text-green-800">
                    تم تسجيل الاستلام ✓
                  </p>
                </>
              )}
            </div>

            {order && (
              <div className="rounded-xl bg-white/80 border border-earth-200 p-4 space-y-1.5 text-sm text-earth-900">
                <p>
                  <span className="font-bold text-earth-500">العميل (اللي استلم):</span>{" "}
                  <span className="font-extrabold">{order.customer}</span>
                </p>
                <p>
                  <span className="font-bold text-earth-500">إيميل صاحب الحساب:</span>{" "}
                  <span className="font-mono text-xs" dir="ltr">
                    {ownerEmailOf(order.user_id)}
                  </span>
                </p>
                <p>
                  <span className="font-bold text-earth-500">المنتجات:</span>{" "}
                  {order.items}
                </p>
                <p>
                  <span className="font-bold text-earth-500">الإجمالي:</span>{" "}
                  <span className="font-extrabold text-maroon-800">
                    {Number(order.total).toFixed(2)} ج.م
                  </span>
                </p>
                {orderState.result?.received_at && (
                  <p className="font-semibold text-green-800">
                    🕒 معاد الاستلام: {fmtTime(orderState.result.received_at)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== مسار الحضور: عرض البيانات → تأكيد يدوي ===== */}
        {!isOrder && (
          <>
            {/* حالة التحميل */}
            {lookupBusy && (
              <div className="bg-white rounded-xl border border-earth-200 p-8 shadow-sm text-center">
                <span className="animate-spin text-3xl">⏳</span>
                <p className="mt-3 text-sm font-semibold text-earth-600">
                  جارِ قراءة بيانات الكشاف...
                </p>
              </div>
            )}

            {/* لا يوجد كود */}
            {!code && !lookupBusy && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-6 shadow-sm text-center">
                <span className="text-3xl">❌</span>
                <p className="mt-3 font-bold text-red-700">الكود غير موجود</p>
                <p className="mt-1 text-sm text-red-600">
                  لم يتم تحديد كود في الرابط
                </p>
              </div>
            )}

            {/* بيانات الكشاف للتأكيد */}
            {lookup && lookup.found && !attendanceResult && !lookupBusy && (
              <div className="bg-white rounded-2xl border-2 border-maroon-300 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-l from-maroon-800 to-maroon-700 px-5 py-4 text-center">
                  <p className="text-[11px] font-bold text-gold-300">
                    راجع البيانات قبل تسجيل الحضور
                  </p>
                  <p className="font-mono text-lg font-extrabold text-white tracking-wider" dir="ltr">
                    {lookup.scoutCode}
                  </p>
                </div>

                <div className="p-5 space-y-3 text-sm">
                  <div className="rounded-xl bg-earth-50 border border-earth-200 p-3.5 space-y-1.5">
                    <p className="text-earth-900">
                      <span className="font-bold text-earth-500">الاسم:</span>{" "}
                      <span className="font-extrabold">{lookup.name}</span>
                    </p>
                    {lookup.stage && (
                      <p className="text-earth-900">
                        <span className="font-bold text-earth-500">المرحلة:</span>{" "}
                        {lookup.stage}
                      </p>
                    )}
                    <p className="text-earth-900">
                      <span className="font-bold text-earth-500">الفصل:</span>{" "}
                      {lookup.className || "بدون فصل ⚠️"}
                    </p>
                    <p className="text-earth-900">
                      <span className="font-bold text-earth-500">حالة النهارده:</span>{" "}
                      {lookup.presentToday ? "مسجل حاضر ✅" : "لسه"}
                    </p>
                  </div>

                  {lookup.canRecord && !lookup.presentToday ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={goBack}
                        className="flex-1 rounded-xl border border-earth-300 bg-white px-4 py-3 text-sm font-bold text-earth-700 transition hover:bg-earth-50"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAttendance}
                        disabled={attendanceBusy}
                        className="flex-[2] cursor-pointer rounded-xl bg-forest-700 px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-forest-800 active:scale-[0.99] disabled:opacity-60"
                      >
                        {attendanceBusy ? "جارِ التسجيل..." : "✅ تأكيد تسجيل الحضور"}
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-gold-50 border border-gold-200 px-3.5 py-2.5 text-[11px] font-bold text-gold-800">
                      {lookup.reason || "التسجيل متاح من قسم إدارة الحضور"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* نتيجة التأكيد */}
            {attendanceResult && (
              <div
                className={`rounded-xl border p-6 shadow-sm ${
                  attendanceResult.success
                    ? attendanceResult.scanned
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="text-center mb-4">
                  {attendanceResult.success ? (
                    attendanceResult.scanned ? (
                      <>
                        <span className="text-4xl">⚠️</span>
                        <p className="mt-2 text-lg font-bold text-yellow-800">
                          {attendanceResult.message || "مسجل الحضور مسبقاً اليوم"}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl">✅</span>
                        <p className="mt-2 text-lg font-extrabold text-green-800">
                          {attendanceResult.message || "تم تسجيل الحضور ✓"}
                        </p>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-4xl">❌</span>
                      <p className="mt-2 text-lg font-bold text-red-700">
                        {attendanceResult.message || "فشل التسجيل"}
                      </p>
                    </>
                  )}
                </div>

                {attendanceResult.member && (
                  <div
                    className={`rounded-lg p-4 space-y-2 text-sm ${
                      attendanceResult.success
                        ? attendanceResult.scanned
                          ? "bg-yellow-100/60 text-yellow-900"
                          : "bg-green-100/60 text-green-900"
                        : "bg-red-100/60 text-red-800"
                    }`}
                  >
                    <p>
                      <span className="font-bold">الاسم:</span>{" "}
                      {attendanceResult.member.name}
                    </p>
                    <p>
                      <span className="font-bold">الكود:</span>{" "}
                      <span className="font-mono">{attendanceResult.member.scoutCode}</span>
                    </p>
                    {attendanceResult.member.stage && (
                      <p>
                        <span className="font-bold">المرحلة:</span>{" "}
                        {attendanceResult.member.stage}
                      </p>
                    )}
                    {attendanceResult.member.className && (
                      <p>
                        <span className="font-bold">الفصل:</span>{" "}
                        {attendanceResult.member.className}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* كود غير موجود / خطأ صلاحية */}
            {lookup && !lookup.found && !lookupBusy && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-6 shadow-sm text-center">
                <span className="text-4xl">❌</span>
                <p className="mt-3 font-bold text-red-700">
                  {lookup.message || "الكود غير موجود"}
                </p>
              </div>
            )}
          </>
        )}

        {/* زر الرجوع */}
        {isOrder ? (
          orderState.phase === "confirm" && !confirmBusy ? (
            <div className="mt-6">
              <button
                onClick={goBack}
                className="w-full bg-maroon-700 text-white py-3 rounded-xl text-sm font-bold hover:bg-maroon-800 transition"
              >
                رجوع للوحة الإدارة
              </button>
            </div>
          ) : (
            orderState.phase !== "loading" && (
              <button
                onClick={goBack}
                className="mt-6 w-full bg-maroon-700 text-white py-3 rounded-xl text-sm font-bold hover:bg-maroon-800 transition"
              >
                العودة
              </button>
            )
          )
        ) : (
          !lookupBusy &&
          (lookup || attendanceResult || !code) && (
            <button
              onClick={goBack}
              className="mt-6 w-full bg-maroon-700 text-white py-3 rounded-xl text-sm font-bold hover:bg-maroon-800 transition"
            >
              العودة
            </button>
          )
        )}
      </div>
    </div>
  );
}
