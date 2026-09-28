import { useState, useMemo, useEffect } from "react";
import QRCode from "qrcode";
import { UsersIcon } from "./icons.jsx";
import { Badge, ConfirmDialog, MemberAccountsSummary } from "./ui.jsx";
import { useStore } from "../store.jsx";
import ImportMembers from "./ImportMembers.jsx";
import { generateTempPassword } from "../utils/generateTempPassword.js";
import { sendCredentialsEmail } from "../utils/sendCredentialsEmail.js";
import { stagePasswordFor } from "../utils/stagePasswords.js";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput.js";
import { useDebounce } from "../hooks/useDebounce.js";

export default function MembersSection({ members = [], onAdd, onUpdate, onDelete, readOnly = false }) {
    const [activeTab, setActiveTab] = useState("list");
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [addError, setAddError] = useState("");
    const { createMemberAccounts, setUserEmail, setUserPassword, profiles } = useStore();
    const [accountsSummary, setAccountsSummary] = useState(null);
    // ✅ رسائل inline بعد التعديل (إنشاء حساب / تحديث إيميل الدخول / إعادة باسورد)
    const [editSaving, setEditSaving] = useState(false);
    const [editNotice, setEditNotice] = useState(null);
    const [editError, setEditError] = useState("");
    const [resetPwdMember, setResetPwdMember] = useState(null);
    const [resetPwdBusy, setResetPwdBusy] = useState(false);

    // ✅ تطبيق باسورد المرحلة على الحسابات اللي لسه ما عيّنتش باسورد خاص
    const [stagePwdBusy, setStagePwdBusy] = useState(false);
    const stagePwdAffected = useMemo(() => {
        return members.filter((m) => {
            if (!m.userId) return false;
            const prof = profiles.find((p) => p.id === m.userId);
            return prof && prof.passwordSet === false && Boolean(stagePasswordFor(m.scoutStage));
        });
    }, [members, profiles]);

    const applyStagePasswords = async () => {
        if (stagePwdBusy || stagePwdAffected.length === 0) return;
        if (!window.confirm(
            `هيتم تعيين باسورد المرحلة لـ ${stagePwdAffected.length} حساب لسه ما عيّنش باسورد خاص.\n` +
            "بعد كده أول دخول بيها هيطلع منه يعيّن باسورده الخاص.\nمتأكد؟"
        )) return;
        setStagePwdBusy(true);
        let ok = 0, fail = 0;
        for (const m of stagePwdAffected) {
            try {
                await setUserPassword(m.userId, stagePasswordFor(m.scoutStage));
                ok++;
            } catch {
                fail++;
            }
        }
        setStagePwdBusy(false);
        setEditNotice({
            type: ok > 0 ? "success" : "error",
            message: ok > 0
                ? `تم تعيين باسورد المرحلة لـ ${ok} حساب${fail ? ` — فشل ${fail}` : ""} ✅ دلوقتي كل واحد يدخل بباسورد مرحلته وهيطلع منه يعيّن باسورده الخاص.`
                : `فشل التعيين — جرب تاني. (${fail})`,
        });
    };

    // ✅ البحث بالكود/الاسم
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);

    // ✅ فلتر المرحلة من كروت الإحصائيات (null = كل المراحل)
    const [stageFilter, setStageFilter] = useState(null);

    // ✅ Pagination
    const PAGE_SIZE = 50;
    const [memberPage, setMemberPage] = useState(1);

    // ✅ QR Code
    const [qrMember, setQrMember] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState("");

    useEffect(() => {
        if (qrMember && qrMember.scoutCode) {
            const baseUrl = window.location.origin + window.location.pathname;
            const scanUrl = `${baseUrl}#/scan?code=${encodeURIComponent(qrMember.scoutCode)}`;
            QRCode.toDataURL(scanUrl, {
                width: 280,
                margin: 2,
                color: { dark: "#4c1d15", light: "#ffffff" },
            }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
        } else {
            setQrDataUrl("");
        }
    }, [qrMember]);

    const filteredMembers = useMemo(() => {
        const q = (debouncedSearch || "").trim().toLowerCase();
        return members.filter((m) => {
            if (stageFilter && (m.scoutStage || "").trim() !== stageFilter) return false;
            if (!q) return true;
            const codeMatch = (m.scoutCode || "").toLowerCase().includes(q);
            const nameMatch = (m.name || "").toLowerCase().includes(q);
            return codeMatch || nameMatch;
        });
    }, [members, debouncedSearch, stageFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    const paginatedMembers = filteredMembers.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE);

    // Reset page when search or stage filter changes
    useEffect(() => { setMemberPage(1); }, [debouncedSearch, stageFilter]);

    const normEmail = (v) => (v || "").trim().toLowerCase();

    // ✅ تحويل الفارغ لـ null في الحقول اللي مش نصية (تاريخ، رقم، uuid)
    // عشان PostgreSQL رافض empty string في أعمدة date/numeric/uuid
    const nullifyEmpty = (obj) => {
        const out = { ...obj };
        // حقول التاريخ
        if (out.birthDate === "") out.birthDate = null;
        // حقول الأرقام
        if (out.scoutNumber === "") out.scoutNumber = null;
        if (out.siblingsCount === "") out.siblingsCount = null;
        return out;
    };

    // ✅ تنبيه إيميل مكرر أثناء الكتابة (تحذير بس — مش بيمنع الحفظ، الـ RPC هو الحَكم النهائي)
    const emailTakenByOther = (email, excludeId) =>
        normEmail(email) &&
        members.some((m) => m.id !== excludeId && normEmail(m.email) === normEmail(email));

    const [newMember, setNewMember] = useState({
        name: "",
        fatherName: "",
        motherName: "",
        confessor: "",
        college: "",
        fatherPhone: "",
        motherPhone: "",
        phone: "",
        birthDate: "",
        scoutStage: "كشاف",
        educationStage: "",
        email: "",
        address: "",
        governorate: "",
    });

    // ✅ إحصائيات ديناميكية: بتحسب كل مرحلة موجودة فعلياً
    const { total, stageCounts: stageEntries } = useMemo(() => {
        const counts = {};
        members.forEach(member => {
            const stage = member.scoutStage?.trim();
            if (stage) {
                counts[stage] = (counts[stage] || 0) + 1;
            }
        });
        // ترتيب أبجدي عربي
        const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'ar'));
        return { total: members.length, stageCounts: sorted };
    }, [members]);

    const STAGE_COLORS = [
        'from-orange-600 to-orange-800',
        'from-gold-600 to-gold-800',
        'from-green-600 to-green-800',
        'from-blue-600 to-blue-800',
        'from-purple-600 to-purple-800',
        'from-red-600 to-red-800',
        'from-teal-600 to-teal-800',
        'from-indigo-600 to-indigo-800',
        'from-pink-600 to-pink-800',
        'from-cyan-600 to-cyan-800',
        'from-amber-600 to-amber-800',
        'from-lime-600 to-lime-800',
    ];

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setAddError("");

        // ✅ التحقق من عدم تكرار الاسم
        const existingMember = members.find(m =>
            m.name.trim().toLowerCase() === newMember.name.trim().toLowerCase()
        );

        if (existingMember) {
            setAddError(`⚠️ الكشاف "${newMember.name}" موجود بالفعل!`);
            return;
        }

        try {
            const created = await onAdd(sanitizeObject(nullifyEmpty(newMember)));
            setNewMember({
                name: "", fatherName: "", motherName: "",
                fatherPhone: "", motherPhone: "", phone: "",
                birthDate: "", scoutStage: "كشاف", educationStage: "",
                email: "", address: "", governorate: "",
            });
            setShowAddForm(false);

            // ✅ إنشاء حساب دخول تلقائي للعضو الجديد لو فيه إيميل (كود الكشاف = كلمة المرور)
            if (created?.id && (created.email || '').trim() && (created.scoutCode || '').trim()) {
                try {
                    const tempPassword = generateTempPassword();
                    const summary = await createMemberAccounts([{
                        member_id: created.id,
                        email: created.email,
                        password: tempPassword,
                        full_name: created.name,
                    }]);
                    setAccountsSummary({ ...summary, tempPassword });
                } catch (accErr) {
                    setAccountsSummary({ error: accErr?.message || String(accErr) });
                }
            }
        } catch (err) {
            setAddError('فشل إضافة العضو: ' + (err?.message || err));
        }
    };

    // ✅ حفظ التعديل + مزامنة حساب الدخول:
    //  - عضو من غير حساب وبدأ ليه إيميل → إنشاء حساب فوراً (الباسورد = الكود الكشافي)
    //  - عضو عنده حساب واتغير إيميله → تحديث إيميل حساب الدخول في auth
    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (editSaving) return;

        const before = members.find((m) => m.id === editingMember.id) || editingMember;
        const emailChanged = normEmail(before.email) !== normEmail(editingMember.email);

        setEditSaving(true);
        setEditNotice(null);
        setEditError("");
        try {
            const updated = await onUpdate(editingMember.id, sanitizeObject(nullifyEmpty(editingMember)));
            setEditingMember(null);

            if (!updated?.id) return;

            // 1) العضو مالوش حساب (user_id فاضي) وليه إيميل دلوقتي → اعمل حسابه فوراً
            if (!updated.userId && normEmail(updated.email)) {
                if (!(updated.scoutCode || '').trim()) {
                    setEditNotice({
                        type: "error",
                        message: "العضو اتعدل بس حساب الدخول ما اتعملش: مفيش كود كشافي لسه",
                    });
                    return;
                }
                try {
                    const tempPassword = generateTempPassword();
                    await createMemberAccounts([{
                        member_id: updated.id,
                        email: updated.email,
                        password: tempPassword,
                        full_name: updated.name,
                    }]);
                    setEditNotice({
                        type: "success",
                        message: "اتعمل حساب الدخول — الباسورد المؤقت: " + tempPassword,
                    });
                } catch (accErr) {
                    setEditNotice({
                        type: "error",
                        message: "العضو اتعدل بس حساب الدخول ما اتعملش: " + (accErr?.message || String(accErr)),
                    });
                }
                return;
            }

            // 2) العضو عنده حساب (user_id موجود) والإيميل اتغير → حدّث إيميل حساب الدخول
            if (updated.userId && emailChanged && normEmail(updated.email)) {
                try {
                    await setUserEmail(updated.userId, updated.email);
                    setEditNotice({
                        type: "success",
                        message: "اتعمل تحديث لإيميل حساب الدخول — الدخول هيبقى بالإيميل الجديد",
                    });
                } catch (emailErr) {
                    setEditNotice({
                        type: "error",
                        message: "العضو اتعدل بس إيميل الدخول ما اتغيرش: " + (emailErr?.message || String(emailErr)),
                    });
                }
            }
        } catch (err) {
            // فشل حفظ التعديل نفسه — الفورم لسه مفتوح فاعرض الخطأ جواه
            setEditError("فشل تعديل العضو: " + (err?.message || err));
        } finally {
            setEditSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!resetPwdMember || resetPwdBusy) return;
        setResetPwdBusy(true);
        try {
            const newTempPassword = generateTempPassword();
            await setUserPassword(resetPwdMember.userId, newTempPassword);

            // ✅ الباسورد الجديد بيتبعت على إيميل العضو تلقائياً
            // (من جيميل المجموعة) — والرسالة هنا بتوضح حالة الإرسال
            let emailNote = "";
            if ((resetPwdMember.email || "").trim()) {
                const emailRes = await sendCredentialsEmail([
                    {
                        email: resetPwdMember.email,
                        password: newTempPassword,
                        name: resetPwdMember.name,
                    },
                ]);
                emailNote = emailRes?.error
                    ? ` ⚠️ الإرسال على الإيميل فشل (${emailRes.error}) — بلّغه بالباسورد يدوي.`
                    : " 📧 واتبعت على إيميله.";
            } else {
                emailNote = " ⚠️ العضو مالوش إيميل مسجل — بلّغه بالباسورد يدوي.";
            }

            setEditNotice({
                type: "success",
                message: `تم إعادة تعيين باسورد "${resetPwdMember.name}" — الباسورد الجديد: ${newTempPassword}.${emailNote}`,
            });
        } catch (err) {
            setEditNotice({ type: "error", message: "فشل إعادة تعيين الباسورد: " + (err?.message || err) });
        } finally {
            setResetPwdBusy(false);
            setResetPwdMember(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-maroon-100 pb-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-maroon-900 flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-maroon-700" />
                        إدارة الكشافين
                    </h2>
                    <p className="text-sm text-earth-600 mt-1">إضافة، تعديل، أو استيراد بيانات الكشافين</p>
                </div>

                <div className="flex bg-earth-100 p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab("list"); setShowAddForm(false); setEditingMember(null); }}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === "list" ? "bg-white text-maroon-800 shadow-sm" : "text-earth-600 hover:text-maroon-700"
                            }`}
                    >
                        👥 قائمة الأعضاء
                    </button>
                    {!readOnly && (
                        <button
                            onClick={() => { setActiveTab("import"); setShowAddForm(false); setEditingMember(null); }}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2 ${activeTab === "import" ? "bg-white text-maroon-800 shadow-sm" : "text-earth-600 hover:text-maroon-700"
                                }`}
                        >
                            📤 استيراد Excel
                        </button>
                    )}
                </div>
            </div>

            {/* ✅ بطاقات الإحصائيات */}
            {activeTab === "list" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <button
                        type="button"
                        onClick={() => setStageFilter(null)}
                        title="عرض كل الأعضاء"
                        className={`bg-gradient-to-br from-maroon-700 to-maroon-900 text-white rounded-xl p-4 shadow-lg text-right transition cursor-pointer ${stageFilter === null ? "ring-4 ring-gold-500" : "ring-2 ring-maroon-500/30 hover:opacity-90"}`}
                    >
                        <div className="text-3xl font-extrabold">{total}</div>
                        <div className="text-sm opacity-90 mt-1">إجمالي الأعضاء</div>
                    </button>
                    {stageEntries.map(([stage, count], idx) => (
                        <button
                            key={stage}
                            type="button"
                            onClick={() => setStageFilter(stageFilter === stage ? null : stage)}
                            title={stageFilter === stage ? "إلغاء فلتر المرحلة" : `عرض أعضاء مرحلة ${stage}`}
                            className={`bg-gradient-to-br ${STAGE_COLORS[idx % STAGE_COLORS.length]} text-white rounded-xl p-4 shadow-lg text-right transition cursor-pointer ${stageFilter === stage ? "ring-4 ring-gold-500" : "hover:opacity-90"}`}
                        >
                            <div className="text-3xl font-extrabold">{count}</div>
                            <div className="text-sm opacity-90 mt-1">{stage}</div>
                        </button>
                    ))}
                </div>
            )}

            {activeTab === "import" ? (
                <div className="bg-white p-6 rounded-xl border border-earth-200">
                    <ImportMembers />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                        <h3 className="text-lg font-bold text-earth-900">
                            {stageFilter
                                ? <>أعضاء مرحلة {stageFilter} ({filteredMembers.length}){" "}
                                    <button
                                        type="button"
                                        onClick={() => setStageFilter(null)}
                                        className="align-middle cursor-pointer rounded-full bg-earth-100 px-2 py-0.5 text-xs font-bold text-earth-600 hover:bg-earth-200"
                                        title="إلغاء الفلتر وعرض الكل"
                                    >
                                        عرض الكل ✕
                                    </button>
                                </>
                                : <>الأعضاء المسجلين ({members.length})</>}
                        </h3>
                        {!readOnly && (
                            <div className="flex flex-wrap items-center gap-2">
                                {!readOnly && stagePwdAffected.length > 0 && (
                                    <button
                                        onClick={applyStagePasswords}
                                        disabled={stagePwdBusy}
                                        title="تطبيق باسورد المرحلة على الحسابات اللي لسه ما عيّنتش باسورد خاص"
                                        className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        🔑 {stagePwdBusy ? "جارِ التعيين..." : `تطبيق باسورد المراحل (${stagePwdAffected.length})`}
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
                                    className="flex items-center gap-2 bg-maroon-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-maroon-800 transition"
                                >
                                    ➕ {showAddForm ? "إلغاء" : "إضافة عضو يدوياً"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ✅ حقل البحث بالكود/الاسم */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="🔍 ابحث بالكود أو الاسم..."
                            className="w-full border border-earth-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:border-maroon-500 focus:ring-2 focus:ring-maroon-500 outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-earth-400 hover:text-earth-600 text-sm"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {accountsSummary && (
                        <MemberAccountsSummary summary={accountsSummary} />
                    )}

                    {editNotice && (
                        <div
                            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                                editNotice.type === "success"
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : "bg-red-50 border-red-200 text-red-700"
                            }`}
                        >
                            <span>{editNotice.message}</span>
                            <button
                                type="button"
                                onClick={() => setEditNotice(null)}
                                className="shrink-0 leading-none opacity-60 hover:opacity-100"
                                title="إخفاء"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {showAddForm && (
                        <form onSubmit={handleAddSubmit} className="bg-white border border-maroon-100 rounded-xl p-5 shadow-sm space-y-4">
                            {addError && (
                                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{addError}</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input required placeholder="الاسم الرباعي" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} />
                                <input required placeholder="اسم الأب" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.fatherName} onChange={e => setNewMember({ ...newMember, fatherName: e.target.value })} />
                                <input placeholder="اسم الأم" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.motherName} onChange={e => setNewMember({ ...newMember, motherName: e.target.value })} />
                                <input required type="date" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.birthDate} onChange={e => setNewMember({ ...newMember, birthDate: e.target.value })} />
                                <select className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.scoutStage} onChange={e => setNewMember({ ...newMember, scoutStage: e.target.value })}>
                                    <option value="أشبال">أشبال</option>
                                    <option value="زهرات">زهرات</option>
                                    <option value="كشاف">كشاف</option>
                                    <option value="مرشدات">مرشدات</option>
                                    <option value="متقدم">متقدم</option>
                                    <option value="رائدات">رائدات</option>
                                    <option value="جوالة">جوالة</option>
                                    <option value="جوالات">جوالات</option>
                                    <option value="قائد">قائد</option>
                                    <option value="قائدة">قائدة</option>
                                    <option value="رائد">رائد</option>
                                    <option value="رائدة">رائدة</option>
                                </select>
                                <select className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.educationStage} onChange={e => setNewMember({ ...newMember, educationStage: e.target.value })}>
                                    <option value="">المرحلة الدراسية</option>
                                    <option value="ابتدائي">ابتدائي</option>
                                    <option value="إعدادي">إعدادي</option>
                                    <option value="ثانوي">ثانوي</option>
                                    <option value="جامعة">جامعة</option>
                                    <option value="متخرج">متخرج</option>
                                </select>
                                <div>
                                    <input required type="email" placeholder="البريد الإلكتروني" className="border border-earth-300 rounded-lg px-3 py-2 w-full" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} />
                                    {emailTakenByOther(newMember.email, null) && (
                                        <p className="text-xs text-yellow-700 mt-1">تنبيه: الإيميل ده مستخدم لعضو تاني في القايمة</p>
                                    )}
                                </div>
                                <input placeholder="هاتف الكشاف" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.phone} onChange={e => setNewMember({ ...newMember, phone: e.target.value })} />
                                <input placeholder="هاتف الأب" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.fatherPhone} onChange={e => setNewMember({ ...newMember, fatherPhone: e.target.value })} />
                                <input placeholder="هاتف الأم" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.motherPhone} onChange={e => setNewMember({ ...newMember, motherPhone: e.target.value })} />
                                <input placeholder="المحافظة" className="border border-earth-300 rounded-lg px-3 py-2" value={newMember.governorate} onChange={e => setNewMember({ ...newMember, governorate: e.target.value })} />
                                <input placeholder="العنوان بالتفصيل" className="border border-earth-300 rounded-lg px-3 py-2 md:col-span-2" value={newMember.address} onChange={e => setNewMember({ ...newMember, address: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => { setShowAddForm(false); setAddError(""); }} className="px-4 py-2 text-sm text-earth-600 hover:bg-earth-100 rounded-lg">إلغاء</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-maroon-700 text-white rounded-lg hover:bg-maroon-800 font-bold">حفظ وإضافة</button>
                            </div>
                        </form>
                    )}

                    <div className="bg-white border border-earth-200 rounded-xl overflow-hidden shadow-sm">
                        {/* ✅ جدول قابل للتمرير الأفقي */}
                        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                            <table className="w-full min-w-[1400px]">
                                <thead className="bg-maroon-50 border-b border-maroon-100">
                                    <tr>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm sticky right-0 bg-maroon-50 z-10 w-[10%]">الكود</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[12%]">الاسم</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[10%]">أب الاعتراف</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[10%]">اسم الأم</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[13%]">الأرقام</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[8%]">الكشفية</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[8%]">الدراسية</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[10%]">الكلية</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[5%]">الإخوة</th>
                                        <th className="px-3 py-3 text-right font-bold text-maroon-900 text-sm w-[10%]">الإيميل</th>
                                        <th className="px-3 py-3 text-center font-bold text-maroon-900 text-sm w-[4%] sticky left-0 bg-maroon-50 z-10">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-earth-100">
                                    {paginatedMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan="11" className="px-4 py-8 text-center text-earth-500 text-base">
                                                {searchQuery || stageFilter
                                                    ? "لا توجد نتائج مطابقة."
                                                    : "لا يوجد أعضاء مسجلين حتى الآن."}
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedMembers.map((member) => (
                                            <tr key={member.id} className="hover:bg-earth-50 transition">

                                                {/* 1. الكود + حالة الحساب */}
                                                <td className="px-3 py-3 align-top sticky right-0 bg-white z-10">
                                                    <span className="font-mono font-bold text-maroon-700 bg-maroon-50 px-2 py-1 rounded text-xs border border-maroon-100 block text-center whitespace-nowrap">
                                                        {member.scoutCode || "جاري..."}
                                                    </span>
                                                    {member.userId ? (
                                                        <span title="الكشاف يدخل بإيميله وكوده الكشافي" className="mt-1 flex justify-center">
                                                            <Badge tone="green">له حساب</Badge>
                                                        </span>
                                                    ) : (
                                                        <span
                                                            title={(member.email || '').trim()
                                                                ? "مفيش حساب — عدّل بيانات العضو وضيف إيميل ليعمل حسابه تلقائياً"
                                                                : "مفيش حساب ولا إيميل — مش هيقدر يسجل دخول"}
                                                            className="mt-1 flex justify-center"
                                                        >
                                                            <Badge tone="gray">مفيش حساب</Badge>
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 2. الاسم */}
                                                <td className="px-3 py-3 align-top">
                                                    <span className="font-bold text-earth-900 text-sm leading-tight block">
                                                        {member.name}
                                                    </span>
                                                </td>

                                                {/* 3. أب الاعتراف */}
                                                <td className="px-3 py-3 align-top text-sm text-earth-700">
                                                    {member.fatherName || '-'}
                                                </td>

                                                {/* 4. اسم الأم */}
                                                <td className="px-3 py-3 align-top text-sm text-earth-700">
                                                    {member.motherName || '-'}
                                                </td>

                                                {/* 5. الأرقام */}
                                                <td className="px-3 py-3 align-top">
                                                    <div className="space-y-1 text-sm dir-ltr text-right">
                                                        {member.phone && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-earth-500">📱</span>
                                                                <span className="text-earth-700 font-medium">{member.phone}</span>
                                                            </div>
                                                        )}
                                                        {member.fatherPhone && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-earth-500">👨</span>
                                                                <span className="text-earth-600">{member.fatherPhone}</span>
                                                            </div>
                                                        )}
                                                        {member.motherPhone && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-earth-500">👩</span>
                                                                <span className="text-earth-600">{member.motherPhone}</span>
                                                            </div>
                                                        )}
                                                        {!member.phone && !member.fatherPhone && !member.motherPhone && (
                                                            <span className="text-earth-400 text-sm">-</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 6. الكشفية */}
                                                <td className="px-3 py-3 align-top">
                                                    <span className="bg-gold-100 text-gold-800 px-2 py-1 rounded text-sm font-bold whitespace-nowrap inline-block">
                                                        {member.scoutStage || '-'}
                                                    </span>
                                                </td>

                                                {/* 7. الدراسية */}
                                                <td className="px-3 py-3 align-top text-sm text-earth-700 whitespace-nowrap font-medium">
                                                    {member.educationStage || '-'}
                                                </td>

                                                {/* 8. الكلية */}
                                                <td className="px-3 py-3 align-top text-sm text-earth-700">
                                                    {member.college || '-'}
                                                </td>

                                                {/* 9. الإخوة */}
                                                <td className="px-3 py-3 align-top text-center">
                                                    <span className={`inline-block px-2 py-1 rounded text-sm font-bold ${member.siblingsCount > 0
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {member.siblingsCount || 0}
                                                    </span>
                                                </td>

                                                {/* 10. الإيميل */}
                                                <td className="px-3 py-3 align-top text-sm text-earth-600 break-all font-medium">
                                                    {member.email || '-'}
                                                </td>

                                                {/* 11. الإجراءات - أيقونات فوق بعض */}
                                                <td className="px-2 py-3 align-top text-center sticky left-0 bg-white z-10">
                                                    {readOnly ? (
                                                        <span className="text-earth-400 text-sm">—</span>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <button
                                                                onClick={() => { setEditNotice(null); setEditError(""); setEditingMember(member); }}
                                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition"
                                                                title="تعديل"
                                                            >
                                                                ✏️
                                                            </button>
                                                            {member.userId && (member.scoutCode || '').trim() && (
                                                                <button
                                                                    onClick={() => setResetPwdMember(member)}
                                                                    className="text-gold-700 hover:text-gold-800 hover:bg-gold-50 p-1 rounded transition"
                                                                    title="إعادة تعيين الباسورد للكود الكشافي"
                                                                >
                                                                    🔑
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setQrMember(member)}
                                                                className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 p-1 rounded transition"
                                                                title="QR Code"
                                                            >
                                                                📱
                                                            </button>
                                                            <button
                                                                onClick={() => { if (window.confirm(`هل أنت متأكد من حذف الكشاف "${member.name}"؟\nلو ليه حساب دخول هيتمسح كمان — والعملية ما بتترجعش.`)) { onDelete(member.id); } }}
                                                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition"
                                                                title="حذف العضو وحساب الدخول المرتبط بيه"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {filteredMembers.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-3 bg-earth-50 rounded-lg">
                            <span className="text-sm text-earth-600">
                                صفحة {memberPage} من {totalPages} — {filteredMembers.length} عضو
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                                    disabled={memberPage <= 1}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-earth-300 hover:bg-earth-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    ← السابق
                                </button>
                                <button
                                    onClick={() => setMemberPage(p => Math.min(totalPages, p + 1))}
                                    disabled={memberPage >= totalPages}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-earth-300 hover:bg-earth-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    التالي →
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {editingMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-earth-200 px-6 py-4 flex items-center justify-between">
                            <h4 className="font-bold text-maroon-900 text-lg">تعديل بيانات: {editingMember.name}</h4>
                            <button
                                onClick={() => setEditingMember(null)}
                                className="text-earth-500 hover:text-earth-700 text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4">
                            {editError && (
                                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{editError}</div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">الاسم الرباعي</label>
                                    <input required className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.name} onChange={e => setEditingMember({ ...editingMember, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">اسم الأب</label>
                                    <input required className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.fatherName} onChange={e => setEditingMember({ ...editingMember, fatherName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">اسم الأم</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.motherName} onChange={e => setEditingMember({ ...editingMember, motherName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">تاريخ الميلاد</label>
                                    <input required type="date" className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.birthDate} onChange={e => setEditingMember({ ...editingMember, birthDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">المرحلة الكشفية</label>
                                    <select className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.scoutStage} onChange={e => setEditingMember({ ...editingMember, scoutStage: e.target.value })}>
                                        <option value="أشبال">أشبال</option>
                                        <option value="زهرات">زهرات</option>
                                        <option value="كشاف">كشاف</option>
                                        <option value="مرشدات">مرشدات</option>
                                        <option value="متقدم">متقدم</option>
                                        <option value="رائدات">رائدات</option>
                                        <option value="جوالة">جوالة</option>
                                        <option value="جوالات">جوالات</option>
                                        <option value="قائد">قائد</option>
                                        <option value="قائدة">قائدة</option>
                                        <option value="رائد">رائد</option>
                                        <option value="رائدة">رائدة</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">المرحلة الدراسية</label>
                                    <select className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.educationStage} onChange={e => setEditingMember({ ...editingMember, educationStage: e.target.value })}>
                                        <option value="">اختر المرحلة</option>
                                        <option value="ابتدائي">ابتدائي</option>
                                        <option value="إعدادي">إعدادي</option>
                                        <option value="ثانوي">ثانوي</option>
                                        <option value="جامعة">جامعة</option>
                                        <option value="متخرج">متخرج</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">البريد الإلكتروني</label>
                                    <input required type="email" className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.email} onChange={e => setEditingMember({ ...editingMember, email: e.target.value })} />
                                    {emailTakenByOther(editingMember.email, editingMember.id) && (
                                        <p className="text-xs text-yellow-700 mt-1">تنبيه: الإيميل ده مستخدم لعضو تاني في القايمة</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">هاتف الكشاف</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.phone} onChange={e => setEditingMember({ ...editingMember, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">هاتف الأب</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.fatherPhone} onChange={e => setEditingMember({ ...editingMember, fatherPhone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">هاتف الأم</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.motherPhone} onChange={e => setEditingMember({ ...editingMember, motherPhone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">المحافظة</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.governorate} onChange={e => setEditingMember({ ...editingMember, governorate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-earth-600 font-bold">العنوان</label>
                                    <input className="w-full border border-earth-300 rounded-lg px-3 py-2 mt-1" value={editingMember.address} onChange={e => setEditingMember({ ...editingMember, address: e.target.value })} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-earth-200">
                                <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 text-sm text-earth-600 hover:bg-earth-100 rounded-lg">إلغاء</button>
                                <button type="submit" disabled={editSaving} className="px-4 py-2 text-sm bg-maroon-700 text-white rounded-lg hover:bg-maroon-800 font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                                    {editSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {resetPwdMember && (
                <ConfirmDialog
                    open={Boolean(resetPwdMember)}
                    title="إعادة تعيين الباسورد"
                    message={`هل تريد إعادة تعيين باسورد "${resetPwdMember.name}"؟ هيتم توليد باسورد عشوائي جديد وهيتعرضلك مرة واحدة.`}
                    confirmLabel="إعادة التعيين"
                    onCancel={() => setResetPwdMember(null)}
                    onConfirm={handleResetPassword}
                />
            )}

            {/* ✅ QR Code Modal */}
            {qrMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-maroon-900 text-lg">QR Code</h4>
                            <button
                                onClick={() => { setQrMember(null); setQrDataUrl(""); }}
                                className="text-earth-500 hover:text-earth-700 text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-sm text-earth-700 mb-1">{qrMember.name}</p>
                        <p className="font-mono text-xl font-extrabold text-maroon-800 mb-4">{qrMember.scoutCode || "—"}</p>
                        {qrDataUrl ? (
                            <div className="flex justify-center mb-4">
                                <img src={qrDataUrl} alt={`QR: ${qrMember.scoutCode}`} className="rounded-lg border border-earth-200" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 mb-4">
                                <span className="animate-spin text-3xl">⏳</span>
                            </div>
                        )}
                        <p className="text-xs text-earth-500">الكود الكشافي مُشفّر في الـ QR</p>
                    </div>
                </div>
            )}

        </div>
    );
}