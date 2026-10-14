-- ============================================================
-- 💰 تفعيل أسعار شراء المنتجات (سعر الشراء — سري للأدمن ومسؤول المتجر)
-- التشغيل مرة واحدة: لوحة Supabase ← SQL Editor ← الصق ده ← Run
-- ============================================================

-- 1) جدول أسعار الشراء — منفصل عن المنتجات عشان الأعضاء ما يشوفوهوش أبداً
create table if not exists public.product_costs (
    product_id     uuid primary key references public.products(id) on delete cascade,
    purchase_price numeric not null default 0 check (purchase_price >= 0),
    updated_at     timestamptz not null default now()
);

alter table public.product_costs enable row level security;

-- 2) القراءة: للأدمن أو مسؤول المتجر (صلاحية store:write) فقط
create policy "costs read — store managers"
    on public.product_costs
    for select
    using (public.has_permission('store:write'));

-- 3) الكتابة والتعديل والحذف: نفس الصلاحية
create policy "costs write — store managers"
    on public.product_costs
    for all
    using (public.has_permission('store:write'))
    with check (public.has_permission('store:write'));

-- 4) (اختياري للحماية القصوى) منع الأعضاء من قراءة عمود سعر الشراء
--    لو ركبته، مفيش حد يقدر يسأل عن العمود ده من الـ API حتى بالفحص اليدوي.
--    ملحوظة: شيل علامتي -- من السطرين لو حابب تشغله:
-- revoke select (purchase_price) on public.products from anon;
-- revoke select (purchase_price) on public.products from authenticated;

-- ✅ كده عمود «سعر الشراء» هيظهر في إدارة المتجر للإدارة فقط،
--    والأعضاء مش هيشوفوه في الموقع ولا في بياناتهم القادمة من السيرفر.
