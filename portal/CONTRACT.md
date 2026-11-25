# Client portal: data and auth contract

Status: **v1 decided by Yacine** (hosting, data feed and magic-link sender, below). The SQL and the field list put those decisions into practice and are for Yacine to review before he applies them in Supabase. Nothing merges before his review.

## The three decisions

| Call | Decision |
|---|---|
| Where the portal lives | Static site on Netlify at **portal.kubeai.info**. Yacine sets up the DNS and the Netlify site; deploy previews stay as they are. |
| Admin data feed | **Supabase** holds the run state: **one JSON document per client, keyed by the client/app pair**, in the shape below. In v1 Yacine edits it by hand in the Supabase dashboard. No custom backend and no live endpoint: the portal reads the row read-only. A live endpoint is a later decision, only if the snapshot outgrows itself. |
| Magic-link sender | **Supabase Auth** magic links by email, using Supabase's default sender to start and moving to a kubeai.info sender later if needed. The only email the portal ever causes is that sign-in link. |

## Storage: one row per client/app pair

The SQL below is for Yacine to apply in the Supabase SQL editor:

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
```

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
- **Accounts:** `shouldCreateUser: false` means only addresses Yacine has added can get a link. He adds each client under Dashboard → Authentication → Users → Add user, using the same email as `client_email`.
- **Sign-in screen copy:** the screen says "check your inbox" whether or not the address has an account, so it never reveals who is a client.
- **Supabase settings:**
  - **Auth → URL Configuration:** Site URL `https://portal.kubeai.info`. Redirect URLs: `https://portal.kubeai.info/**`, plus the deploy-preview pattern for this Netlify site.
  - **Email template:** the default "Magic Link" template works as is.

> ⚠️ **The default sender only reaches the Supabase team.** Since 26 Sep 2024, Supabase's built-in email provider delivers only to members of the project's organisation, at 2 emails per hour across the whole project, on a best-effort basis. It's fine for testing with team addresses. Clients will not receive links until a custom SMTP sender is set up (for example a kubeai.info address). That change is made in Supabase settings only; the portal code stays the same. Turn off link tracking at the SMTP provider, because it can break the sign-in links.

## Still open (Yacine)

1. **Messages and notification settings, the write path.** The spec treats sending messages and the notification toggles as live features, but v1 reads `doc` read-only. Until a write path is decided, the live portal shows the thread and the settings without saving changes, and says so plainly. Two options:
   - a `portal_messages` table the client can only insert into, plus a `portal_prefs` row
   - keep email as the reply channel for now
2. **Screenshot hosting.** Where `activity[].screenshots[].src` images live, for example a private Supabase Storage bucket with signed URLs.
