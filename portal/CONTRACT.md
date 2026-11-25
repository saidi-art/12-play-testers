# Client portal: data and auth contract

Status: **v1 decided by Yacine.** Supabase project `portal-kubeai`, ref `wtejbawmpmmhkusvgfla`, EU North. Nothing merges before Yacine's review.

Where each status claim below comes from:
- **Verified by the dev team, 25 Nov, through the Supabase connector:**
  - **Project:** `ACTIVE_HEALTHY`.
  - **`portal_runs`:** RLS on, and its policy and grants are exactly as below.
  - **Storage:** bucket `run-screenshots` is private, 2 MB limit, images only, with its policy as below.
  - **Isolation check (rolled back):**
    - a client sees only their own run and files, even when the email's capitals differ
    - client inserts are refused
    - another user and anonymous visitors see nothing
  - **Also verified:** the public auth settings (sign-ups off, email sign-in only, anonymous off) and the files and headers on portal.kubeai.info (commit `9fed2365`).
- **Not visible through the connector, so confirm in the dashboard:**
  - Redirect URLs
  - SMTP sender
  - the Magic Link template (still to be switched to the token link below)

## Decisions

| Call | Decision |
|---|---|
| Where the portal lives | Static site on Netlify at **portal.kubeai.info**: the Netlify site `kubeai-portal` is set up with manual uploads (not linked to Git). portal.kubeai.info is **live over HTTPS** and currently serves commit `9fed2365` (checked 25 Nov, file by file, security headers live). The portal runs live only on that host; deploy previews and local runs use mock data. Upload only the runtime files listed under "Deploying" below. |
| Admin data feed | **Supabase** holds the run state: **one JSON document per client, keyed by the client/app pair**, in the shape below. In v1 Yacine edits it by hand in the Supabase dashboard. No custom backend and no live endpoint: the portal reads the row read-only. A live endpoint is a later decision, only if the snapshot outgrows itself. |
| Magic-link sender | **Supabase Auth** magic links by email, sent through custom SMTP: `noreply@portal.kubeai.info` ("Kubeai Portal") via Resend. The only email the portal ever causes is that sign-in link. |
| Writes (messages, settings) | **None in v1.** The portal stays read-only, email stays the reply channel, and the live portal says so on Messages and Notifications. "Email us" stays without an address for now (play.kubeai.info has only a contact form); Yacine will decide on an address later. |
| Screenshot hosting | **Private Supabase Storage bucket `run-screenshots`** in portal-kubeai, one folder per client, signed links that expire after 1 hour. Today's images load with the page; other days load only when the client scrolls to them. The portal side is built. **Bucket: *reported* applied and checked** (own folder visible, other users and signed-out visitors see nothing, client uploads blocked). This SQL was marked for Yacine's review before applying; **who applied it, and when, is still to be confirmed.** |
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

-- Migration rls_auth_jwt_initplan (25 Nov, dev team): same rules, with auth.jwt() evaluated once per
-- query instead of once per row (Supabase lint 0003). Isolation re-checked afterwards.
alter policy "client reads own runs" on public.portal_runs
  using (lower(client_email) = lower((select auth.jwt()) ->> 'email'));
alter policy "client reads own screenshots" on storage.objects
  using (bucket_id = 'run-screenshots'
         and (storage.foldername(name))[1] = lower((select auth.jwt()) ->> 'email'));
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

- **Method:** `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: <portal URL> } })`. The portal accepts two kinds of link:
  - **Recommended (`token_hash`):** the email links to the portal with a one-time token, which the portal checks with `verifyOtp`. It works in any browser or app, including when the client asks on a laptop and opens the email on a phone, or taps it in Gmail's or Outlook's in-app browser. An email scanner that pre-opens links can't use it up, because scanners don't run JavaScript.
  - **Supabase default (PKCE `code`):** works only in the browser that requested the link. It still works, as a fallback.
- **Accounts:** sign-ups are off in the project, and the portal also passes `shouldCreateUser: false`. Only addresses Yacine adds under Dashboard → Authentication → Users can get a link, using the same email as `client_email`. No client users exist yet.
- **Sign-in screen copy:** the screen says "check your inbox" whether or not the address has an account, so it never reveals who is a client.
- **Supabase settings (as applied):**
  - **Auth → URL Configuration:** Site URL `https://portal.kubeai.info`. Redirect URLs: `https://portal.kubeai.info/**` only.
  - **Previews:** Netlify preview URLs are not on the list, which is why previews stay on mock data. To test live sign-in on a preview, add its host to Redirect URLs first, then to `LIVE_HOSTS` in `config.js`.
  - **Sign-in options:** Confirm email on, Magic link enabled, anonymous sign-ins and manual linking off.
  - **Email template:** change it to the token link below. Deploy the portal version that understands it first.

