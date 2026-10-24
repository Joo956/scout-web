-- ============================================================
-- 💰 تفعيل أسعار شراء المنتجات (سعر الشراء — سري للأدمن ومسؤول المتجر)
-- لوحة Supabase ← SQL Editor ← الصق ده ← Run. يمكن تشغيله أكثر من مرة.
-- ============================================================

-- 1) جدول أسعار الشراء — منفصل عن المنتجات عشان الأعضاء ما يشوفوهوش أبداً
create table if not exists public.product_costs (
    product_id     uuid primary key references public.products(id) on delete cascade,
    purchase_price numeric not null default 0 check (purchase_price >= 0),
    updated_at     timestamptz not null default now()
);

alter table public.product_costs enable row level security;

grant select, insert, update, delete on table public.product_costs to authenticated;

drop policy if exists "costs read — store managers" on public.product_costs;
drop policy if exists "costs write — store managers" on public.product_costs;
drop policy if exists "costs insert — store managers" on public.product_costs;
drop policy if exists "costs update — store managers" on public.product_costs;
drop policy if exists "costs delete — store managers" on public.product_costs;

-- القراءة: للأدمن أو مسؤول المتجر (صلاحية store:write) فقط
create policy "costs read — store managers"
    on public.product_costs
    for select
    to authenticated
    using (public.is_admin() OR public.has_permission('store:write'));

create policy "costs insert — store managers"
    on public.product_costs
    for insert
    to authenticated
    with check (public.is_admin() OR public.has_permission('store:write'));

create policy "costs update — store managers"
    on public.product_costs
    for update
    to authenticated
    using (public.is_admin() OR public.has_permission('store:write'))
    with check (public.is_admin() OR public.has_permission('store:write'));

create policy "costs delete — store managers"
    on public.product_costs
    for delete
    to authenticated
    using (public.is_admin() OR public.has_permission('store:write'));

-- لا توجد أسعار شراء في public.products؛ هذه البيانات موجودة فقط في product_costs.
