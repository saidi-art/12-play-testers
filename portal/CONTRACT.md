# Client portal: data and auth contract

Status: **v1 decided by Yacine, backend applied on 25 Nov 2026** (Supabase project `portal-kubeai`, ref `wtejbawmpmmhkusvgfla`, EU North). The SQL below is what was actually applied. Nothing merges or deploys before Yacine's review.

## The three decisions

| Call | Decision |
|---|---|
| Where the portal lives | Static site on Netlify at **portal.kubeai.info**. Yacine sets up the DNS and the Netlify site (not done yet). The portal runs live only on that host; deploy previews and local runs use mock data. |
| Admin data feed | **Supabase** holds the run state: **one JSON document per client, keyed by the client/app pair**, in the shape below. In v1 Yacine edits it by hand in the Supabase dashboard. No custom backend and no live endpoint: the portal reads the row read-only. A live endpoint is a later decision, only if the snapshot outgrows itself. |
| Magic-link sender | **Supabase Auth** magic links by email, sent through custom SMTP: `noreply@portal.kubeai.info` ("Kubeai Portal") via Resend. The only email the portal ever causes is that sign-in link. |
| Writes (messages, settings) | **None in v1.** The portal stays read-only, email stays the reply channel, and the live portal says so on Messages and Notifications. |

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
| `activity[].screenshots[]` | `{ id, tester, src }` | `src` is an image URL, or null for a placeholder frame |
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

> **Email status:** custom SMTP is saved: `smtp.resend.com:465` as user `resend`, with the API key in Yacine's vault, never in this repo. Resend's verification of the portal.kubeai.info domain is **still pending**, so no sign-in email has been sent or tested. Until Yacine says delivery works, build against mock data, and send no email to any client or test address. Once custom SMTP is on, Supabase's email rate limit applies; the hourly figure isn't confirmed yet. Turn off link tracking in Resend, because it can break sign-in links.

## Still open (Yacine)

1. **Screenshot hosting.** Where the `activity[].screenshots[].src` images live. A recommendation has been sent to Yacine; nothing is built until he decides.
