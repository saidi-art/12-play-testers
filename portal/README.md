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
- `config.js`: the Supabase URL and anon key. While both are empty, the portal runs on mock data, which is what the review copy does today. On portal.kubeai.info it always runs live and ignores `?mock=`. Elsewhere, such as deploy previews, `?mock=` still shows the review states.
- `data.js`: the PKCE magic-link session and a read-only select of the client's `portal_runs` row. It checks each document before drawing it.
- `vendor/supabase-js-2.118.0.js`: the official browser bundle, pinned and checked against the npm registry's integrity hash (MIT licence in `vendor/supabase-js-LICENSE`).
- `fonts/`: a copy of the site font, so the folder works when served on its own as the site root.

Before going live, Yacine needs to:
1. Fill in `config.js` with the project URL and anon key.
2. Run the SQL in `CONTRACT.md`.
3. Add each client under Authentication → Users.
4. Set the Site URL and Redirect URLs under Auth → URL Configuration.
5. Set up a custom SMTP sender, because Supabase's default sender only reaches the project's own team.

Still open: the write path for messages and notification settings. Until it's decided, the live portal shows both as read-only. Screenshot hosting is also undecided.

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
