# Client portal: data and auth contract

Status: **v1 decided by Yacine, backend applied on 25 Nov 2026** (Supabase project `portal-kubeai`, ref `wtejbawmpmmhkusvgfla`, EU North). The SQL below is what was actually applied. Nothing merges or deploys before Yacine's review.

## Decisions

| Call | Decision |
|---|---|
| Where the portal lives | Static site on Netlify at **portal.kubeai.info**. Yacine sets up the DNS and the Netlify site (not done yet). The portal runs live only on that host; deploy previews and local runs use mock data. |
| Admin data feed | **Supabase** holds the run state: **one JSON document per client, keyed by the client/app pair**, in the shape below. In v1 Yacine edits it by hand in the Supabase dashboard. No custom backend and no live endpoint: the portal reads the row read-only. A live endpoint is a later decision, only if the snapshot outgrows itself. |
| Magic-link sender | **Supabase Auth** magic links by email, sent through custom SMTP: `noreply@portal.kubeai.info` ("Kubeai Portal") via Resend. The only email the portal ever causes is that sign-in link. |
| Writes (messages, settings) | **None in v1.** The portal stays read-only, email stays the reply channel, and the live portal says so on Messages and Notifications. "Email us" stays without an address for now (play.kubeai.info has only a contact form); Yacine will decide on an address later. |
| Screenshot hosting | **Private Supabase Storage bucket `run-screenshots`** in portal-kubeai, one folder per client, signed links that expire after 1 hour. Today's images load with the page; other days load only when the client scrolls to them. The portal side is built. **The bucket and its SQL are not applied:** Yacine reviews and applies the SQL below, then runs the isolation check. |
| Previews | Stay on mock data. No preview host goes into Supabase's Redirect URLs or `LIVE_HOSTS` for now. |
| Free plan | Free projects can pause after inactivity, which would take the whole portal offline. No paid upgrade and no keep-alive workaround are authorised; Yacine will decide separately. |

## Storage: one row per client/app pair

This is the SQL as applied in the Supabase SQL editor on 25 Nov 2026. It adds the revoke/grant lines to the first draft, because the project has auto-grant and auto-RLS for new tables turned off:

```sql
create table public.portal_runs (
  client_email text not null,          -- the address the client books with and signs in with
  app          text not null,          -- app slug, e.g. 'pocket-planner'
  doc          jsonb not null,         -- the run-state document (shape below)
  updated_at   timestamptz not null default now(),
  primary key (client_email, app)
);

alter table public.portal_runs enable row level security;

-- Clients can read only their own rows. There are no insert, update or delete policies, so the portal is read-only.
-- Yacine edits rows in the dashboard, which bypasses RLS.
create policy "client reads own runs" on public.portal_runs
  for select to authenticated
  using (lower(client_email) = lower(auth.jwt() ->> 'email'));

-- Expose the table to the Data API for signed-in clients only.
revoke all on public.portal_runs from anon, authenticated;
grant select on public.portal_runs to authenticated;
```

Yacine's check run (rolled back):
- A signed-in client whose email differs only in case still sees their own row, and only that row.
- An unrelated email sees no rows.
- Inserts by signed-in users are refused.
- Anonymous reads are refused. We confirmed this from the portal side too: an anonymous read returns `42501 permission denied`.

The table is empty; rows are added by hand in the dashboard. Every new table in this project needs explicit grants and RLS.

- The portal requests `select doc from portal_runs order by updated_at desc limit 1`. RLS limits that to the signed-in client's rows. If a client has more than one app, `?app=<slug>` picks one; otherwise the most recently updated row is shown.
- Yacine sets `updated_at` when he edits a row in the dashboard. Without that, the "most recent" ordering won't change.
- The anon key in `portal/config.js` is public by design. Access is enforced by the RLS policy above.

## The run-state document (`doc`)

This is the same shape as `portal/mock/*.json`, which serve as worked examples for every state.

