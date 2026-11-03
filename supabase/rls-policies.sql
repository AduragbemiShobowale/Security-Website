-- =====================================================================
-- Flaming Security — Row Level Security (RLS) policies
-- =====================================================================
--
-- WHY: the Supabase publishable key in js/supabase-config.js and
-- portal.html is visible to anyone who opens the site. These policies
-- are the only thing stopping a visitor from reading every operative's
-- name, phone, address, date of birth and QR token.
--
-- WHAT THIS ALLOWS
--   Public (not signed in):
--     - read the list of units (needed by the registration form)
--     - submit a registration (insert into operatives, always "pending")
--   Signed-in users listed in admin_users with role admin/super_admin:
--     - full access to operatives, attendance, programmes, units
--   Any signed-in user:
--     - read only their OWN admin_users row (used by the portal login check)
--
-- The "send-operative-qr" Edge Function should use the service-role key,
-- which bypasses RLS, so it is not affected.
--
-- HOW TO RUN
--   1. Supabase dashboard -> SQL Editor.
--   2. Run STEP 1 on its own and read the output. Any policy listed there
--      that is NOT created below (for example one granting anon SELECT on
--      operatives) still applies, because policies are combined with OR.
--      Drop those with: drop policy "<name>" on public.<table>;
--   3. Run STEP 2.
--   4. Test: submit a registration while signed out, then sign in to the
--      portal and approve it, scan/mark attendance, and export Excel.
--   5. Run STEP 3 to confirm anon cannot read operatives.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — inspect what exists today (read-only)
-- ---------------------------------------------------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('operatives', 'attendance', 'programmes', 'units', 'admin_users');

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ---------------------------------------------------------------------
-- STEP 2 — apply policies
-- ---------------------------------------------------------------------
begin;

-- Helper: is the current user an admin?
-- security definer so it can read admin_users regardless of that table's RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.operatives  enable row level security;
alter table public.attendance  enable row level security;
alter table public.programmes  enable row level security;
alter table public.units       enable row level security;
alter table public.admin_users enable row level security;

-- units: public read (registration form), admins manage
drop policy if exists "fs_units_public_read" on public.units;
create policy "fs_units_public_read" on public.units
  for select to anon, authenticated
  using (true);

drop policy if exists "fs_units_admin_write" on public.units;
create policy "fs_units_admin_write" on public.units
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- operatives: public may only insert a pending registration
drop policy if exists "fs_operatives_public_register" on public.operatives;
create policy "fs_operatives_public_register" on public.operatives
  for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists "fs_operatives_admin_all" on public.operatives;
create policy "fs_operatives_admin_all" on public.operatives
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Stop the public from choosing their own id or qr_token on insert:
-- only the columns the registration form sends are insertable by anon.
revoke insert on public.operatives from anon;
grant insert (full_name, email, phone, dob, residential_address, unit_id, status, declaration)
  on public.operatives to anon;

-- attendance and programmes: admins only
drop policy if exists "fs_attendance_admin_all" on public.attendance;
create policy "fs_attendance_admin_all" on public.attendance
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "fs_programmes_admin_all" on public.programmes;
create policy "fs_programmes_admin_all" on public.programmes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- admin_users: a signed-in user can read only their own row.
-- No insert/update/delete policies: manage admins from the dashboard.
drop policy if exists "fs_admin_users_read_own" on public.admin_users;
create policy "fs_admin_users_read_own" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());

commit;


-- ---------------------------------------------------------------------
-- STEP 3 — verify anon cannot read personal data (should return 0)
-- ---------------------------------------------------------------------
-- begin;
-- set local role anon;
-- select count(*) from public.operatives;
-- rollback;
