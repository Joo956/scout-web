import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useStore } from "../store.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { STAGE_PAIRS, stagePairKey, STRUCTURE_STAGE_KEYS } from "../utils/stages.js"; // 👈 سطر واحد بس
import { ClassExcelTools } from "./ClassExcelTools.jsx";

// 👇 المراحل اللي ليها هيكل وفصول بس
const STRUCTURE_PAIRS = STAGE_PAIRS.filter((p) =>
  STRUCTURE_STAGE_KEYS.includes(p.key)
);
const STAGE_LABEL = Object.fromEntries(
  STAGE_PAIRS.map((p) => [p.key, p.label])
);
  
const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtTime = (t) =>
  t
    ? new Date(t).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    : "—";


function MemberPicker({ members, onPick, placeholder }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return members
      .filter(
        (m) =>
          (m.name || "").toLowerCase().includes(needle) ||
          (m.scoutCode || "").toLowerCase().includes(needle) ||
          (m.email || "").toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [members, q]);

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "ابحث بالاسم أو الكود لاختيار الشخص..."}
        className="w-full border border-earth-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 outline-none"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-earth-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {matches.map((m) =>
            (m.email || "").trim() ? (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(m);
                  setQ("");
                  setOpen(false);
                }}
                className="w-full text-right px-3 py-2 hover:bg-maroon-50 transition text-sm"
              >
                <span className="font-bold text-earth-900">{m.name}</span>
                <span className="text-xs text-earth-500 font-mono" dir="ltr">
                  {" "}| {m.email}
                </span>
              </button>
            ) : (
              <div
                key={m.id}
                title="التعيين بيبقى لللي لهم إيميل — ضيف إيميله من إدارة الكشافين"
                className="w-full text-right px-3 py-2 text-sm opacity-50 cursor-not-allowed"
              >
                <span className="font-bold text-earth-900">{m.name}</span>
                <span className="text-xs text-gold-700 font-bold">
                  {" "}| من غير إيميل
                </span>
              </div>
            )
          )}
        </div>
      )}
      {open && q.trim() && matches.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-earth-200 rounded-lg shadow-lg px-3 py-2 text-xs text-earth-500">
          مفيش شخص بالاسم ده
        </div>
      )}
    </div>
  );
}

