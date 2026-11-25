# Client portal: static shell (checkpoint 1)

The 12 Play Testers client portal, built from the approved full-colour design
(`12PlayTesters_client-portal_full-colour.html`, team folder) and the build spec.
Review copy for:
- **Checkpoint 1 (approved):** the phone shell on mock data, all nine states.
- **Checkpoint 2 (approved):** the desktop twins, artboards 10–17.
- **Checkpoint 3 (in review):** data and magic-link wiring on Supabase, as set out in `CONTRACT.md`.

Nothing here merges without Yacine's go-ahead.

- `index.html`: the portal (hash routes: `#signin`, `#welcome`, `#run`, `#activity`, `#messages`, `#settings`)
- `review.html`: every state side by side, desktop at 960 × 615 and phone at 390 × 844, for review only
- `portal.css`: tokens and component classes ported from the design file (not restyled)
- `components.js`: the component set (tester cards ×5, day counters ×3, dots, tags, stamp, tab bar, toggles, bubbles, polaroid, sticky note, two empty states)
- `app.js`: phone screens and router. Below 900px the phone screens are the reference.
- `desktop.js`: desktop twins (artboards 10–17) for 900px and up: top nav, with the wall and status leading and Activity and Messages beside them.
- `data.js`: the data and auth layer. On mock data, `?mock=day0|day9|restart|met|closed|error` picks a scenario.
- `mock/*.json`: placeholder content (Pocket Planner, Maya, invented first names)

Run locally from the repo root, then open `/portal/review.html`:

```bash
python3 -m http.server 8000
```

## Live wiring (checkpoint 3)

Yacine's v1 decisions are written up in `CONTRACT.md`:
- **Hosting:** Netlify at portal.kubeai.info.
- **Run data:** Supabase holds one JSON document per client/app pair, which the portal reads read-only.
- **Sign-in:** Supabase Auth magic links.

Files:
- `config.js`: the project URL and public anon key for `portal-kubeai`. The portal runs live only on portal.kubeai.info. Deploy previews and local runs always use mock data and never contact Supabase, and `?mock=` picks the state there.
- `data.js`: the PKCE magic-link session and a read-only select of the client's `portal_runs` row. It checks each document before drawing it.
- `vendor/supabase-js-2.118.0.js`: the official browser bundle, pinned and checked against the npm registry's integrity hash (MIT licence in `vendor/supabase-js-LICENSE`).
- `fonts/`: a copy of the site font, so the folder works when served on its own as the site root.

Backend status:
- **Done:**
  - project, table, access rules and Auth settings
  - Resend domain verified, and SMTP saved in Supabase
- **Not yet:**
  - no sign-in email sent, so delivery is untested
  - the Netlify site and domain
  - client users
  - the storage bucket: its SQL is in `CONTRACT.md`, waiting for Yacine's review
- **Decided:**
  - v1 stays read-only, with email as the reply channel
  - previews stay on mock data
  - screenshots live in a private bucket with signed links that expire after an hour

Screenshots: `data.js` `signScreens()` signs storage paths in batches and caches the links. `app.js` `hydrateShots()` loads today's images with the page and the other days when they're scrolled into view. Until the bucket exists, placeholders show.

Not built, by decision:
- deletion or retention job (30 days after close is a proposal)
- keep-alive or plan upgrade
- writes of any kind
- sending email from the dev side

## Notes for review

- The "Next day" demo control from the prototype is not included (spec 04).
- The weekday is worked out from `startDate`. The mock runs start Tuesday 1 Dec 2026, true to the calendar. The design's "Monday 1 December" was a copy error (confirmed).
- Not drawn in the design, built from the component set, approved at checkpoint 1:
  - the run view while seats fill (day-0 counter with opted-in and joining cards)
  - the load-error card
  - the archived-thread footer
- "How to apply, step by step" points to Messages for now (approved). TODO in `app.js`: link the production-access guide on play.kubeai.info once it is live.
- Copy for Yacine's sign-off (also on `review.html`): error card, "Check your connection and try again. Still stuck? Email us and we'll sort it."; archived footer, "This run is closed. The thread stays here to read."
- Desktop has no separate welcome page. While seats fill, the Run tab is the welcome view (artboard 14).
- Notifications is a top-nav item on desktop, and the iPhone home-screen note shows on the phone only.
- The desktop sidebar's reply box posts into the same thread as Messages. In the shell, nothing leaves the page.