| Field | Type | Notes |
|---|---|---|
| `run.client` | string | Client's first name, shown in "Welcome, Maya" |
| `run.clientEmail` | string | Informational. The portal shows the signed-in session's email, not this field. |
| `run.app` | string | App display name |
| `run.startDate` | `YYYY-MM-DD` | Weekdays are computed from this date, never typed by hand |
| `run.day` | 0–14 | Current day. `0` while seats are filling. |
| `run.state` | enum | `filling` · `in_progress` · `restarted` · `requirement_met` · `closed` |
| `run.lastUpdate` | string | Free text after "Last update", e.g. `today, 14:20` |
| `run.restart` | object or absent | `{ posted: true, date, left, joined }`. The banner shows only when `posted` is true. |
| `run.closedOn` | `YYYY-MM-DD` | Required when `state` is `closed` |
| `testers` | array of exactly 12 | One entry per seat, in seat order |
| `testers[].seat` | 0–11 | Sets the avatar colour |
| `testers[].name` | string or null | **First name only.** Null while the seat is `joining`. |
| `testers[].status` | enum | `joining` · `opted_in` · `active` · `missed` · `replacement` |
| `testers[].days` | 0–14 | Day count |
| `testers[].streak` | array of 14 | Each entry is `"on"`, `"miss"` or `""`. `"miss"` shows orange, so post one only once the missed day is confirmed. |
| `activity` | array, newest first | `[]` shows the Illustrative empty state |
| `activity[].date` / `.day` / `.label` | | e.g. `2026-12-09`, `9`, `Today, day 9` |
| `activity[].checkedIn` | 0–12 | |
| `activity[].screenshots[]` | `{ id, tester, path }` | `path` is the file's storage path in `run-screenshots` (see Screenshots below). Leave it out for a placeholder frame. `src` (an https URL) is still accepted for an image hosted elsewhere, but storage `path` is the v1 route. |
| `activity[].notes[]` | `{ tester, text }` | Shown as sticky notes |
| `messages` | array, oldest first | `[]` shows "Say hello" |
| `messages[]` | `{ from, type, day, text \| fileName, url? }` | `from` is `us` or `client`; `type` is `text` or `file` |
| `unread` | number | Badge count for Messages |
| `prefs` | object | `{ push, digest, quietFrom, quietTo }` (times as `HH:00`) |

The portal checks the document when it loads: state values, 12 testers, 14-entry streaks and dates. If any check fails, it shows the load-error card rather than a half-drawn run. Each failure is logged to the browser console so a typo in the dashboard is easy to find.

Privacy rules (spec 05): first names and initial avatars only. Never put real tester identities, photos or contact details in `doc`. Never write copy that claims or implies Google's approval.

## Sign-in: Supabase Auth magic link

- **Method:** `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: <portal URL> } })` with the PKCE flow. The link signs the client in on the device that asked for it and works once.
- **Accounts:** sign-ups are off in the project, and the portal also passes `shouldCreateUser: false`. Only addresses Yacine adds under Dashboard → Authentication → Users can get a link, using the same email as `client_email`. No client users exist yet.
- **Sign-in screen copy:** the screen says "check your inbox" whether or not the address has an account, so it never reveals who is a client.
- **Supabase settings (as applied):**
  - **Auth → URL Configuration:** Site URL `https://portal.kubeai.info`. Redirect URLs: `https://portal.kubeai.info/**` only.
  - **Previews:** Netlify preview URLs are not on the list, which is why previews stay on mock data. To test live sign-in on a preview, add its host to Redirect URLs first, then to `LIVE_HOSTS` in `config.js`.
  - **Sign-in options:** Confirm email on, Magic link enabled, anonymous sign-ins and manual linking off.
  - **Email template:** the default "Magic Link" template works as is.

