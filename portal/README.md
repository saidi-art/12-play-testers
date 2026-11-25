# Client portal: static shell (checkpoint 1)

The 12 Play Testers client portal, built from the approved full-colour design
(`12PlayTesters_client-portal_full-colour.html`, team folder) and the build spec.
This is the review copy for **checkpoint 1: phone shell with mock data, all nine states**.
Nothing here merges without Yacine's go-ahead.

- `index.html`: the portal (hash routes: `#signin`, `#welcome`, `#run`, `#activity`, `#messages`, `#settings`)
- `review.html`: every state side by side at 390 × 844, for review only
- `portal.css`: tokens and component classes ported from the design file (not restyled)
- `components.js`: the component set (tester cards ×5, day counters ×3, dots, tags, stamp, tab bar, toggles, bubbles, polaroid, sticky note, two empty states)
- `app.js`: screens and router
- `data.js`: mock-only data layer; `?mock=day0|day9|restart|met|closed|error` picks a scenario
- `mock/*.json`: placeholder content (Pocket Planner, Maya, invented first names)

Run locally from the repo root, then open `/portal/review.html`:

```bash
python3 -m http.server 8000
```

## Not built yet (waiting on Yacine)

1. **Where the portal lives.** It sits in `/portal/` on this branch only so it can be reviewed. It isn't linked from the site and is `noindex`. It can move to a separate repo or Netlify project unchanged.
2. **Admin data feed.** `data.js` reads only the mock files. The mock shape is a working placeholder, not a contract, and no endpoints are invented.
3. **Magic-link sender.** The sign-in form does not send anything. It shows a "review copy" notice instead.

## Notes for review

- The "Next day" demo control from the prototype is not included (spec 04).
- The design's welcome copy says "Monday 1 December", but 1 Dec 2026 is a Tuesday. The screen derives the weekday from `startDate`, so it reads "Tuesday".
- These pieces aren't drawn in the design, so they follow the component set:
  - the run view while seats fill (day-0 counter with opted-in and joining cards)
  - the load-error card
  - the archived-thread footer
- "How to apply, step by step" points to Messages until a guide exists.
