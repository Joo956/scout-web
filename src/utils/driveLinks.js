// ✅ روابط Google Drive — استخراج الملف والتحويل لروابط قابلة للعرض
// رابط المشاركة العادي (file/d/ID/view) مش بيشتغل كـ <img> — لازم thumbnail أو preview

const DRIVE_ID_RE = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=&)?id=|thumbnail\?id=)([\w-]{20,})/;

export function driveFileId(url) {
  const m = String(url || "").match(DRIVE_ID_RE);
  return m ? m[1] : null;
}

export function isDriveLink(url) {
  return Boolean(driveFileId(url));
}

/**
 * تحويل رابط Google Drive حسب طريقة العرض:
 *  - image → thumbnail (يشتغل كصورة عادية)
 *  - video → /preview (يشتغل جوه iframe)
 *  - غير كده → الرابط زي ما هو
 */
export function toViewableDriveUrl(url, type) {
  const id = driveFileId(url);
  if (!id) return url;
  if (type === "image") return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  if (type === "video") return `https://drive.google.com/file/d/${id}/preview`;
  return url;
}
