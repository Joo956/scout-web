// ✅ الباسورد المثبت لكل مرحلة — لأول دخول فقط
// العضو يدخل بيها أول مرة، والمنصة توجّهه تلقائيًا يعيّن باسورده الخاص
import { stagePairKey } from "./stages.js";

export const STAGE_PASSWORDS = {
  ashbal: "Ashbal26#",
  kashaf: "Kashaf26#",
  mutaqaddim: "Motakadem26#",
  jawwal: "Jawwal26#",
  qaid: "Qaid26#",
  raed: "Raed26#",
};

export const STAGE_PASSWORD_LABELS = {
  ashbal: "أشبال / زهرات",
  kashaf: "كشاف / مرشدات",
  mutaqaddim: "متقدم / رائدات",
  jawwal: "جوال / جوالة",
  qaid: "قائد / قائدة",
  raed: "رائد / رائدة",
};

// باسورد المرحلة حسب نص المرحلة المخزن (مثلاً "جوالة" أو "جوال / جوالة")
export function stagePasswordFor(scoutStage) {
  const key = stagePairKey(scoutStage);
  return STAGE_PASSWORDS[key] ?? "";
}

export function stageLabelFor(key) {
  return STAGE_PASSWORD_LABELS[key] ?? key;
}
