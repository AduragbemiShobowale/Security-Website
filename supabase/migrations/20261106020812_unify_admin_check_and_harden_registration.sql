-- Applied to the "flaming security" Supabase project on 2026-11-06.
--
-- Before this migration, the portal decided who was an admin from
-- public.admin_users, but the database policies checked public.profiles.
-- Anyone in only one of the two would get in but see no data (or the reverse).
-- All admin policies now use public.is_admin(), which reads admin_users.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
      and role in ('admin', 'super_admin')
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter policy "Admins can record attendance" on public.attendance with check ((select public.is_admin()));
alter policy "Admins can view attendance" on public.attendance using ((select public.is_admin()));
alter policy "Admins can update operative records" on public.operatives using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "Admins can view operative records" on public.operatives using ((select public.is_admin()));
alter policy "Admins can create programmes" on public.programmes with check ((select public.is_admin()));
alter policy "Admins can view programmes" on public.programmes using ((select public.is_admin()));

-- Registrants may only send form fields; id, qr_token and timestamps come from defaults.
revoke insert on public.operatives from anon, authenticated;
grant insert (full_name, email, phone, dob, gender, state, residential_address, unit_id,
              experience, experience_details, declaration, status)
  on public.operatives to anon, authenticated;

-- Block duplicate registrations by email (case-insensitive). NULL emails are still allowed.
create unique index if not exists operatives_email_unique on public.operatives (lower(email));
