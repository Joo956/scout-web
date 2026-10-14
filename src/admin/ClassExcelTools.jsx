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
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return String(v.result ?? "").trim();
    return "";
  }
  return String(v).trim();
};

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
// تنزيل ملف إكسل الفصل — مضاف إليه "الكود الكشفي" واسم العضو والمرحلة
// ============================================================
export async function downloadClassExcel(classInfo, classMembers) {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة المجموعة";

  const ws = wb.addWorksheet("الأعضاء", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "الكود الكشفي", key: "code", width: 20 },
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

  const rows = (classMembers ?? []).map((m) => [
    m.scoutCode || m.scout_code || "",
    m.name || "",
    m.scoutStage || m.scout_stage || ""
  ]);
  if (rows.length) {
    ws.addRows(rows);
  } else {
    // ✅ فصل فاضي — صفوف جاهزة للملء بالكود الكشفي (10 صفوف)
    for (let i = 0; i < 10; i++) {
      const r = ws.addRow(["", "", STAGE_LABEL[classInfo.stage_key] ?? ""]);
      r.height = 20;
    }
  }

  const guide = wb.addWorksheet("طريقة الاستخدام", {
    views: [{ rightToLeft: true }],
  });
  guide.columns = [{ width: 3 }, { width: 110 }];
  const lines = [
    `📁 ملف فصل «${classInfo.name}» — ${STAGE_LABEL[classInfo.stage_key] ?? classInfo.stage_key}`,
    "",
    "1️⃣  شيت «الأعضاء» فيه طلاب الفصل الحاليين مع أكوادهم الكشفية.",
    "2️⃣  عمود «الكود الكشفي» هو الأساس في المطابقة لضمان الدقة وتجنب التشابه في الأسماء.",
    "3️⃣  عاوز تضيف طالب للفصل؟ ضيف صف جديد واكتب الكود الكشفي واسمه زي ما هو في المنصة.",
    "4️⃣  عاوز تشيل طالب من الفصل؟ امسح صفه من الملف — وأثناء الرفع هيطلب منك تأكيد سحبه.",
    "5️⃣  احفظ الملف بنفس الصيغة (xlsx) وارفعه من زرار «رفع ملف الفصل».",
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
// قراءة ملف الفصل — قراءة الكود الكشفي واسم العضو والمرحلة
// ============================================================
async function parseClassExcel(file) {
  const ExcelJS = await loadExcel();
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("الأعضاء") ?? wb.worksheets[0];
  if (!ws) throw new Error("الملف فاضي — مفيش شيتات");

  const header = ws.getRow(1);
  let codeCol = 0;
  let nameCol = 0;
  let stageCol = 0;

  header.eachCell((cell, col) => {
    const t = cellText(cell.value);
    if (t.includes("كود")) codeCol = col;
    else if (t.includes("اسم")) nameCol = col;
    else if (t.includes("مرحلة")) stageCol = col;
  });

  if (!nameCol) throw new Error("مفيش عمود «اسم العضو» في أول صف — استخدم الملف المنزّل زي ما هو");

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = codeCol ? cellText(row.getCell(codeCol).value) : "";
    const name = cellText(row.getCell(nameCol).value);
    const stage = stageCol ? cellText(row.getCell(stageCol).value) : "";
    if (!name && !code) return;
    rows.push({ code, name, stage });
  });
  return rows;
}

// ============================================================
// المكوّن: زرارا التنزيل والرفع + مطابقة الأعضاء بالكود الكشفي
// ============================================================
export function ClassExcelTools({ classInfo, allMembers, pushToast, onApplied }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [removeMissing, setRemoveMissing] = useState(true);

  // فلترة صحيحة للأعضاء التابعين للفصل بغض النظر عن طريقة حفظ الخاصية
  const membersInClass = (allMembers ?? []).filter(
    (m) => m.classId === classInfo.id || m.class_id === classInfo.id
  );

  const onDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadClassExcel(classInfo, membersInClass);
      pushToast(`تم تنزيل ملف فصل «${classInfo.name}» (يضم ${membersInClass.length} عضو)`);
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

      const byCode = new Map();
      const byName = new Map();
      for (const m of allMembers ?? []) {
        const codeVal = m.scoutCode || m.scout_code;
        if (codeVal) byCode.set(codeVal.toString().trim().toLowerCase(), m);
        const k = normName(m.name);
        if (k) {
          if (!byName.has(k)) byName.set(k, []);
          byName.get(k).push(m);
        }
      }

      const seen = new Set();
      const toAssign = [];
      const staying = [];
      const notFound = [];
      const ambiguous = [];
      const conflicts = [];
      let emptySkipped = 0;
      let dupFile = 0;

      for (const r of rows) {
        let m = null;
        const cleanCode = r.code ? r.code.toString().trim().toLowerCase() : "";
        
        if (cleanCode && byCode.has(cleanCode)) {
          m = byCode.get(cleanCode);
        } else {
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
          m = candidates[0];
        }

        if (!m) continue;

        const mClassId = m.classId || m.class_id;
        const mStage = m.scoutStage || m.scout_stage;

        if (mClassId === classInfo.id) {
          staying.push(m);
          continue;
        }
        if (stagePairKey(mStage) !== classInfo.stage_key) {
          conflicts.push(m);
          continue;
        }
        toAssign.push(m);
      }

      const fileCodes = new Set(rows.map(r => r.code ? r.code.toString().trim().toLowerCase() : ""));
      const fileNames = new Set(rows.map(r => normName(r.name)));
      
      const missing = membersInClass.filter(
        (m) => {
          const c = m.scoutCode || m.scout_code;
          const hasCode = c && fileCodes.has(c.toString().trim().toLowerCase());
          const hasName = fileNames.has(normName(m.name));
          return !hasCode && !hasName;
        }
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
          ⬇️ تنزيل ملف الفصل (بالكود)
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
              👍 موجودين في الفصل بالفعل: <span className="font-bold">{preview.staying.length}</span>
            </li>
            {preview.notFound.length > 0 && (
              <li className="text-red-700">
                ❌ أسماء غير مطابقة أو غير موجودة: <span className="font-bold">{preview.notFound.map((n) => n.name).join("، ")}</span>
              </li>
            )}
            {preview.missing.length > 0 && (
              <li className="text-earth-700">
                📤 في الفصل دلوقتي ومش في الملف: <span className="font-bold">{names(preview.missing)}</span>
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