### Magic Link email template (Supabase → Authentication → Emails → Magic Link)

Change the link in the body to the following, keeping the subject. The wording around the link is a suggestion for Yacine's approval:

```html
<h2>Your sign-in link</h2>
<p><a href="{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=email">Sign in to follow your run</a></p>
<p>The link works once. If you didn't ask for it, you can ignore this email.</p>
```

**Order matters:**
1. The portal version that understands token links goes live first.
2. Then the template changes.

The upload at `ddf8da62` ignores `token_hash`, so a client using it would land on the sign-in screen with no error.

> **Email status:**
> - **Delivery tested (*reported*):** domain verified in Resend, SMTP saved in Supabase (`smtp.resend.com:465`, user `resend`, API key in Yacine's vault, never in this repo). One test email reached a test inbox from `noreply@portal.kubeai.info`, and the Resend log confirms it.
> - **Not tested yet:** sign-in from the portal, which needs the live domain. The dev team sends no email to any client or test address.
> - **Limits:** Supabase's email rate limit applies with custom SMTP; the hourly figure isn't confirmed yet. Turn off link tracking in Resend, because it can break sign-in links.

Live test (on portal.kubeai.info, once DNS and HTTPS are done):
1. Sign in from the portal.
2. Request in one browser and open the email in another. This needs the token template above.
3. View a sample run.
4. Check one test screenshot.

## Onboarding a new client (about 2 minutes, after booking)

A client can sign in only once two things exist: their **Auth user** and their **`portal_runs` row**. The play site doesn't link the portal, so a client reaches it only through the link we send. Do both steps first, then send the link.

1. **Add the user:** Supabase → Authentication → Users → Add user → Create new user. Use the email the client booked with and tick "Auto Confirm User". Any password; the client never uses it, because sign-in is by magic link.
2. **Create the run:** open `portal/ops/new-client.sql` in the SQL editor, edit the five values (email, app slug, first name, app name, planned start date) and run it. It creates the day-0 "seats filling" run: 12 joining seats, empty Activity and Messages. Running it twice for the same client/app is refused, never duplicated.
3. **Send the portal link** (`https://portal.kubeai.info`) in the booking confirmation.

The template was tested in Postgres (PGlite), and its output renders correctly in the portal on phone and desktop.

**Self-serve sign-ups are not recommended.** Turning sign-ups on would let anyone create an account from the sign-in page, but it **wouldn't complete a registration**: with no `portal_runs` row, a new account only reaches "We can't find a run for this email yet". The run row is what makes the portal work, and it still has to be created. Open sign-ups would also let anyone make `noreply@portal.kubeai.info` email any address. That would:
- use up the shared email limit, so real clients' links get held back
- hurt the new sending domain's reputation

If automatic onboarding is wanted later, the right trigger is the booking or payment itself, creating the user and the row together, not open sign-ups.

## Deploying (Netlify site `kubeai-portal`, manual upload)

Upload these files from an agreed commit, with nothing else:
- `index.html`
- `portal.css`
- `app.js`, `components.js`, `config.js`, `data.js`, `desktop.js`
- `fonts/`
- `vendor/`
- `_headers`

Leave out `CONTRACT.md`, `README.md`, `review.html` and `mock/`. They are internal documents and the review copy; on the live host, the review page would show only sign-in screens.

`_headers` sets the following for the portal site only (the play site ignores it):
- `noindex`
- no framing
- no referrer, so sign-in tokens in the address bar are never passed on
- a Content-Security-Policy that allows only the portal's own files and the Supabase project

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

### Storage SQL (*reported* applied; who applied it is to be confirmed)

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

1. **Hosting:** the DNS record and HTTPS for portal.kubeai.info, then upload the agreed commit (runtime files only).
2. **Email template:** switch Magic Link to the token link, after that upload.
3. **Live test:** on the real domain, then client users and real rows.
4. **Retention:** confirm the 30-days-after-close proposal. No deletion job is built until then.
5. **Free plan pausing:** upgrade or not. Nothing is added in the meantime.
6. **Support email for "Email us":** later.
7. **Merge:** with Yacine.
