# Flaming Security — Website v2

Static site for the Flaming Security department.

Public pages: Home, About, Leadership, Units & KPIs, Services (Book Us), Contact, Operative Registration.
Admin: `portal.html` — Supabase-authenticated management portal (approvals, QR codes, attendance, Excel reports).

## Deploy to Vercel

### Option A — Drag & Drop (fastest)
1. Go to https://vercel.com → **Add New Project → Deploy without Git**
2. Drag the entire project folder into the upload box
3. Leave all settings as default and click Deploy
4. Live in under a minute at e.g. `https://flaming-security.vercel.app`

### Option B — Git (recommended for future updates)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → **Add New Project → Import Git Repository**
3. Select your repo. Set:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (or the folder if nested)
   - **Build Command:** *(leave blank)*
   - **Output Directory:** `.`
4. Click Deploy. Every `git push` auto-publishes from then on.

### Custom domain
Project Settings → Domains → Add your domain, then update DNS as Vercel guides you.

## Editing content

All pages are plain HTML — open in any editor.

- **Design tokens & layout:** `css/style.css`
- **Shared JS:** `js/main.js` — nav, flame canvas, scroll reveal, counter animation, gallery lightbox
- **Registration:** `js/registration.js` + `js/supabase-config.js` (Supabase URL and publishable key)
- **Admin portal:** all logic is inline in `portal.html`

The Supabase publishable key is public by design. Data is only protected by Row Level Security
policies on the `operatives`, `attendance`, `programmes`, `units` and `admin_users` tables — keep those enabled.
Database changes are kept in `supabase/migrations/`. The approval-email Edge Function is in
`supabase/functions/send-operative-qr/` (needs the `RESEND_API_KEY` and `EMAIL_FROM` secrets).

**Admins:** a person is an admin when their auth user id is in `public.admin_users` with role
`admin` or `super_admin`. That single table controls both portal login and data access.

## Adding real content

### Replace gallery placeholders (index.html)
Tiles `gi-1`–`gi-6` already have photos. Find tiles `gi-7` and `gi-8` and replace the `gallery-placeholder` div with:
```html
<img src="assets/gallery/your-photo.jpg" alt="Description" loading="lazy">
```
Drop photos into `assets/gallery/` (create the folder).

### Add pending leader photos (leadership.html)
Drop the photo into `assets/leaders/` then replace the "Photo Pending" block with:
```html
<div class="duty-photo">
  <img src="assets/leaders/yourfile.jpg" alt="Name — Role" loading="lazy">
  <div class="callsign">Call Sign<b>CALLSIGN</b></div>
</div>
```

### Add real uniform photo (index.html)
In the uniform showcase section, find `.uniform-svg-wrap` and replace the `<svg>` with:
```html
<img src="assets/uniform-2026.jpg" alt="Flaming Security 2026 Uniform" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">
```

### Fill open unit head positions (leadership.html)
Search for "Position Open" cards and replace with the filled card pattern above.

## Still needed (photos)
- Ground Control — Faith Opeyemi
- Welfare — Roseline  
- Traffic — Merit
- Market Control — unit head (position open)
- All Personnel — unit head (position open)
- Event/gallery photos (crowd, training, deployment)
- 2026 uniform reference photo
