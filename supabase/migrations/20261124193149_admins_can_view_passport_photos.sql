-- Applied to the "flaming security" Supabase project on 2026-11-24.
-- Admin portal "View Biodata" shows the operative's passport photo via a short-lived signed URL.
-- Read-only: uploads still only happen through the submit-operative-biodata Edge Function.
create policy "Admins can view passport photos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'operative-passports' and (select public.is_admin()));
