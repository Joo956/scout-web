import { useState, useMemo } from "react";
import { useStore } from "../store.jsx";
import { LEADER_STAGE_KEYS, stagePairKey } from "../utils/stages.js";
import { sendCredentialsEmail } from "../utils/sendCredentialsEmail.js";

const PERM_SECTIONS = [
  { key: "members", label: "الكشافين" },
  { key: "attendance", label: "الحضور" },
  { key: "exams", label: "الاختبارات" },
  { key: "store", label: "المتجر" },
  { key: "library", label: "المكتبة" },
  { key: "orders", label: "الطلبات" },
  { key: "news", label: "الأخبار" },
  { key: "badges", label: "الشارات" },
  { key: "users", label: "الحسابات" },
];

const ROLES = [
  { value: "member", label: "عضو (Member)" },
  { value: "subadmin", label: "مدير فرعي (Subadmin)" },
  { value: "admin", label: "مدير عام (Admin)" },
];

const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label ?? role;

const toPermissionObject = (arr = []) => {
  const obj = {};
  (arr ?? []).forEach((p) => {
    if (p) obj[p] = true;
  });
  return obj;
};

const fromPermissionObject = (obj = {}) =>
  Object.keys(obj).filter((k) => obj[k]);

export default function UserManagement({ readOnly = false }) {
  const { profiles, members, currentUser, createStaffAccount, updateUser, deleteUser, setUserPassword } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "subadmin",
  });
  const [permObject, setPermObject] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ شرط واحد بس: مرحلة قائد / جوال / رائد — كلهم يظهروا
  const staffCandidates = useMemo(
    () => members.filter((m) => LEADER_STAGE_KEYS.includes(stagePairKey(m.scoutStage))),
    [members]
  );
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return staffCandidates;
    return staffCandidates.filter((m) =>
      `${m.name} ${m.email || ""} ${m.scoutCode || ""}`.toLowerCase().includes(q)
    );
  }, [staffCandidates, memberSearch]);
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  // ✅ هل العضو المختار ليه حساب بالفعل؟ (يبقى ترقية مش إنشاء)
  const selectedProfile = useMemo(
    () =>
      selectedMember
        ? profiles.find(
          (p) =>
            (p.email || "").toLowerCase() ===
            (selectedMember.email || "").toLowerCase()
        ) ?? null
        : null,
    [profiles, selectedMember]
  );

  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState(null);

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", role: "subadmin" });
    setSelectedMemberId("");
    setMemberSearch("");
    setPermObject({});
    setFormError("");
    setShowForm(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      const permissions =
        formData.role === "subadmin"
          ? fromPermissionObject(permObject)
          : formData.role === "admin"
            ? ["*"]
            : [];

      if (editingUser) {
        await updateUser(editingUser.id, {
          name: formData.name,
          role: formData.role,
          permissions,
        });
      } else {
        if (!selectedMemberId) {
          throw new Error("اختار العضو الأول.");
        }
        if (selectedProfile) {
          // ✅ ليه حساب بالفعل → ترقية الدور والصلاحيات بس
          await updateUser(selectedProfile.id, {
            name: selectedMember.name,
            role: formData.role,
            permissions,
          });
        } else {
          // ✅ ملوش حساب → إنشاء حساب جديد
          if (!(selectedMember.email || "").trim()) {
            throw new Error("العضو ده مفيهوش إيميل — ضيف إيميل من إدارة الكشافين الأول.");
          }
          if (!formData.password || formData.password.length < 6) {
            throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
          }
          await createStaffAccount(
            selectedMemberId,
            formData.password,
            formData.role,
            permissions
          );
        }
      }
      resetForm();
    } catch (err) {
      setFormError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "member",
    });
    setPermObject(toPermissionObject(user.permissions));
    setFormError("");
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm("هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع.")) {
      try {
        await deleteUser(userId);
      } catch (err) {
        alert(err.message || "تعذر حذف المستخدم");
      }
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    setPasswordError("");
    try {
      await setUserPassword(passwordUser.id, newPassword);

      // ✅ إشعار صاحب الحساب على إيميله بالباسورد الجديد
      let emailNote = "";
      if ((passwordUser.email || "").trim()) {
        const emailRes = await sendCredentialsEmail([
          {
            email: passwordUser.email,
            password: newPassword,
            name: passwordUser.name,
          },
        ]);
        emailNote = emailRes?.error
          ? " ⚠️ الإرسال على الإيميل فشل — بلّغه يدوي."
          : " 📧 واتبعت إشعار على إيميله.";
      }

      setPasswordUser(null);
      setNewPassword("");
      setPasswordNotice({
        type: "success",
        message: `تم تغيير كلمة المرور ✓${emailNote}`,
      });
      setTimeout(() => setPasswordNotice(null), 6000);
    } catch (err) {
      setPasswordError(err.message || "تعذر تغيير كلمة المرور");
    }
  };

  // ✅ فلترة: يعرض بس حسابات المسئولين (admin + subadmin)، مش الأعضاء
  const staffProfiles = useMemo(
    () => profiles.filter((p) => p.role === "admin" || p.role === "subadmin"),
    [profiles]
  );

  const canManage = !readOnly;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-maroon-800">👥 إدارة الحسابات والمستخدمين</h2>
        {passwordNotice && (
          <div className={`w-full sm:w-auto rounded-lg border px-4 py-2.5 text-sm font-bold ${passwordNotice.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {passwordNotice.message}
          </div>
        )}
        {canManage && (
          <button
            onClick={() => { setEditingUser(null); setFormData({ name: "", email: "", password: "", role: "subadmin" }); setPermObject({}); setFormError(""); setShowForm(true); }}
            className="bg-maroon-700 text-white px-4 py-2 rounded-lg hover:bg-maroon-800 font-bold"
          >
            إنشاء حساب جديد
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingUser ? "تعديل مستخدم" : "إنشاء حساب جديد"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingUser ? (
                <>
                  {/* ✅ اختيار عضو موجود — الحساب بيتعمل منه (مفيش بيانات جديدة) */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      اختار العضو <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="search"
                      placeholder="ابحث بالاسم أو الإيميل أو الكود..."
                      className="w-full border rounded-lg px-3 py-2 mb-2"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    <select
                      required
                      className="w-full border rounded-lg px-3 py-2"
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      size={Math.min(6, Math.max(3, filteredMembers.length))}
                    >

                      <option value="" disabled>
                        {filteredMembers.length === 0
                          ? "مفيش قادة/جوالين في قائمة الأعضاء"
                          : "— اختار العضو —"}
                      </option>
                      {filteredMembers.map((m) => {
                        const hasAcc = profiles.some(
                          (p) =>
                            (p.email || "").toLowerCase() ===
                            (m.email || "").toLowerCase()
                        );
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.email || "مفيش إيميل"}
                            {m.scoutStage ? ` (${m.scoutStage})` : ""}
                            {hasAcc ? " — ليه حساب (ترقية)" : " — حساب جديد"}
                          </option>
                        );
                      })}

                    </select>

                    {selectedMember && (
                      <p className="mt-2 rounded-lg bg-earth-50 border border-earth-200 px-3 py-2 text-xs font-semibold text-earth-700">
                        {selectedProfile ? (
                          <>
                            ⚠️ العضو ليه حساب بالفعل بإيميل{" "}
                            <span className="font-mono" dir="ltr">{selectedMember.email}</span>{" "}
                            — هيتم <strong>ترقية حسابه</strong> للدور الجديد فقط.
                          </>
                        ) : (
                          <>
                            الحساب هيتعمل بإيميل العضو:{" "}
                            <span className="font-mono" dir="ltr">
                              {selectedMember.email || "— مفيش إيميل"}
                            </span>
                          </>
                        )}
                      </p>
                    )}

                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">الصلاحية</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="subadmin">مدير فرعي (Subadmin)</option>
                      <option value="admin">مدير عام (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      كلمة المرور {!selectedProfile && <span className="text-red-600">*</span>}
                    </label>
                    <input
                      type="password"
                      required={!selectedProfile}
                      minLength={6}
                      disabled={Boolean(selectedProfile)}
                      className="w-full border rounded-lg px-3 py-2 disabled:bg-earth-100 disabled:text-earth-500"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={
                        selectedProfile
                          ? "مش مطلوبة — العضو ليه حساب بالفعل"
                          : "6 أحرف على الأقل"
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">الاسم</label>
                    <input
                      required
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      disabled
                      className="w-full border rounded-lg px-3 py-2 disabled:bg-earth-100 disabled:text-earth-500"
                      value={formData.email}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">الصلاحية</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.role === "subadmin" && (
                <div className="rounded-xl border border-earth-200 bg-earth-50 p-4">
                  <p className="text-sm font-bold text-earth-800 mb-3">صلاحيات المدير الفرعي</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PERM_SECTIONS.map((section) => (
                      <div key={section.key} className="rounded-lg border border-earth-200 bg-white p-2.5">
                        <p className="mb-1.5 text-xs font-bold text-earth-700">{section.label}</p>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-earth-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(permObject[`${section.key}:read`])}
                              onChange={(e) => setPermObject((prev) => ({ ...prev, [`${section.key}:read`]: e.target.checked }))}
                              className="h-3.5 w-3.5 cursor-pointer accent-maroon-600"
                            />
                            قراءة
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-earth-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(permObject[`${section.key}:write`])}
                              onChange={(e) => setPermObject((prev) => ({ ...prev, [`${section.key}:write`]: e.target.checked }))}
                              className="h-3.5 w-3.5 cursor-pointer accent-maroon-600"
                            />
                            كتابة
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 text-sm">{formError}</div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 px-4 py-2 bg-maroon-700 text-white rounded-lg hover:bg-maroon-800 disabled:opacity-60"
                >
                  {busy ? "جارِ الحفظ..." : "حفظ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">تغيير كلمة المرور</h3>
            <p className="text-sm text-earth-600 mb-4">
              للمستخدم: <strong>{passwordUser.name || passwordUser.email}</strong>
            </p>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة"
            />
            {passwordError && (
              <div className="mt-2 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{passwordError}</div>
            )}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => { setPasswordUser(null); setNewPassword(""); setPasswordError(""); }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                className="flex-1 px-4 py-2 bg-maroon-700 text-white rounded-lg hover:bg-maroon-800"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-maroon-50">
            <tr>
              <th className="px-4 py-3 text-right">الاسم</th>
              <th className="px-4 py-3 text-right">البريد</th>
              <th className="px-4 py-3 text-right">الصلاحية</th>
              <th className="px-4 py-3 text-right">تاريخ الإنشاء</th>
              {canManage && <th className="px-4 py-3 text-center">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {staffProfiles.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                <td className="px-4 py-3 text-sm">{user.email || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === "admin" ? "bg-red-100 text-red-800" :
                    user.role === "subadmin" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                    {roleLabel(user.role)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("ar-EG") : "—"}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-800 mx-1"
                        title="تعديل"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => { setPasswordUser(user); setNewPassword(""); setPasswordError(""); }}
                        className="text-amber-600 hover:text-amber-800 mx-1"
                        title="تغيير كلمة المرور"
                      >
                        🔑
                      </button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-800 mx-1"
                          title="حذف"
                          aria-label={`حذف ${user.name}`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {staffProfiles.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-earth-500">
                  لا توجد حسابات مسئولين بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
