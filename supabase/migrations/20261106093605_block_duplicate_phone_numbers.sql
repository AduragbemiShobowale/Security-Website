-- Applied to the "flaming security" Supabase project on 2026-11-06.
-- Together with operatives_email_unique, this stops the same person
-- registering twice. Names are deliberately NOT unique: two different
-- operatives can share a name.

-- A phone number must have at least 10 digits (ignoring spaces, dashes, +).
alter table public.operatives
  add constraint operatives_phone_min_digits
  check (length(regexp_replace(phone, '\D', '', 'g')) >= 10);

-- One registration per phone number. Compare the last 10 digits so
-- 08031234567, +2348031234567 and 0803 123 4567 count as the same number.
create unique index if not exists operatives_phone_unique
  on public.operatives (right(regexp_replace(phone, '\D', '', 'g'), 10));
