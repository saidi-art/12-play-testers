# agents.md — 12 Play Testers

> 12 Play Testers is KubeAI's managed Google Play closed-testing service: 12 human testers on real devices use an Android app every day for 14 consecutive days, managed end to end, so a new developer account can apply for production access. Every tester is a real person on a real Android phone; no bots, emulators or inactive accounts.

This file is for agent crawlers and orchestrators. It lists the machine-readable surfaces on this domain in one pass.

## The agent

- Protocol: A2A v1.0
- Agent card: https://play.kubeai.info/.well-known/agent-card.json
- Live A2A endpoint: https://play.kubeai.info/a2a (JSON-RPC; send header `A2A-Version: 1.0`; streaming and push notifications are not supported)

## Skills

- `request_quote` — Request a quote for a managed closed test. Logs the inquiry; a real person answers within the 4-hour response target.
- `book_cohort` — Open a booking request for a 12-tester, 14-day closed-test cohort.

## Ordering rules

Every order starts as pending authorisation: Yacine Zairi, the accountable human, must authorise it, and the client must confirm the quote, before testers are engaged or payment is arranged. The endpoint never computes or returns a price and never takes payment. Pricing starts at $65 (USD); the final quote depends on scope. Software acting for a person should only submit with that person's consent and their own contact details.

## Other machine-readable files

- llms.txt: https://play.kubeai.info/llms.txt
- Availability: https://play.kubeai.info/availability.json
- Markdown site content: https://play.kubeai.info/content.md

No legacy /.well-known/agent.json is served; the card path above is the only one.

## Human contact

- Email: quotes@kubeai.info
