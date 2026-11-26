# SEO draft pipeline for play.kubeai.info

Drafts one queued keyword per run with Grok, lints it against the brand
rules, renders `guides/<slug>/index.html` in the site's own page template,
and opens a review PR. Netlify attaches a deploy preview to every PR.

## The two gates (never bypassed by automation)

1. **Merge gate.** Nothing publishes until the draft PR is reviewed and
   merged on Yacine's explicit go-ahead. The workflow has no merge code at
   all; merging the PR is the publish action.
2. **Run gate.** No scheduled run does anything until the repo variable
   `AUTOMATION_ENABLED` is set to `true` (Settings > Secrets and variables
   > Actions > Variables). The workflow checks it and the script
   re-checks it.

## Setup (one time, founder)

1. Add secret `GEMINI_API_KEY` (Settings > Secrets and variables > Actions
   > Secrets) using the Google AI Studio key.
2. Create variable `AUTOMATION_ENABLED` and leave it set to anything other
   than `true` until launch. Flipping it to `true` is Yacine's switch.

## Limits

- **Weekly draft cap: 3.** Cron runs Mon/Wed/Fri (08:17 UTC) and the
  script additionally counts open draft PRs labelled `pipeline-draft`
  created in the last 7 days; at 3 it skips. Manual re-runs cannot exceed
  the cap.
- **Model spend ceiling: $10/month.** Enforced by charging a conservative
  `RUN_COST_ESTIMATE_USD` (currently $0.05, deliberately generous; a flash
  draft is far cheaper) against `SPEND_CAP_USD` ($10) using the month's
  workflow-run count. True the estimate up after the first real bill. The
  actual token usage of every draft is printed in its PR body.
- **Model pin: `gemini-3.8-flash`.** Hard-coded; `MODEL_ID` may not differ
  unless `MODEL_PIN_OVERRIDE=1` is set in the workflow after review.

## Quality checks enforced by scripts/generate_draft.py

- no prices or currency amounts anywhere
- no "free" in the title
- no guarantee wording (guarantee/money-back/risk-free)
- no employment-agency or staffing-agency framing
- no duplicate guide (slug must not exist; no open PR for the keyword)
- body carries the `quotes@kubeai.info` contact pointer
- AI-assistance byline and "Publisher: Yacine Zairi" line
- corrections link (`corrections@kubeai.info`)
- any image must carry an AI-generated label
- 800-1,800 words; one lint retry, then the run fails without a PR

The rules mirror the Distribb brand guide (uploaded there as
`stage-distribb-brand-guide.md`); if the guide changes, update the lint
lists in `scripts/generate_draft.py` in the same change.

## Queue

`scripts/queue.json` mirrors the Drive sheet "Content queue -
play.kubeai.info" (SEO subfolder). Rows move to the repo when they are
queued for drafting; keep the two in step. The script drafts in date
order, one per run.

## Daily site baseline check

`.github/workflows/daily-check.yml` reads the agent-facing endpoints on
both hosts and opens ONE issue when something is off baseline:

- play.kubeai.info: `/`, `/.well-known/agent-card.json`, `/a2a`,
  `/availability.json`, `/llms.txt` -> 200
- assurance.kubeai.info: `/`, `/.well-known/agent-card.json`,
  `/llms.txt` -> 200; **`/a2a` -> 404 is the expected baseline** (no /a2a
  endpoint exists there by design, settled in PR #8 on agent-assurance);
  it only alerts if it starts returning something else.

## Review flow

Every draft PR is a review copy for Yacine: keyword, Distribb ID, word
count, lint result and model usage in the body, Netlify preview on the
PR. On his go-ahead the PR is merged, which publishes. Nothing else on
this repo publishes anything.
guides: drafts open pull requests against `master` (the site default branch); merging one publishes.
