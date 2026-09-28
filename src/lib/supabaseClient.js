import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// كشف القيم الناقصة أو الـ placeholder الشائعة عشان ما ننهارش وقت التشغيل
const PLACEHOLDER_RE = /(your-project|your_supabase|placeholder|example\.com|change[_-]?me|xxx|0000-0000)/i;

const isEmpty = (value) => !value || String(value).trim() === "";
const isPlaceholder = (value) => PLACEHOLDER_RE.test(String(value));

export const isSupabaseConfigured =
  !isEmpty(url) &&
  !isEmpty(anonKey) &&
  !isPlaceholder(url) &&
  !isPlaceholder(anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
