// ✅ Shared utility for the "links://" multi-image protocol
// The prefix "links://" is 8 characters — must use slice(8)

export function parseLinks(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("links://")) return null;
  try {
    return JSON.parse(imageUrl.slice(8));
  } catch {
    return null;
  }
}

export function buildLinksValue(links) {
  if (!links || links.length === 0) return "";
  return "links://" + JSON.stringify(links);
}

/**
 * Extract an array of plain URL strings from a product's imageUrl field.
 * Handles both plain URL strings and the links:// protocol.
 * The links:// payload may contain either plain strings or {url, label} objects.
 */
export function getProductImages(imageUrl) {
  const parsed = parseLinks(imageUrl);
  if (parsed) {
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : item?.url?.trim() || ""))
      .filter(Boolean);
  }
  if (imageUrl && typeof imageUrl === "string" && imageUrl.trim()) {
    return [imageUrl.trim()];
  }
  return [];
}

// مواقع بيقدموا صور مباشرة — روابطها تعتبر صور حتى من غير امتداد في الآخر
const KNOWN_IMAGE_HOSTS = [
  "imgs.search.brave.com",
  "i.postimg.cc",
  "i.ibb.co",
  "i.imgur.com",
  "res.cloudinary.com",
  "images.unsplash.com",
  "images.pexels.com",
  "cdn.pixabay.com",
  "live.staticflickr.com",
  "upload.wikimedia.org",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "i3.wp.com",
];

/**
 * هل الرابط ده هينفع يظهر كصورة؟
 * القاعدة الموحدة بين لوحة المسئول وصفحة الأعضاء:
 * 1) بينتهي بامتداد صورة (.jpg / .png / ...) — أو
 * 2) من موقع صور معروف (brave / postimg / imgur / unsplash ...) حتى لو مفيش امتداد.
 */
export function isImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (/\.(jpe?g|png|gif|webp|avif|bmp|svg)(?:\?.*)?$/i.test(u)) return true;
  try {
    return KNOWN_IMAGE_HOSTS.includes(new URL(u).hostname.toLowerCase());
  } catch {
    return false;
  }
}
