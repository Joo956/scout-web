import DOMPurify from 'dompurify';

/**
 * Sanitize a string input by stripping all HTML tags.
 * Use on all user-submitted text before saving to the database.
 * Returns the original value if it's not a string (handles null/undefined/numbers).
 */
export function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  if (value.length === 0) return value;
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
}

/**
 * Recursively sanitize all string values in an object.
 * Skips keys that are in the exclude list (e.g., imageUrl which may contain "links://").
 */
export function sanitizeObject(obj, excludeKeys = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) {
      result[key] = value;
    } else if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? sanitizeInput(v) : v);
    } else {
      result[key] = value;
    }
  }
  return result;
}
