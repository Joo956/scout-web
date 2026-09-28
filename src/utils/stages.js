const normalizeArabic = (s) =>
  String(s ?? "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");

export const STAGE_PAIRS = [
  {
    key: "ashbal",
    male: "أشبال",
    female: "زهرات",
    label: "أشبال / زهرات",
    maleVariants: ["اشبال", "الاشبال"],
    femaleVariants: ["زهرات", "الزهرات"],
  },
  {
    key: "kashaf",
    male: "كشاف",
    female: "مرشدات",
    label: "كشاف / مرشدات",
    maleVariants: ["كشاف", "مرشح كشاف"],
    femaleVariants: ["مرشدات", "المرشدات"],
  },
  {
    key: "mutaqaddim",
    male: "متقدم",
    female: "رائدات",
    label: "متقدم / رائدات",
    maleVariants: ["متقدم"],
    femaleVariants: ["رائدات"],
  },
  {
    key: "jawwal",
    male: "جوال",
    female: "جوالة",
    label: "جوال / جوالة",
    maleVariants: ["جوال", "مرشح جوال"],
    femaleVariants: ["جواله", "جوالات", "الجواله", "الجوالات", "مرشح جواله"],
  },
  // 👇 رجعناهم تاني — موجودين كتعريف بس ملهمش فصول
  {
    key: "qaid",
    male: "قائد",
    female: "قائدة",
    label: "قائد / قائدة",
    maleVariants: ["قائد", "قاده"],
    femaleVariants: ["قائده"],
  },
  {
    key: "raed",
    male: "رائد",
    female: "رائدة",
    label: "رائد / رائدة",
    maleVariants: ["رائد", "رواد"],
    femaleVariants: ["رائده"],
  },
];

// 🏫 المراحل اللي ليها فصول وهيكل — دي بس اللي تظهر في إدارة الحضور
export const STRUCTURE_STAGE_KEYS = ["ashbal", "kashaf", "mutaqaddim", "jawwal"];

// 🎖️ مراحل القيادة — اللي ليهم حق المسئولية والحسابات
export const LEADER_STAGE_KEYS = ["jawwal", "qaid", "raed"];


export const stagePairKey = (value) => {
  if (!value) return null;
  const norm = normalizeArabic(value);
  const parts = norm.split("/").map((p) => p.trim());
  for (const pair of STAGE_PAIRS) {
    for (const variant of [...pair.femaleVariants, ...pair.maleVariants]) {
      if (parts.includes(variant) || norm === variant) return pair.key;
    }
  }
  // مطابقة جزئية (نصوص زي "مرحله الجواله")
  for (const pair of STAGE_PAIRS) {
    for (const variant of [...pair.femaleVariants, ...pair.maleVariants]) {
      if (norm.includes(variant)) return pair.key;
    }
  }
  return null;
};

// تحديد أي نسخة (مذكر/مؤنث) من نص خام — للعرض والاستيراد
// بنفحص المؤنث الأول عشان "جواله" ما تاخدش مطابقة "جوال" الغلط
export const stageGenderFromRaw = (raw) => {
  const norm = normalizeArabic(raw);
  if (!norm) return null;
  for (const pair of STAGE_PAIRS) {
    for (const fv of pair.femaleVariants) {
      if (norm === fv || norm.includes(fv)) return { key: pair.key, female: true };
    }
  }
  for (const pair of STAGE_PAIRS) {
    for (const mv of pair.maleVariants) {
      if (norm === mv || norm.includes(mv)) return { key: pair.key, female: false };
    }
  }
  return null;
};

// نسخة العضو: هو مرحلته (زي ما هي متخزنة) مؤنثة ولا مذكر؟
export const isFemaleStage = (stageLabel) =>
  stageGenderFromRaw(stageLabel)?.female ?? false;

// عرض المرحلة بنسخة العضو: شارة "جوال / جوالة" → عضو مؤنث تشوفها "جوالة"
export const stageForMember = (stageValue, memberStageLabel) => {
  const key = stagePairKey(stageValue);
  if (!key) return stageValue || "";
  const pair = STAGE_PAIRS.find((p) => p.key === key);
  return isFemaleStage(memberStageLabel) ? pair.female : pair.male;
};

// العرض المحايد: "جوال / جوالة"
export const stagePairLabel = (stageValue) => {
  const key = stagePairKey(stageValue);
  const pair = STAGE_PAIRS.find((p) => p.key === key);
  return pair?.label ?? stageValue ?? "";
};

// هل العضو ده تابع لمرحلة الشارة/الامتحان؟ (بنص على مفتاح الزوج)
// من غير مرحلة محددة → متاح للجميع (توافق مع القديم)
export const stageMatches = (itemStage, memberStageLabel) => {
  if (!itemStage) return true;
  const itemKey = stagePairKey(itemStage);
  if (!itemKey) return true;
  const memberKey = stagePairKey(memberStageLabel);
  return memberKey ? memberKey === itemKey : false;
};
