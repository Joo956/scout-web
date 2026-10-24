export const LIBRARY_CATEGORIES = ["اجتماعي", "ثقافي", "كشفي", "روحي"];

export function getLibraryCategory(category) {
  const value = String(category ?? "").trim();
  return LIBRARY_CATEGORIES.find((item) => item === value) ?? null;
}
