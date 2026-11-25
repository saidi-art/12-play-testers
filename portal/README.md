# Client portal: static shell (checkpoint 1)

The 12 Play Testers client portal, built from the approved full-colour design
(`12PlayTesters_client-portal_full-colour.html`, team folder) and the build spec.
Review copy for:
- **Checkpoint 1 (approved):** the phone shell on mock data, all nine states.
- **Checkpoint 2 (in review):** the desktop twins, artboards 10–17.

Nothing here merges without Yacine's go-ahead.

- `index.html`: the portal (hash routes: `#signin`, `#welcome`, `#run`, `#activity`, `#messages`, `#settings`)
- `review.html`: every state side by side, desktop at 960 × 615 and phone at 390 × 844, for review only
- `portal.css`: tokens and component classes ported from the design file (not restyled)
- `components.js`: the component set (tester cards ×5, day counters ×3, dots, tags, stamp, tab bar, toggles, bubbles, polaroid, sticky note, two empty states)
- `app.js`: phone screens and router. Below 900px the phone screens are the reference.
- `desktop.js`: desktop twins (artboards 10–17) for 900px and up: top nav, with the wall and status leading and Activity and Messages beside them.
- `data.js`: mock-only data layer; `?mock=day0|day9|restart|met|closed|error` picks a scenario
- `mock/*.json`: placeholder content (Pocket Planner, Maya, invented first names)

Run locally from the repo root, then open `/portal/review.html`:

```bash
python3 -m http.server 8000
```

## Not built yet (waiting on Yacine)

1. **Where the portal lives.** It sits in `/portal/` on this branch only so it can be reviewed. It isn't linked from the site and is `noindex`. It can move to a separate repo or Netlify project unchanged.
2. **Admin data feed.** `data.js` reads one run-state JSON per run, standing in for what the admin view will export. The shape is a placeholder until Yacine sets the contract, and no endpoints are invented.
3. **Magic-link sender.** The sign-in form does not send anything. It shows a "review copy" notice instead. Delivery won't be built until Yacine confirms the sender.

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
