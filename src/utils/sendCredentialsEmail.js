// ✅ إرسال بيانات الدخول على إيميل العضو — عبر Edge Function (send-credentials)
// بيبعت من Gmail SMTP بتاع المجموعة — والأدمن بس اللي له صلاحية
import { supabase } from "../lib/supabaseClient.js";

export const sendCredentialsEmail = async (accounts) => {
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-credentials`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${session?.access_token ?? ""}`,
                },
                body: JSON.stringify({
                    accounts: accounts.map((a) => ({
                        email: String(a.email ?? "").trim(),
                        password: a.password,
                        name: a.name,
                    })),
                }),
            }
        );
        return await res.json();
    } catch (err) {
        return { error: String(err?.message || err) };
    }
};
