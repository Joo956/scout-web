select count(*) as members_now from public.members;
-- @RUN
select m.name, m.email, m.user_id is not null as has_account from public.members m where m.email ilike '%sheamusbeshoy%' or m.email ilike '%marinasamuel%' or m.email ilike '%adhamgabriel%';
-- @RUN
select count(*) as stale_emails_gone from auth.users where email in ('sheamusbeshoy@gmail.com','marinasamuel28@gmail.com','adhamgabriel02@gmail.com','subadmin324@gmail.com','admin.scout324@gmail.com','bash@gmail.com','bashh@gmail.com','fadymohsen.fm@gmail.com','user@gmail.com');
