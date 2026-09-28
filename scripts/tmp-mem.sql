select u.id, u.email from auth.users u join public.profiles p on p.id = u.id where p.role = 'member' limit 1;