// ============================================================
// تاب الهيكل والفصول (للأدمن العام فقط)
// ============================================================
function StructureTab({
  members,
  pushToast,
  onRefreshStore,
  canManageAll = false,
  managedStages = [],
}) {
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [newNames, setNewNames] = useState({});
  const [busy, setBusy] = useState(false);

  // مسئول المرحلة يشوف مراحله بس — الأدمن يشوف الكل
  const canManageStage = (stageKey) =>
    canManageAll || managedStages.includes(stageKey);
  const stagesToShow = canManageAll
    ? STRUCTURE_PAIRS
    : STRUCTURE_PAIRS.filter((p) => managedStages.includes(p.key));

  const loadClasses = useCallback(async () => {
    const { data } = await supabase
      .from("stage_classes")
      .select("*")
      .order("stage_key")
      .order("name");
    setClasses(data ?? []);
  }, []);

  const loadStaff = useCallback(async () => {
    const { data, error } = await supabase
      .from("attendance_staff")
      .select("*, members(name, scout_code, email)");
    setStaff(error ? [] : (data ?? []));
  }, []);

  useEffect(() => {
    loadClasses();
    loadStaff();
  }, [loadClasses, loadStaff]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      pushToast(err?.message || "حدث خطأ", "error");
    } finally {
      setBusy(false);
    }
  };

  const addClass = (stageKey) =>
    run(async () => {
      const name = (newNames[stageKey] || "").trim();
      if (!name) {
        pushToast("اكتب اسم الفصل الأول", "error");
        return;
      }
      const { data, error } = await supabase.rpc("add_stage_class", {
        p_stage_key: stageKey,
        p_name: name,
      });
      if (error) throw error;
      pushToast(data?.message || "تم إضافة الفصل");
      setNewNames((n) => ({ ...n, [stageKey]: "" }));
      await loadClasses();
    });

  // حذف فصل — الأعضاء بيتسحبوا منه والسجل التاريخي بيفضل محفوظ
  const removeClass = (c) => {
    if (busy) return;
    const ok = window.confirm(
      `متأكد من حذف فصل «${c.name}»؟\nالأعضاء المتوزعين عليه هيبقوا من غير فصل، والسجل التاريخي للحضور هيفضل محفوظ.`
    );
    if (!ok) return;
    run(async () => {
      const { data, error } = await supabase.rpc("remove_stage_class", {
        p_class_id: c.id,
      });
      if (error) throw error;
      pushToast(data?.message || "تم حذف الفصل");
      await Promise.all([loadClasses(), loadStaff(), onRefreshStore?.()]);
    });
  };

  const assignStaff = (role, stageKey, classId, memberId) =>
    run(async () => {
      const { data, error } = await supabase.rpc("assign_attendance_staff", {
        p_role: role,
        p_stage_key: stageKey,
        p_class_id: classId,
        p_member_id: memberId,
      });
      if (error) throw error;
      pushToast(data?.message || "تم التعيين");
      await loadStaff();
    });

  const unassignStaff = (staffId) =>
    run(async () => {
      const { data, error } = await supabase.rpc("unassign_attendance_staff", {
        p_staff_id: staffId,
      });
      if (error) throw error;
      pushToast(data?.message || "تم إلغاء التعيين");
      await loadStaff();
    });

  const setMemberClass = (memberId, classId) =>
    run(async () => {
      const { data, error } = await supabase.rpc("assign_member_class", {
        p_member_id: memberId,
        p_class_id: classId || null,
      });
      if (error) throw error;
      pushToast(data?.message || "تم التوزيع");
      await onRefreshStore?.();
    });

  const staffName = (s) => s?.members?.name || "—";

  // أعضاء بدون مرحلة معروفة — محتاجين تصحيح مرحلة قبل التوزيع
  const unknownStageMembers = members.filter(
    (m) => m.scoutStage && !stagePairKey(m.scoutStage)
  );

  return (
    <div className="space-y-5">
      {stagesToShow.map((pair) => {
        const stageClasses = classes.filter((c) => c.stage_key === pair.key);
        const stageMembers = members.filter(
          (m) => stagePairKey(m.scoutStage) === pair.key
        );
        const stageSupervisor = staff.find(
          (s) => s.role === "stage_supervisor" && s.stage_key === pair.key
        );
        const unassigned = stageMembers.filter((m) => !m.classId).length;

        return (
          <div
            key={pair.key}
            className="bg-white rounded-xl border border-earth-200 shadow-sm overflow-hidden"
          >
            {/* رأس المرحلة */}
            <div className="bg-maroon-50 px-4 py-3 border-b border-maroon-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-maroon-900">
                  {pair.label}
                  <span className="text-xs font-bold text-earth-500 mr-2">
                    ({stageClasses.length} فصل · {stageMembers.length} عضو)
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-earth-600">
                    {stageSupervisor
                      ? `مسئول المرحلة: ${staffName(stageSupervisor)}`
                      : "مفيش مسئول للمرحلة"}
                  </span>
                  {stageSupervisor && canManageAll && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => unassignStaff(stageSupervisor.id)}
                      title="إلغاء تعيين مسئول المرحلة"
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              {/* تعيين مسئول المرحلة = أدمن عام فقط */}
              {!stageSupervisor && canManageAll && (
                <div className="mt-2">
                  <MemberPicker
                    members={members}
                    placeholder="ابحث واختر مسئول المرحلة (لازم يكون له إيميل)..."
                    onPick={(m) => assignStaff("stage_supervisor", pair.key, null, m.id)}
                  />
                </div>
              )}
            </div>

            {/* الفصول */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {stageClasses.map((c) => {
                const supervisor = staff.find(
                  (s) => s.role === "class_supervisor" && s.class_id === c.id
                );
                const leaders = staff.filter(
                  (s) => s.role === "class_leader" && s.class_id === c.id
                );
                const classCount = members.filter((m) => m.classId === c.id).length;

                return (
                  <div key={c.id} className="border border-earth-200 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-earth-900">{c.name}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-xs font-bold bg-earth-100 text-earth-700 px-2 py-0.5 rounded-full">
                          {classCount} عضو
                        </span>
                        {/* حذف الفصل — للأدمن أو مسئول المرحلة */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeClass(c)}
                          title="حذف الفصل (الأعضاء هيتسحبوا منه والسجل التاريخي هيفضل)"
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 text-xs font-bold border border-red-200 bg-red-50 rounded-lg px-2 py-1 transition"
                        >
                          🗑 حذف
                        </button>
                      </span>
                    </div>

                    {/* أزرار ملف الفصل: تنزيل بيانات الطلاب / رفع الملف بعد التعديل */}
                    <ClassExcelTools
                      classInfo={c}
                      allMembers={members}
                      pushToast={pushToast}
                      onApplied={onRefreshStore}
                    />

                    {/* مسئول الفصل */}
                    <div className="text-sm">
                      <span className="text-earth-500 font-bold text-xs">مسئول الفصل: </span>
                      {supervisor ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-bold text-earth-900">{staffName(supervisor)}</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => unassignStaff(supervisor.id)}
                            title="إلغاء تعيين مسئول الفصل"
                            className="text-red-500 hover:text-red-700 disabled:opacity-50 font-bold"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <div className="mt-1">
                          <MemberPicker
                            members={members}
                            placeholder="ابحث واختر مسئول الفصل..."
                            onPick={(m) => assignStaff("class_supervisor", pair.key, c.id, m.id)}
                          />
                        </div>
                      )}
                    </div>

                    {/* قادة الفصل (مدرسين) */}
                    <div className="text-sm">
                      <span className="text-earth-500 font-bold text-xs">
                        قائد/قائدة الفصل (مدرسين):{" "}
                      </span>
                      {leaders.length > 0 && (
                        <span className="inline-flex flex-wrap gap-1 align-middle">
                          {leaders.map((l) => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1 bg-gold-50 border border-gold-200 rounded-full px-2 py-0.5 text-xs font-bold text-earth-800"
                            >
                              {staffName(l)}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => unassignStaff(l.id)}
                                title="إلغاء تعيين القائد"
                                className="text-red-500 hover:text-red-700 disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </span>
                      )}
                      <div className="mt-1">
                        <MemberPicker
                          members={members}
                          placeholder="ابحث واختر قائد/قائدة للفصل..."
                          onPick={(m) => assignStaff("class_leader", pair.key, c.id, m.id)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* إضافة فصل جديد */}
              <div className="border border-dashed border-earth-300 rounded-lg p-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newNames[pair.key] || ""}
                  onChange={(e) =>
                    setNewNames((n) => ({ ...n, [pair.key]: e.target.value }))
                  }
                  placeholder="اسم فصل جديد..."
                  className="flex-1 border border-earth-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-maroon-500"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => addClass(pair.key)}
                  disabled={busy || !(newNames[pair.key] || "").trim()}
                  className="bg-maroon-700 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-maroon-800 disabled:opacity-50 transition whitespace-nowrap"
                >
                  + إضافة فصل
                </button>
              </div>
            </div>

            {/* توزيع الأعضاء على الفصول */}
            <details className="border-t border-earth-100">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-bold text-maroon-800 hover:bg-maroon-50 transition select-none">
                🧑‍🤝‍🧑 توزيع الأعضاء على الفصول
                {unassigned > 0 && (
                  <span className="mr-2 text-xs bg-gold-100 text-gold-800 px-2 py-0.5 rounded-full">
                    {unassigned} بدون فصل
                  </span>
                )}
              </summary>
              <div className="px-4 pb-4 space-y-2">
                {stageMembers.length === 0 ? (
                  <p className="text-sm text-earth-400 py-2">
                    مفيش أعضاء في المرحلة دي
                  </p>
                ) : (
                  stageMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="font-bold text-earth-900 min-w-40">{m.name}</span>
                      <span className="font-mono text-xs text-earth-500">{m.scoutCode}</span>
                      <select
                        value={m.classId || ""}
                        onChange={(e) => setMemberClass(m.id, e.target.value)}
                        disabled={busy}
                        className="border border-earth-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-maroon-500 disabled:opacity-50"
                      >
                        <option value="">بدون فصل</option>
                        {stageClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>
        );
      })}

      {/* أعضاء مرحلتهم مش معروفة */}
      {unknownStageMembers.length > 0 && (
        <div className="rounded-xl bg-gold-50 border border-gold-300 px-4 py-3 text-sm text-gold-900">
          <p className="font-bold">
            ⚠️ {unknownStageMembers.length} عضو مرحلتهم مش معروفة
          </p>
          <p className="mt-1 text-xs">
            صحّح مرحلتهم من إدارة الكشافين الأول عشان يقدروا يتوزعوا على فصول:{" "}
            {unknownStageMembers.map((m) => m.name).join("، ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// إضافة عضو للفصل — قائمة بالأعضاء اللي في مرحلة الفصل ومش فيه
// ============================================================
function ClassAddMember({
  stageClasses,
  stageMembers,
  currentClassId,
  busyId,
  onAdd,
}) {
  const [pick, setPick] = useState("");
  const candidates = stageMembers
    .filter((m) => m.classId !== currentClassId)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

  if (candidates.length === 0) return null;

  return (
    <div className="pt-2 border-t border-earth-100 flex items-center gap-1.5">
      <select
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        disabled={Boolean(busyId)}
        className="flex-1 min-w-0 border border-earth-200 rounded px-1.5 py-1 text-[11px] outline-none focus:border-maroon-500 disabled:opacity-50"
      >
        <option value="">+ إضافة عضو للفصل...</option>
        {candidates.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.classId ? " (منتقل من فصل تاني)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!pick || Boolean(busyId)}
        onClick={() => {
          const m = candidates.find((x) => x.id === pick);
          if (m) {
            onAdd(m);
            setPick("");
          }
        }}
        className="bg-forest-700 text-white px-2 py-1 rounded text-[11px] font-bold hover:bg-forest-800 disabled:opacity-50 transition whitespace-nowrap"
      >
        إضافة
      </button>
    </div>
  );
}

// ============================================================
// تاب العرض الشامل: كل مرحلة/فصل — مين الأعضاء ومين المسئولين
// (للأدمن العام — عرض للقراءة فقط مع زرار طباعة)
// ============================================================
function OverviewTab({ members, classes, pushToast, onRefreshStore }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  // إضافة/تعديل/مسح عضو في الفصل — كل العمليات على السيرفر بفحص المرحلة
  const setMemberClass = async (member, classId, classLabel) => {
    if (busyId) return;
    setBusyId(member.id);
    try {
      const { data, error } = await supabase.rpc("assign_member_class", {
        p_member_id: member.id,
        p_class_id: classId || null,
      });
      if (error) throw error;
      pushToast(
        classId
          ? "تم نقل " + member.name + " إلى " + (classLabel || "الفصل")
          : "تم سحب " + member.name + " من الفصل"
      );
      await onRefreshStore?.();
    } catch (err) {
      pushToast(err?.message || "فشل التعديل", "error");
    } finally {
      setBusyId("");
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("attendance_staff")
        .select("role, stage_key, class_id, members(name)");
      if (!alive) return;
      setStaff(error ? [] : (data ?? []));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const staffName = (row) => row?.members?.name || "-";

  if (loading) {
    return (
      <div className="py-16 text-center text-earth-500">
        <span className="animate-spin text-2xl">⏳</span>
        <p className="mt-2 text-sm">جارِ تحميل العرض...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-earth-600">
          👥 كل مرحلة وفصولها — الأعضاء اللي في كل فصل ومين المسئول عنهم
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-xs font-bold text-maroon-700 bg-maroon-50 border border-maroon-200 hover:bg-maroon-100 px-3 py-1.5 rounded-lg transition"
        >
          🖨️ طباعة العرض
        </button>
      </div>

      {STRUCTURE_PAIRS.map((pair) => {
        const stageMembers = members.filter(
          (m) => stagePairKey(m.scoutStage) === pair.key
        );
        const stageClasses = classes
          .filter((c) => c.stage_key === pair.key)
          .sort((a, b) => a.name.localeCompare(b.name, "ar"));
        const supervisor = staff.find(
          (r) => r.role === "stage_supervisor" && r.stage_key === pair.key
        );
        const unassigned = stageMembers.filter((m) => !m.classId);

        return (
          <div
            key={pair.key}
            className="bg-white rounded-xl border border-earth-200 shadow-sm overflow-hidden"
          >
            <div className="bg-maroon-50 px-4 py-3 border-b border-maroon-100 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-maroon-900">
                {pair.label}
                <span className="text-xs font-bold text-earth-500 mr-2">
                  ({stageMembers.length} عضو · {stageClasses.length} فصل)
                </span>
              </h3>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${supervisor
                  ? "bg-white text-maroon-800 border border-maroon-200"
                  : "bg-gold-100 text-gold-800"
                  }`}
              >
                {supervisor
                  ? `مسئول المرحلة: ${staffName(supervisor)}`
                  : "مفيش مسئول للمرحلة"}
              </span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {stageClasses.map((c) => {
                const clsSupervisor = staff.find(
                  (r) => r.role === "class_supervisor" && r.class_id === c.id
                );
                const leaders = staff.filter(
                  (r) => r.role === "class_leader" && r.class_id === c.id
                );
                const classMembers = members.filter((m) => m.classId === c.id);

                return (
                  <div
                    key={c.id}
                    className="border border-earth-200 rounded-lg p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-earth-900">{c.name}</span>
                      <span className="text-xs font-bold bg-earth-100 text-earth-700 px-2 py-0.5 rounded-full">
                        {classMembers.length} عضو
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p>
                        <span className="font-bold text-earth-500">مسئول الفصل: </span>
                        <span
                          className={
                            clsSupervisor
                              ? "font-bold text-earth-900"
                              : "text-gold-800 font-bold"
                          }
                        >
                          {clsSupervisor ? staffName(clsSupervisor) : "مفيش"}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-earth-500">قادة الفصل: </span>
                        {leaders.length ? (
                          <span className="font-bold text-earth-900">
                            {leaders.map(staffName).join("، ")}
                          </span>
                        ) : (
                          <span className="text-gold-800 font-bold">مفيش</span>
                        )}
                      </p>
                    </div>

                    {classMembers.length === 0 ? (
                      <p className="text-xs text-earth-400 pt-1 border-t border-earth-100">
                        مفيش أعضاء متوزعين على الفصل ده
                      </p>
                    ) : (
                      <ul className="pt-1.5 border-t border-earth-100 space-y-1.5">
                        {classMembers
                          .slice()
                          .sort((a, b) =>
                            (a.name || "").localeCompare(b.name || "", "ar")
                          )
                          .map((m) => (
                            <li
                              key={m.id}
                              className="text-xs text-earth-800 flex items-center gap-1.5"
                            >
                              <span className="font-semibold truncate flex-1">
                                {m.name}
                              </span>
                              <span
                                className="font-mono text-[10px] text-earth-400"
                                dir="ltr"
                              >
                                {m.scoutCode}
                              </span>
                              <select
                                value={c.id}
                                disabled={Boolean(busyId)}
                                onChange={(e) => {
                                  const target = stageClasses.find(
                                    (x) => x.id === e.target.value
                                  );
                                  if (target && target.id !== c.id)
                                    setMemberClass(m, target.id, target.name);
                                }}
                                title="نقل لفصل تاني"
                                className="border border-earth-200 rounded px-1 py-0.5 text-[10px] text-earth-600 outline-none focus:border-maroon-500 disabled:opacity-50 max-w-24"
                              >
                                {stageClasses.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => setMemberClass(m, null)}
                                title={"سحب " + m.name + " من الفصل"}
                                className="text-red-400 hover:text-red-700 disabled:opacity-50 font-bold"
                              >
                                X
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}

                    <ClassAddMember
                      stageClasses={stageClasses}
                      stageMembers={stageMembers}
                      currentClassId={c.id}
                      busyId={busyId}
                      onAdd={(m) => setMemberClass(m, c.id, c.name)}
                    />
                  </div>
                );
              })}

              {/* الأعضاء اللي مش متوزعين على أي فصل */}
              {unassigned.length > 0 && (
                <div className="border border-dashed border-gold-300 rounded-lg p-3">
                  <p className="text-xs font-bold text-gold-800 mb-1.5">
                    ⚠️ بدون فصل ({unassigned.length})
                  </p>
                  <p className="text-xs text-earth-600 leading-relaxed">
                    {unassigned.map((m) => m.name).join("، ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// القسم الرئيسي: إدارة الحضور
// ============================================================
/* ============================================================
   تاب التقارير — تقرير حضور سنوي / شهري / يومي لكل الفصول
   الفلاتر متسلسلة: الفصل ← السنة ← الشهر ← اليوم
   لكل عضو: حضر كام مرة، غاب كام مرة، وحضر أيام إيه
   ============================================================ */
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const fmtDayShort = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });

const pct = (attended, sessions) =>
  sessions > 0 ? Math.round(((attended ?? 0) / sessions) * 100) : 0;

function ReportsTab({ classes }) {
  const [options, setOptions] = useState(null);
  const [classId, setClassId] = useState(""); // "" = كل الفصول
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(""); // "" = السنة كلها
  const [day, setDay] = useState(""); // "" = كل الأيام
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // السنوات المتاحة من البيانات
  useEffect(() => {
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc("get_attendance_report_options");
        if (rpcErr) throw rpcErr;
        setOptions(data ?? { years: [], classes: [] });
      } catch (err) {
        setError(err?.message || String(err));
        setOptions({ years: [], classes: [] });
      }
    })();
  }, []);

  const loadReport = useCallback(async () => {
    if (!year) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_attendance_report", {
        p_year: Number(year),
        p_month: month ? Number(month) : null,
        p_day: day || null,
        p_class_id: classId || null,
      });
      if (rpcErr) throw rpcErr;
      setRows(data ?? []);
    } catch (err) {
      setError(err?.message || String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, day, classId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // تغيير الفصل/السنة/الشهر يلغي اختيار اليوم (أيام جديدة للفترة الجديدة)
  useEffect(() => {
    setDay("");
  }, [classId, year, month]);

  // أيام الاجتماع المتاحة في الفترة الحالية (من البيانات نفسها)
  const availableDays = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => (r.session_dates ?? []).forEach((d) => set.add(d)));
    return [...set].sort();
  }, [rows]);

  // بحث بالاسم/الكود
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.member_name} ${r.scout_code}`.toLowerCase().includes(q)
    );
  }, [rows, query]);

  // ملخص الفصول
  const classSummary = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const c = map.get(r.class_id) ?? {
        class_id: r.class_id,
        class_name: r.class_name,
        session_days: r.session_days ?? 0,
        session_dates: r.session_dates ?? [],
        attended: 0,
        members: 0,
        top: null,
      };
      c.attended += r.attended ?? 0;
      c.members += 1;
      if (!c.top || (r.attended ?? 0) > c.top.attended) {
        c.top = { name: r.member_name, attended: r.attended ?? 0 };
      }
      map.set(r.class_id, c);
    });
    return [...map.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, "ar"));
  }, [rows]);

  // الإجماليات
  const totals = useMemo(() => {
    const totalSessions = rows.reduce((s, r) => s + (r.session_days ?? 0), 0);
    const totalAttended = rows.reduce((s, r) => s + (r.attended ?? 0), 0);
    const totalAbsent = rows.reduce(
      (s, r) => s + Math.max(0, (r.session_days ?? 0) - (r.attended ?? 0)),
      0
    );
    return {
      members: rows.length,
      sessions: new Set(rows.flatMap((r) => r.session_dates ?? [])).size,
      totalSessions,
      totalAttended,
      totalAbsent,
      rate: totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0,
    };
  }, [rows]);

  // تصدير CSV (يفتح في Excel بالعربي)
  const exportCsv = () => {
    const header = ["الفصل", "الكود", "الاسم", "أيام الاجتماع", "حضر", "غاب", "نسبة الحضور %", "أيام الحضور"];
    const lines = filteredRows.map((r) => [
      r.class_name,
      r.scout_code,
      r.member_name,
      r.session_days ?? 0,
      r.attended ?? 0,
      Math.max(0, (r.session_days ?? 0) - (r.attended ?? 0)),
      pct(r.attended, r.session_days),
      (r.present_dates ?? []).map(fmtDayShort).join(" | "),
    ]);
    const csv =
      "\uFEFF" +
      [header, ...lines]
        .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-الحضور-${year}${month ? `-${month}` : ""}${day ? `-${day}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = `${month ? `${AR_MONTHS[month - 1]} ` : ""}${year}${day ? ` — ${fmtDayShort(day)}` : ""}`;
  const periodChips = [
    { label: "الفصل", value: classId ? (classes.find((c) => c.id === classId)?.name || "—") : "كل الفصول" },
    { label: "الفترة", value: periodLabel },
    { label: "الأعضاء", value: totals.members },
    { label: "أيام الاجتماع", value: totals.sessions },
    { label: "مرات الحضور", value: totals.totalAttended },
    { label: "مرات الغياب", value: totals.totalAbsent },
    { label: "نسبة الحضور", value: `${totals.rate}%` },
  ];

  const inputCls2 =
    "w-full border border-earth-300 rounded-lg px-3 py-2 text-sm shadow-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 bg-white";

  return (
    <div className="space-y-4">
      {/* ===== الفلاتر المتسلسلة ===== */}
      <div className="bg-white rounded-xl border border-earth-200 p-5 shadow-sm print:hidden">
        <h3 className="text-sm font-bold text-earth-800 mb-3">🔎 اختار الفصل ← السنة ← الشهر ← اليوم (كل خطوة اختيارية)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="block text-xs font-bold text-earth-600 mb-1">الفصل</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls2}>
              <option value="">كل الفصول</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {STAGE_LABEL[c.stage_key] || c.stage_key}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-earth-600 mb-1">السنة</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls2}>
              {(options?.years?.length ? options.years : [new Date().getFullYear()]).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-earth-600 mb-1">الشهر</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls2}>
              <option value="">السنة كلها</option>
              {AR_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-earth-600 mb-1">
              اليوم {availableDays.length > 0 && <span className="text-earth-400">({availableDays.length} يوم اجتماع)</span>}
            </span>
            <select value={day} onChange={(e) => setDay(e.target.value)} className={inputCls2}>
              <option value="">كل الأيام</option>
              {availableDays.map((d) => (
                <option key={d} value={d}>{fmtDayShort(d)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="cursor-pointer rounded-lg border border-maroon-200 bg-maroon-50 px-4 py-2 text-sm font-bold text-maroon-700 transition hover:bg-maroon-100"
          >
            🖨️ طباعة التقرير
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
            className="cursor-pointer rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⬇️ تصدير Excel (CSV)
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* ===== رأس التقرير + الإجماليات ===== */}
      <div className="bg-white rounded-xl border border-earth-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-earth-200 bg-maroon-50/60">
          <h3 className="font-bold text-maroon-900">
            📊 تقرير الحضور — {periodChips[0].value} • {periodLabel}
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-x-reverse divide-earth-100 border-b border-earth-100">
          {[
            { label: "الأعضاء", value: totals.members, cls: "text-maroon-700" },
            { label: "أيام الاجتماع", value: totals.sessions, cls: "text-blue-700" },
            { label: "مرات الحضور", value: totals.totalAttended, cls: "text-green-700" },
            { label: "مرات الغياب", value: totals.totalAbsent, cls: "text-red-700" },
            { label: "نسبة الحضور", value: `${totals.rate}%`, cls: "text-gold-700" },
            {
              label: "المتوسط لليوم",
              value: totals.sessions > 0 ? Math.round(totals.totalAttended / totals.sessions) : 0,
              cls: "text-earth-700",
            },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <div className={`text-2xl font-extrabold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-earth-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ملخص الفصول — بيظهر لما تكون «كل الفصول» */}
        {classId === "" && classSummary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-earth-50 border-b border-earth-200">
                <tr>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">الفصل</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">الأعضاء</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">أيام الاجتماع</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">مرات الحضور</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">نسبة الحضور</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-earth-700">الأكثر انتظاماً</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {classSummary.map((c) => (
                  <tr key={c.class_id} className="hover:bg-earth-50 transition">
                    <td className="px-4 py-2.5 text-sm font-bold text-earth-900">{c.class_name}</td>
                    <td className="px-4 py-2.5 text-sm text-earth-700">{c.members}</td>
                    <td className="px-4 py-2.5 text-sm text-earth-700">{c.session_days}</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-green-700">{c.attended}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-earth-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-600"
                            style={{ width: `${pct(c.attended, c.session_days * c.members)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-earth-700">
                          {pct(c.attended, c.session_days * c.members)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-earth-600">
                      {c.top ? `${c.top.name} (${c.top.attended})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== تفاصيل الأعضاء ===== */}
      <div className="bg-white rounded-xl border border-earth-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-earth-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-maroon-900">
            👤 تفاصيل الأعضاء ({filteredRows.length})
            {day && <span className="text-sm font-bold text-earth-500"> — حضور يوم {fmtDayShort(day)}</span>}
          </h3>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 ابحث بالاسم أو الكود..."
            className="w-full sm:w-64 border border-earth-300 rounded-lg px-3 py-2 text-sm shadow-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-earth-500">
            <span className="animate-spin text-2xl">⏳</span>
            <p className="mt-2 text-sm">جارِ تحميل التقرير...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center text-earth-400 text-sm">
            مفيش بيانات حضور في الفترة المختارة — جرب سنة أو شهر تاني
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-maroon-50 border-b border-maroon-100">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">#</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الكود</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الاسم</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الفصل</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">أيام الاجتماع</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">حضر</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">غاب</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الانتظام</th>
                  <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">أيام الحضور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-100">
                {filteredRows.map((r, idx) => {
                  const absent = Math.max(0, (r.session_days ?? 0) - (r.attended ?? 0));
                  const rate = pct(r.attended, r.session_days);
                  const dates = r.present_dates ?? [];
                  return (
                    <tr key={r.member_id} className="hover:bg-earth-50 transition">
                      <td className="px-4 py-3 text-sm text-earth-500">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-bold text-maroon-700 bg-maroon-50 px-2 py-1 rounded border border-maroon-100" dir="ltr">
                          {r.scout_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-earth-900">{r.member_name}</td>
                      <td className="px-4 py-3 text-sm text-earth-700">{r.class_name}</td>
                      <td className="px-4 py-3 text-sm text-earth-700">{r.session_days ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-extrabold px-2 py-1 rounded-full ${(r.attended ?? 0) > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                          {r.attended ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-extrabold px-2 py-1 rounded-full ${absent > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
                          {absent}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-earth-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rate >= 75 ? "bg-green-600" : rate >= 50 ? "bg-gold-500" : "bg-red-500"}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-earth-700">{rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {dates.length === 0 ? (
                          <span className="text-xs text-earth-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {dates.slice(0, 12).map((d) => (
                              <span key={d} className="rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                {fmtDayShort(d)}
                              </span>
                            ))}
                            {dates.length > 12 && (
                              <span className="rounded-full bg-earth-50 border border-earth-200 px-2 py-0.5 text-[10px] font-bold text-earth-600">
                                +{dates.length - 12}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttendanceSection({ readOnly = false }) {
  const { members, attendanceScope, isAdmin, canWrite, canRead, refreshData } =
    useStore();

  // ===== النطاق =====
  const scope = attendanceScope;
  const scopeLoading = scope === null;
  // الأدمن بس يشوف كل الفصول — أصحاب الصلاحيات القديمة بقوا عرض فقط
  const adminAll = Boolean(scope?.is_admin);
  const isAssigned = Boolean(scope?.assigned);
  const isStageSupervisor = (scope?.stages ?? []).length > 0;
  // تاب الهيكل: الأدمن + مسئول المرحلة (بيدير فصول مرحلته ومسئوليها)
  const canManageStructure = Boolean(
    scope?.can_manage ?? (scope?.is_admin || isStageSupervisor)
  );

  // سكان + تسجيل: أدمن أو معيَّن في الهيكل فقط
  // (قائد/مسئول الفصل + مسئول المرحلة — صلاحيات attendance:write القديمة عرض فقط)
  const canRecordNow = Boolean(
    scope?.can_record ?? (scope?.is_admin || scope?.assigned)
  );
  const canScan = !readOnly && canRecordNow;
  // عرض السجل: المعيَّنون + أصحاب صلاحيات المشاهدة — السجل مفلتر على السيرفر بالنطاق
  const canViewLog =
    adminAll ||
    isAssigned ||
    isAdmin ||
    canRead("attendance") ||
    canWrite("members") ||
    Boolean(scope?.legacy_view);

  // ===== التابات =====
  const [tab, setTab] = useState("record");

  // ===== الفصول والتواريخ =====
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // ===== كشف الفصل =====
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rowBusy, setRowBusy] = useState("");

  // ===== السكان (عرض ثم تأكيد) =====
  const [scanInput, setScanInput] = useState("");
  const [lookup, setLookup] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [autoFocus, setAutoFocus] = useState(true);
  const inputRef = useRef(null);

  // ===== السجل =====
  const [log, setLog] = useState([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // ===== تنبيهات =====
  const [toasts, setToasts] = useState([]);
  const pushToast = useCallback((message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  // ===== تحميل الفصول =====
  const loadClasses = useCallback(async () => {
    const { data } = await supabase
      .from("stage_classes")
      .select("*")
      .order("stage_key")
      .order("name");
    setClasses(data ?? []);
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // ===== الفصول المتاحة حسب النطاق =====
  const visibleClasses = useMemo(() => {
    if (adminAll) return classes;
    const stages = scope?.stages ?? [];
    const ids = scope?.class_ids ?? [];
    return classes.filter(
      (c) => stages.includes(c.stage_key) || ids.includes(c.id)
    );
  }, [classes, adminAll, scope?.stages, scope?.class_ids]);

  // لو الفصل المختار خارج النطاق (أو فاضي) → أول فصل متاح
  useEffect(() => {
    if (visibleClasses.length === 0) {
      if (selectedClassId) setSelectedClassId("");
      return;
    }
    if (!visibleClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(visibleClasses[0].id);
    }
  }, [visibleClasses, selectedClassId]);

  // ===== كشف الفصل =====
  const loadRoster = useCallback(async (classId, date) => {
    if (!classId) {
      setRoster([]);
      return;
    }
    setLoadingRoster(true);
    try {
      const { data, error } = await supabase.rpc("get_class_roster", {
        p_class_id: classId,
        p_date: date,
      });
      if (error) throw error;
      setRoster(data ?? []);
    } catch {
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  // ===== سجل الحضور (مفلتر بالنطاق على السيرفر) =====
  const loadLog = useCallback(async (date) => {
    setLoadingLog(true);
    try {
      const { data, error } = await supabase.rpc("get_attendance_log_scoped", {
        p_date: date,
      });
      if (error) throw error;
      setLog(data ?? []);
    } catch {
      setLog([]);
    } finally {
      setLoadingLog(false);
    }
  }, []);

  const refreshAfterChange = useCallback(async () => {
    await Promise.all([
      loadRoster(selectedClassId, selectedDate),
      loadLog(selectedDate),
    ]);
  }, [loadRoster, loadLog, selectedClassId, selectedDate]);

  useEffect(() => {
    loadRoster(selectedClassId, selectedDate);
  }, [selectedClassId, selectedDate, loadRoster]);

  useEffect(() => {
    loadLog(selectedDate);
  }, [selectedDate, loadLog]);

  // ===== تسجيل / إلغاء من كشف الفصل =====
  const recordMember = async (member) => {
    if (rowBusy) return;
    setRowBusy(member.member_id);
    try {
      const { data, error } = await supabase.rpc("record_attendance", {
        p_scout_code: member.scout_code,
      });
      if (error) throw error;
      pushToast(data?.message || "تم التسجيل");
      await refreshAfterChange();
    } catch (err) {
      pushToast(err?.message || "فشل التسجيل", "error");
    } finally {
      setRowBusy("");
    }
  };

  const undoMember = async (member) => {
    if (rowBusy) return;
    setRowBusy(member.member_id);
    try {
      const { data, error } = await supabase.rpc("undo_attendance", {
        p_scout_code: member.scout_code,
      });
      if (error) throw error;
      pushToast(data?.message || "تم الإلغاء");
      await refreshAfterChange();
    } catch (err) {
      pushToast(err?.message || "فشل الإلغاء", "error");
    } finally {
      setRowBusy("");
    }
  };

  // ===== السكان: قراءة البيانات فقط ثم تأكيد يدوي =====
  const handleLookup = async (code) => {
    const trimmed = (code || "").trim();
    if (!trimmed || scanBusy) return;
    setScanBusy(true);
    setLookup(null);
    try {
      const { data, error } = await supabase.rpc("lookup_scout_for_attendance", {
        p_scout_code: trimmed,
      });
      if (error) throw error;
      setLookup({ ...data, code: trimmed });
    } catch (err) {
      setLookup({ found: false, message: err?.message || "فشل السكان", code: trimmed });
    } finally {
      setScanBusy(false);
      setScanInput("");
      if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const confirmLookup = async () => {
    if (!lookup?.code || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const { data, error } = await supabase.rpc("record_attendance", {
        p_scout_code: lookup.code,
      });
      if (error) throw error;
      pushToast(data?.message || "تم تسجيل الحضور");
      setLookup(null);
      await refreshAfterChange();
    } catch (err) {
      pushToast(err?.message || "فشل التسجيل", "error");
    } finally {
      setConfirmBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleLookup(scanInput);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup(scanInput);
    }
  };

  // لو في ?code= في URL → قراءة البيانات (بدون تسجيل تلقائي)
  useEffect(() => {
    if (!canScan) return;
    try {
      const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
      const urlCode = params.get("code");
      if (urlCode) {
        const cleanHash = window.location.hash.split("?")[0];
        window.history.replaceState(null, "", cleanHash);
        handleLookup(urlCode);
      }
    } catch {
      // ignore
    }
  }, [canScan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== شارة الدور =====
  const roleBadge = useMemo(() => {
    if (scope?.is_admin)
      return { text: "أدمن عام — كل المراحل والفصول", cls: "bg-maroon-100 text-maroon-800" };
    const parts = [];
    const stages = scope?.stages ?? [];
    if ((scope?.roles ?? []).includes("stage_supervisor")) {
      parts.push(
        `مسئول مرحلة: ${stages.map((k) => STAGE_LABEL[k] ?? k).join("، ") || "—"}`
      );
    }
    const classRoles = scope?.class_roles ?? [];
    const namesById = Object.fromEntries(classes.map((c) => [c.id, c]));
    const sup = classRoles.filter((r) => r.role === "class_supervisor");
    const lead = classRoles.filter((r) => r.role === "class_leader");
    const fmt = (list) =>
      list
        .map((r) => {
          const c = namesById[r.class_id];
          return c ? `${c.name} (${STAGE_LABEL[c.stage_key] ?? c.stage_key})` : "فصل";
        })
        .join("، ");
    if (sup.length) parts.push(`مسئول فصل: ${fmt(sup)}`);
    if (lead.length) parts.push(`قائد/قائدة فصل: ${fmt(lead)}`);
    if (scope?.legacy_view) parts.push("صلاحية قديمة — عرض فقط");
    if (parts.length === 0)
      return { text: "مش معيَّن في هيكل الحضور — عرض فقط", cls: "bg-gray-100 text-gray-600" };
    return { text: parts.join(" — "), cls: "bg-blue-100 text-blue-800" };
  }, [scope, classes]);

  // ===== حالات خاصة =====
  if (scopeLoading) {
    return (
      <div className="py-16 text-center text-earth-500">
        <span className="animate-spin text-2xl">⏳</span>
        <p className="mt-2 text-sm">جارِ تحميل الصلاحيات...</p>
      </div>
    );
  }

  const tabs = [
    { id: "record", label: "✅ تسجيل الحضور", show: true },
    { id: "log", label: "📜 سجل الحضور", show: canViewLog },
    { id: "reports", label: "📊 التقارير", show: canViewLog },
    { id: "structure", label: "🏗️ الهيكل والفصول", show: canManageStructure },
    { id: "overview", label: "👥 الفصول والمسئولين", show: Boolean(scope?.is_admin) },
  ];

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  // التسجيل والإلغاء بيتموا على النهارده بس — الأيام القديمة للعرض فقط
  const isToday = selectedDate === todayStr();

  return (
    <div className="space-y-6">
      {/* العنوان + شارة الدور */}
      <div>
        <h2 className="text-2xl font-extrabold text-maroon-900 flex items-center gap-2">
          📋 إدارة الحضور
        </h2>
        <p className="text-sm text-earth-600 mt-1">
          الحضور مقسم على مراحل وفصول — السكان بيعرض البيانات والتسجيل بزرار
          التأكيد
        </p>
        <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${roleBadge.cls}`}>
          {roleBadge.text}
        </span>
      </div>

      {/* التابات */}
      <div className="flex gap-2 flex-wrap">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${tab === t.id
                ? "bg-maroon-700 text-white shadow-sm"
                : "bg-white text-earth-700 border border-earth-200 hover:bg-maroon-50"
                }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {/* ===================== تاب تسجيل الحضور ===================== */}
      {tab === "record" && (
        <div className="space-y-6">
          {!canScan && (
            <div className="rounded-xl bg-gold-50 border border-gold-300 px-4 py-3 text-sm text-gold-900">
              معندكش صلاحية تسجيل الحضور — تقدر تتابع السجل من تاب «سجل الحضور»
              حسب صلاحياتك.
            </div>
          )}

          {/* اختيار الفصل + اليوم */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-earth-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-earth-800 mb-3">🏫 الفصل</h3>
              {visibleClasses.length === 0 ? (
                <p className="text-sm text-earth-500">
                  مفيش فصول متاحة لنطاقك — كلم الأدمن يوزعك على مرحلة/فصل من تاب
                  الهيكل.
                </p>
              ) : (
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={!adminAll && visibleClasses.length === 1}
                  className="w-full border border-earth-300 rounded-lg px-4 py-2.5 text-sm shadow-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500"
                >
                  {visibleClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {STAGE_LABEL[c.stage_key] ?? c.stage_key} — {c.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedClass && (
                <p className="mt-2 text-xs text-earth-500">
                  كشف فصل «{selectedClass.name}» —{" "}
                  {STAGE_LABEL[selectedClass.stage_key]}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-earth-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-earth-800 mb-3">📅 اليوم</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-earth-300 rounded-lg px-4 py-2.5 text-sm shadow-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500"
              />
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedDate === todayStr()
                    ? "bg-maroon-700 text-white"
                    : "bg-earth-100 text-earth-700 hover:bg-earth-200"
                    }`}
                >
                  اليوم
                </button>
                {[-1, -2, -3].map((d) => {
                  const date = new Date();
                  date.setDate(date.getDate() + d);
                  const dateStr = date.toISOString().slice(0, 10);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedDate === dateStr
                        ? "bg-maroon-700 text-white"
                        : "bg-earth-100 text-earth-700 hover:bg-earth-200"
                        }`}
                    >
                      {date.toLocaleDateString("ar-EG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* السكان + التأكيد */}
          {canScan && (
            <div className="bg-white rounded-xl border border-earth-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-earth-800 mb-1">
                📱 سكان الحضور
              </h3>
              <p className="text-xs text-earth-500 mb-3">
                السكان بيعرض بيانات الكشاف — والتسجيل بيتم بزرار التأكيد فقط
                (بدون تسجيل تلقائي)
              </p>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="اسكن QR أو اكتب الكود الكشافي..."
                    className="flex-1 border border-earth-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 outline-none font-mono"
                    autoFocus={autoFocus}
                    disabled={scanBusy}
                  />
                  <button
                    type="submit"
                    disabled={scanBusy || !scanInput.trim()}
                    className="bg-maroon-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
                  >
                    {scanBusy ? "⏳" : "🔍 قراءة"}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-earth-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFocus}
                    onChange={(e) => setAutoFocus(e.target.checked)}
                    className="accent-maroon-600"
                  />
                  تركيز تلقائي بعد كل سكان
                </label>
              </form>

              {/* نتيجة القراءة */}
              {lookup && (
                <div
                  className={`mt-3 rounded-lg border px-4 py-3 text-sm ${lookup.found
                    ? "bg-earth-50 border-earth-200"
                    : "bg-red-50 border-red-200 text-red-700"
                    }`}
                >
                  {!lookup.found ? (
                    <p className="font-bold">
                      ❌ {lookup.message || "الكود غير موجود"}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p>
                          <span className="font-bold text-earth-500">الاسم: </span>
                          <span className="font-extrabold text-earth-900">{lookup.name}</span>
                        </p>
                        <p>
                          <span className="font-bold text-earth-500">الكود: </span>
                          <span className="font-mono">{lookup.scoutCode}</span>
                        </p>
                        {lookup.stage && (
                          <p>
                            <span className="font-bold text-earth-500">المرحلة: </span>
                            {lookup.stage}
                          </p>
                        )}
                        <p>
                          <span className="font-bold text-earth-500">الفصل: </span>
                          {lookup.className || "بدون فصل ⚠️"}
                        </p>
                        <p>
                          <span className="font-bold text-earth-500">حالة النهارده: </span>
                          {lookup.presentToday ? "مسجل حاضر ✅" : "لسه"}
                        </p>
                      </div>

                      {lookup.canRecord && !lookup.presentToday ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLookup(null)}
                            className="flex-1 border border-earth-300 bg-white px-3 py-2 rounded-lg text-xs font-bold text-earth-700 hover:bg-earth-50 transition"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={confirmLookup}
                            disabled={confirmBusy}
                            className="flex-[2] bg-forest-700 text-white px-3 py-2 rounded-lg text-xs font-extrabold hover:bg-forest-800 disabled:opacity-60 transition"
                          >
                            {confirmBusy ? "جارِ التسجيل..." : "✅ تأكيد تسجيل الحضور"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-bold text-gold-800 bg-gold-50 border border-gold-200 rounded-lg px-3 py-2">
                          {lookup.reason || "متاح للتسجيل"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* كشف الفصل */}
          <div className="bg-white rounded-xl border border-earth-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-earth-200 flex items-center justify-between">
              <h3 className="font-bold text-maroon-900">
                كشف فصل {selectedClass ? `«${selectedClass.name}»` : ""} —{" "}
                {new Date(selectedDate).toLocaleDateString("ar-EG", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <span className="text-sm font-bold px-3 py-1 rounded-full bg-green-100 text-green-800">
                {roster.filter((r) => r.present).length} / {roster.length} حاضر
              </span>
            </div>

            {loadingRoster ? (
              <div className="py-12 text-center text-earth-500">
                <span className="animate-spin text-2xl">⏳</span>
                <p className="mt-2 text-sm">جارِ تحميل الكشف...</p>
              </div>
            ) : roster.length === 0 ? (
              <div className="py-12 text-center text-earth-400 text-sm">
                مفيش أعضاء متوزعين على الفصل ده
                {canManageStructure
                  ? " — وزعهم من تاب «الهيكل والفصول»"
                  : " — كلم الأدمن يوزعهم"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-maroon-50 border-b border-maroon-100">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">#</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الكود</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الاسم</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الحالة</th>
                      {canScan && isToday && (
                        <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">
                          إجراء{!isToday ? " (النهارده بس)" : ""}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-earth-100">
                    {roster.map((m, idx) => (
                      <tr key={m.member_id} className="hover:bg-earth-50 transition">
                        <td className="px-4 py-3 text-sm text-earth-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-maroon-700 bg-maroon-50 px-2 py-1 rounded border border-maroon-100">
                            {m.scout_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-earth-900">
                          {m.member_name}
                        </td>
                        <td className="px-4 py-3">
                          {m.present ? (
                            <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              حاضر ✓ {fmtTime(m.scanned_at)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                              غائب
                            </span>
                          )}
                        </td>
                        {canScan && isToday && (
                          <td className="px-4 py-3">
                            {m.present ? (
                              <button
                                type="button"
                                onClick={() => undoMember(m)}
                                disabled={rowBusy === m.member_id}
                                className="text-xs font-bold text-red-600 hover:text-red-800 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                              >
                                {rowBusy === m.member_id ? "..." : "إلغاء الحضور"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => recordMember(m)}
                                disabled={rowBusy === m.member_id}
                                className="text-xs font-bold text-white bg-forest-700 hover:bg-forest-800 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
                              >
                                {rowBusy === m.member_id ? "..." : "✅ تسجيل حضور"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== تاب سجل الحضور ===================== */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-earth-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-earth-800 mb-3">📅 اختر اليوم</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-earth-300 rounded-lg px-4 py-2.5 text-sm shadow-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500"
            />
          </div>

          <div className="bg-white rounded-xl border border-earth-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-earth-200 flex items-center justify-between">
              <h3 className="font-bold text-maroon-900">
                سجل الحضور —{" "}
                {new Date(selectedDate).toLocaleDateString("ar-EG", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <span
                className={`text-sm font-bold px-3 py-1 rounded-full ${log.length > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}
              >
                {log.length} حاضر
              </span>
            </div>

            {loadingLog ? (
              <div className="py-12 text-center text-earth-500">
                <span className="animate-spin text-2xl">⏳</span>
                <p className="mt-2 text-sm">جارِ تحميل السجل...</p>
              </div>
            ) : log.length === 0 ? (
              <div className="py-12 text-center text-earth-400 text-sm">
                لا يوجد سجل حضور لهذا اليوم في نطاقك
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-maroon-50 border-b border-maroon-100">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">#</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الكود</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الاسم</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">الفصل</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">سجّله</th>
                      <th className="px-4 py-3 text-right text-sm font-bold text-maroon-900">وقت التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-earth-100">
                    {log.map((rec, idx) => (
                      <tr key={rec.id} className="hover:bg-earth-50 transition">
                        <td className="px-4 py-3 text-sm text-earth-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-maroon-700 bg-maroon-50 px-2 py-1 rounded border border-maroon-100">
                            {rec.scout_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-earth-900">
                          {rec.member_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-earth-700">
                          {rec.class_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-earth-600">
                          {rec.scanned_by_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-earth-600">
                          {fmtTime(rec.scanned_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== تاب التقارير ===================== */}
      {tab === "reports" && <ReportsTab classes={visibleClasses} />}

      {/* ===================== تاب الهيكل والفصول ===================== */}
      {tab === "structure" && canManageStructure && (
        <StructureTab
          members={members}
          pushToast={pushToast}
          onRefreshStore={refreshData}
          canManageAll={adminAll}
          managedStages={scope?.stages ?? []}
        />
      )}

      {/* ===================== تاب الفصول والمسئولين ===================== */}
      {tab === "overview" && Boolean(scope?.is_admin) && (
        <OverviewTab
          members={members}
          classes={classes}
          pushToast={pushToast}
          onRefreshStore={refreshData}
        />
      )}

      {/* التنبيهات */}
      <div className="fixed bottom-4 left-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-bold shadow-lg ${t.type === "error"
              ? "bg-red-600 text-white"
              : "bg-forest-700 text-white"
              }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
