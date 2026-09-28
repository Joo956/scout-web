import { useRef, useState } from "react";

// ExcelJS بيتحمّل عند الطلب بس — بيقلل حجم التحميل الأولي للكل
const loadExcel = () => import("exceljs").then((m) => m.default);
import { supabase } from "../lib/supabaseClient.js";
import { STAGE_PAIRS, stagePairKey } from "../utils/stages.js";

const STAGE_LABEL = Object.fromEntries(
  STAGE_PAIRS.map((p) => [p.key, p.label])
);

const MAROON = "FF4C1D15";
const HEADER_BG = { type: "pattern", pattern: "solid", fgColor: { argb: MAROON } };

const cellText = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Object && !(v instanceof Date)) {
    // خلية غنية (rich text) أو معادلة
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return String(v.result ?? "").trim();
    return "";
  }
  return String(v).trim();
};

// تطبيع الاسم للمطابقة: مسافات + همزات + تاء مربوطة + ألف مقصورة
const normName = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

// ============================================================
// تنزيل ملف إكسل الفصل — فيه بيانات طلاب الفصل جاهزة للتعديل
// ============================================================
export async function downloadClassExcel(classInfo, classMembers) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة المجموعة";

  const ws = wb.addWorksheet("الأعضاء", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "اسم العضو", key: "name", width: 34 },
    { header: "المرحلة", key: "stage", width: 16 },
  ];

  ws.getRow(1).height = 24;
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = HEADER_BG;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD6CFC5" } } };
  });

  const rows = (classMembers ?? []).map((m) => [m.name, m.scoutStage || ""]);
  if (rows.length) ws.addRows(rows);

  const guide = wb.addWorksheet("طريقة الاستخدام", {
    views: [{ rightToLeft: true }],
  });
  guide.columns = [{ width: 3 }, { width: 110 }];
  const lines = [
    `📁 ملف فصل «${classInfo.name}» — ${STAGE_LABEL[classInfo.stage_key] ?? classInfo.stage_key}`,
    "",
    "1️⃣  شيت «الأعضاء» فيه طلاب الفصل الحاليين — عدّل عليه براحتك (عمودين بس: الاسم والمرحلة).",
    "2️⃣  عمود «اسم العضو» هو المفتاح — النظام بيطابق بالاسم زي ما هو مسجل في المنصة.",
    "     (النظام بيتسامح في الهمزات والتاء المربوطة والمسافات الزيادة — بس الاسم نفسه لازم يكون موجود في المنصة).",
    "3️⃣  عاوز تضيف طالب للفصل؟ ضيف صف جديد واكتب اسمه زي ما هو مسجل في المنصة بالظبط.",
    "     ⚠️ لو فيه شخصين في المنصة بنفس الاسم، الرفع هيرفض الاسم ده ويطلب منك تغيير الاسم في المنصة أولًا.",
    "4️⃣  عاوز تشيل طالب من الفصل؟ امسح صفه من الملف — وأثناء الرفع هيطلب منك تأكيد سحبه من الفصل.",
    "5️⃣  عمود «المرحلة» للتحقق بس — لو مرحلة الطالب مختلفة عن مرحلة الفصل هيتم رفضه مع ذكر اسمه.",
    "6️⃣  احفظ الملف بنفس الصيغة (xlsx) وارفعه من زرار «رفع ملف الفصل».",
    "⚠️  الرفع مش بيمسح أي بيانات — بيعرض عليك ملخص بالتغييرات والتأكيد قبل الحفظ.",
  ];
  lines.forEach((line, i) => {
    const row = guide.getRow(i + 1);
    row.getCell(2).value = line;
    if (i === 0) row.getCell(2).font = { bold: true, size: 14, color: { argb: MAROON } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeStage = (STAGE_LABEL[classInfo.stage_key] ?? classInfo.stage_key).replace(/\s*\/\s*/g, "-");
  link.download = `فصل ${classInfo.name} - ${safeStage}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// قراءة ملف الفصل — بترجع صفوف (اسم / مرحلة) والمطابقة بالاسم
// ============================================================
async function parseClassExcel(file) {
  const ExcelJS = await loadExcel();
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("الأعضاء") ?? wb.worksheets[0];
  if (!ws) throw new Error("الملف فاضي — مفيش شيتات");

  // قراءة أسماء الأعمدة من الترويسة (مرن: أي عمود فيه "اسم" هو الاسم)
  const header = ws.getRow(1);
  let nameCol = 0;
  let stageCol = 0;
  header.eachCell((cell, col) => {
    const t = cellText(cell.value);
    if (t.includes("اسم")) nameCol = col;
    else if (t.includes("مرحلة")) stageCol = col;
  });
  if (!nameCol) throw new Error("مفيش عمود «اسم العضو» في أول صف — استخدم الملف المنزّل زي ما هو");

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(nameCol).value);
    const stage = stageCol ? cellText(row.getCell(stageCol).value) : "";
    if (!name) return;
    rows.push({ name, stage });
  });
  return rows;
}

// ============================================================
// المكوّن: زرارا التنزيل والرفع + معاينة التغييرات والتأكيد
// ============================================================
export function ClassExcelTools({ classInfo, allMembers, pushToast, onApplied }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [removeMissing, setRemoveMissing] = useState(true);

  const membersInClass = (allMembers ?? []).filter((m) => m.classId === classInfo.id);

  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadClassExcel(classInfo, membersInClass);
      pushToast(`تم تنزيل ملف فصل «${classInfo.name}»`);
    } catch (err) {
      pushToast(err?.message || "فشل توليد الملف", "error");
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      const rows = await parseClassExcel(file);

      // فهرس بالاسم المطبَّع — والاسم المكرر في المنصة بيترفض (مينفعش نميز بينه)
      const byName = new Map();
      for (const m of allMembers ?? []) {
        const k = normName(m.name);
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(m);
      }

      const seen = new Set();
      const toAssign = [];   // هيتوزعوا على الفصل
      const staying = [];    // موجودين في الفصل أصلاً
      const notFound = [];   // أسماء مش موجودة في المنصة
      const ambiguous = [];  // أسماء مكررة في المنصة
      const conflicts = [];  // مرحلتهم مش من مرحلة الفصل
      let emptySkipped = 0;
      let dupFile = 0;

      for (const r of rows) {
        const nm = normName(r.name);
        if (!nm) {
          emptySkipped += 1;
          continue;
        }
        if (seen.has(nm)) {
          dupFile += 1;
          continue;
        }
        seen.add(nm);

        const candidates = byName.get(nm);
        if (!candidates || candidates.length === 0) {
          notFound.push({ name: r.name });
          continue;
        }
        if (candidates.length > 1) {
          ambiguous.push(...candidates);
          continue;
        }
        const m = candidates[0];
        if (m.classId === classInfo.id) {
          staying.push(m);
          continue;
        }
        if (stagePairKey(m.scoutStage) !== classInfo.stage_key) {
          conflicts.push(m);
          continue;
        }
        toAssign.push(m);
      }

      const fileNames = new Set(seen);
      const missing = membersInClass.filter(
        (m) => !fileNames.has(normName(m.name))
      );

      if (rows.length === 0) {
        pushToast("الملف فاضي — مفيش صفوف", "error");
        return;
      }
      setPreview({ toAssign, staying, notFound, ambiguous, conflicts, missing, emptySkipped, dupFile });
    } catch (err) {
      pushToast(err?.message || "فشل قراءة الملف", "error");
    } finally {
      setBusy(false);
    }
  };

  const applyPreview = async () => {
    if (busy || !preview) return;
    setBusy(true);
    try {
      const errors = [];
      let assigned = 0;
      let removed = 0;

      for (const m of preview.toAssign) {
        const { error } = await supabase.rpc("assign_member_class", {
          p_member_id: m.id,
          p_class_id: classInfo.id,
        });
        if (error) errors.push(`${m.name}: ${error.message}`);
        else assigned += 1;
      }

      if (removeMissing) {
        for (const m of preview.missing) {
          const { error } = await supabase.rpc("assign_member_class", {
            p_member_id: m.id,
            p_class_id: null,
          });
          if (error) errors.push(`${m.name}: ${error.message}`);
          else removed += 1;
        }
      }

      const parts = [];
      if (assigned) parts.push(`تم توزيع ${assigned} على الفصل`);
      if (removed) parts.push(`تم سحب ${removed} من الفصل`);
      if (errors.length) parts.push(`${errors.length} خطأ`);

      if (parts.length === 0) {
        pushToast("مفيش تغييرات لازم تتنفذ");
      } else {
        pushToast(parts.join(" — ") + (errors.length ? ` — أول خطأ: ${errors[0]}` : " ✓"),
          errors.length ? "error" : "success");
      }

      setPreview(null);
      if (assigned || removed) await onApplied?.();
    } finally {
      setBusy(false);
    }
  };

  const names = (list) => list.map((m) => m.name).join("، ");

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="text-xs font-bold text-maroon-700 bg-maroon-50 border border-maroon-200 hover:bg-maroon-100 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
        >
          ⬇️ تنزيل ملف الفصل
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-xs font-bold text-forest-700 bg-forest-50 border border-forest-200 hover:bg-forest-100 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
        >
          ⬆️ رفع ملف الفصل
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      {/* معاينة التغييرات قبل التأكيد */}
      {preview && (
        <div className="mt-3 rounded-lg border border-earth-200 bg-earth-50 p-3 space-y-2.5 text-sm">
          <p className="font-bold text-earth-900">
            📋 راجع التغييرات قبل التأكيد — ملف فصل «{classInfo.name}»
          </p>

          <ul className="space-y-1 text-xs">
            <li className="text-forest-800">
              ✅ هيتوزعوا على الفصل: <span className="font-bold">{preview.toAssign.length}</span>
              {preview.toAssign.length > 0 && (
                <span className="text-earth-600"> ({names(preview.toAssign)})</span>
              )}
            </li>
            <li className="text-earth-600">
              👍 موجودين في الفصل بالفعل (مش هيتغيروا):{" "}
              <span className="font-bold">{preview.staying.length}</span>
            </li>
            {preview.notFound.length > 0 && (
              <li className="text-red-700">
                ❌ أسماء مش موجودة في المنصة (هيتتجاهلوا):{" "}
                <span className="font-bold">{preview.notFound.map((n) => n.name).join("، ")}</span>
              </li>
            )}
            {preview.ambiguous.length > 0 && (
              <li className="text-red-700">
                ⛔ اسم مكرر في المنصة — غيّر الاسمين في إدارة الكشافين الأول:{" "}
                <span className="font-bold">{names(preview.ambiguous)}</span>
              </li>
            )}
            {preview.conflicts.length > 0 && (
              <li className="text-gold-800">
                ⚠️ مرحلتهم مش من مرحلة الفصل (هيتتجاهلوا — صحّح مرحلتهم من إدارة الكشافين):{" "}
                <span className="font-bold">{names(preview.conflicts)}</span>
              </li>
            )}
            {preview.missing.length > 0 && (
              <li className="text-earth-700">
                📤 في الفصل دلوقتي ومش مكتوبين في الملف:{" "}
                <span className="font-bold">{names(preview.missing)}</span>
              </li>
            )}
            {preview.emptySkipped > 0 && (
              <li className="text-earth-500">
                🗑️ صفوف من غير اسم اتتجاهلت: {preview.emptySkipped}
              </li>
            )}
            {preview.dupFile > 0 && (
              <li className="text-earth-500">
                📄 صفوف مكررة بنفس الاسم اتتجاهلت: {preview.dupFile}
              </li>
            )}
          </ul>

          {preview.missing.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-earth-700 cursor-pointer">
              <input
                type="checkbox"
                checked={removeMissing}
                onChange={(e) => setRemoveMissing(e.target.checked)}
                className="accent-maroon-600"
              />
              اسحب اللي مش في الملف من الفصل ({preview.missing.length})
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy}
              className="flex-1 border border-earth-300 bg-white px-3 py-2 rounded-lg text-xs font-bold text-earth-700 hover:bg-earth-100 disabled:opacity-50 transition"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={applyPreview}
              disabled={busy || (preview.toAssign.length === 0 && !(removeMissing && preview.missing.length > 0))}
              className="flex-[2] bg-forest-700 text-white px-3 py-2 rounded-lg text-xs font-extrabold hover:bg-forest-800 disabled:opacity-50 transition"
            >
              {busy ? "جارِ الحفظ..." : "✅ تأكيد وتخزين"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