> **Email status:**
> - **Set up:** the portal.kubeai.info domain is verified in Resend, and the SMTP connection is saved in Supabase (`smtp.resend.com:465`, user `resend`, API key in Yacine's vault, never in this repo).
> - **Untested:** no sign-in email has been sent yet, so delivery hasn't been tested. The dev team sends no email to any client or test address.
> - **Limits:** once custom SMTP is on, Supabase's email rate limit applies; the hourly figure isn't confirmed yet. Turn off link tracking in Resend, because it can break sign-in links.

Test order (Yacine):
1. **Email delivery:** Yacine sends one magic-link email from the Supabase dashboard to a test address he chooses, to check it arrives from `noreply@portal.kubeai.info`. He won't click the link, so this doesn't test sign-in.
2. **Full sign-in:** only once the portal is live on portal.kubeai.info. That needs the Netlify site and domain, and publishing isn't approved yet.

## Screenshots: private bucket, signed links

**Decided:**
- A private bucket `run-screenshots` in portal-kubeai.
- One folder per client, named with the client's sign-in email in **lowercase**.
- Links are signed per image and expire after 1 hour.

**File layout:** `<client email, lowercase>/<app slug>/day-NN/<seat>-<first name>.webp`, for example `maya@pocketplanner.app/pocket-planner/day-09/03-dev.webp`. The portal accepts only lowercase letters, digits, `. _ @ + -` and `/`, ending in `.webp`, `.jpg`, `.jpeg` or `.png`.

**Upload rules:**
- **Hard rule:** crop the status bar and any notifications before upload, so no tester names, contacts or other apps' content appear.
- Resize to about 1080 px wide WebP, roughly 100–200 KB each. That's about 168 images and 25 MB per 14-day run.

**How the portal loads them:**
- **Signing:** it signs storage paths with the client's own session in batched calls (`createSignedUrls`, 3600 s) and caches each link until 5 minutes before expiry, so nothing is signed twice.
- **Today:** the newest day's thumbnails, including the desktop sidebar's first 6, are signed with the page.
- **Other days:** signed only when the client scrolls them into view (150 px ahead). On a phone, the second six of a day load only after "See all 12".
- **Failures:** a missing file or a failed signing call leaves the placeholder frame and logs a warning; it never breaks the page.

### Storage SQL: final, for Yacine to review and apply (not yet applied)

```sql
-- Private bucket: no public URLs, 2 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('run-screenshots', 'run-screenshots', false, 2097152,
        array['image/webp', 'image/jpeg', 'image/png']);

-- Signed-in clients can read (and so sign links for) only files in their own folder.
-- No insert, update or delete policies: uploads and deletions happen in the dashboard (service role).
create policy "client reads own screenshots" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'run-screenshots'
    and (storage.foldername(name))[1] = lower(auth.jwt() ->> 'email')
  );
```

Notes:
- Supabase's storage schema comes with RLS on `storage.objects` and its own grants; the auto-grant setting for new `public` tables doesn't apply here. No `anon` policy exists, so anonymous requests are refused.
- The policy compares the folder with the **lowercased** sign-in email, so folders must be created in lowercase.

**Isolation check, after applying.** This is the same as on `portal_runs`:
1. Upload one test image to `a@x.test/check/day-01/00-test.webp` and one to `b@y.test/check/day-01/00-test.webp`.
2. Run this in the SQL editor:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"A@X.test"}', true);
select name from storage.objects where bucket_id = 'run-screenshots';  -- expect only a@x.test/…
select set_config('request.jwt.claims', '{"role":"authenticated","email":"nobody@z.test"}', true);
select name from storage.objects where bucket_id = 'run-screenshots';  -- expect no rows
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select name from storage.objects where bucket_id = 'run-screenshots';  -- expect no rows
rollback;
```

3. Delete the two test images.

**Retention (proposal for Yacine's review):** delete a client's folder **30 days after the run closes** (`run.closedOn` + 30). Nothing is built or scheduled: no deletion job until Yacine confirms. Until then, deletion is by hand in the dashboard.

## Still open (Yacine)

1. **Storage SQL:** review and apply the SQL above, then run the isolation check.
2. **Retention:** confirm the 30-days-after-close proposal and how deletion happens. No job is built until then.
3. **Free plan pausing:** upgrade or not. Nothing is added in the meantime.
4. **Support email for "Email us":** later.
5. **Publishing:** the Netlify site, the domain, and the go-ahead to publish, which comes before the full sign-in test.
