// src/utils/generateScoutCode.js

// خريطة المراحل الكشفية (النظام التاريخي)
const STAGE_CODES = {
  'أشبال': 1907,
  'كشاف': 1908,
  'متقدم': 1910,
  'جوالة': 1920,
  'قادة': 1922,
};

// خريطة تحويل الحروف العربية إلى إنجليزية
const ARABIC_TO_ENGLISH_MAP = {
  'ا': 'A', 'أ': 'A', 'إ': 'E', 'آ': 'A', 'ء': 'A',
  'ب': 'B', 'ت': 'T', 'ث': 'Th', 'ج': 'G',
  'ح': 'H', 'خ': 'Kh', 'د': 'D', 'ذ': 'Z',
  'ر': 'R', 'ز': 'Z', 'س': 'S', 'ش': 'Sh',
  'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z',
  'ع': 'A', 'غ': 'G', 'ف': 'F', 'ق': 'K',
  'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
  'ه': 'H', 'ة': 'A', 'و': 'W', 'ي': 'Y', 'ى': 'Y'
};

function transliterateArabic(text) {
  if (!text) return '';
  let result = '';
  const cleanText = text.trim();
  for (let char of cleanText) {
    if (ARABIC_TO_ENGLISH_MAP[char]) {
      result += ARABIC_TO_ENGLISH_MAP[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char;
    }
  }
  return result;
}

function getFirstTwoLetters(name) {
  if (!name) return 'Xx';
  const transliterated = transliterateArabic(name);
  if (transliterated.length === 0) return 'Xx';
  let part = transliterated.substring(0, 2);
  if (part.length === 1) return part.toUpperCase();
  return part.charAt(0).toUpperCase() + part.charAt(1).toLowerCase();
}

export function generateScoutCode(profile) {
  if (!profile) return null;

  const prefix = "AE";

  let yearCode = "0000";
  if (profile.birthDate) {
    const birthYear = new Date(profile.birthDate).getFullYear();
    yearCode = String(birthYear);
  }

  const stageCode = STAGE_CODES[profile.scoutStage] || 0;

  const nameParts = (profile.name || "").trim().split(/\s+/);
  const fatherNameParts = (profile.fatherName || "").trim().split(/\s+/);

  const firstName = nameParts[0] || "";
  const fatherFirstName = fatherNameParts[0] || "";

  const nameCode = getFirstTwoLetters(firstName);
  const fatherCode = getFirstTwoLetters(fatherFirstName);

  const finalCode = `#${prefix}-${yearCode}-${stageCode}-${nameCode}.${fatherCode}`;

  return finalCode;
}

export function generateUniqueScoutCode(profile, existingMembers = []) {
  let baseCode = generateScoutCode(profile);
  if (!baseCode) return null;

  const isDuplicate = existingMembers.some(m => m.scoutCode === baseCode);
  if (!isDuplicate) return baseCode;

  let counter = 1;
  let uniqueCode = `${baseCode}-${counter}`;
  while (existingMembers.some(m => m.scoutCode === uniqueCode)) {
    counter++;
    uniqueCode = `${baseCode}-${counter}`;
  }

  return uniqueCode;
}