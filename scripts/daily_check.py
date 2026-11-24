#!/usr/bin/env python3
"""Daily baseline check for the two KubeAI agent-facing hosts.

Reads the endpoints the A2A automation pack lists and opens ONE GitHub
issue if anything sits off its baseline. assurance.kubeai.info/a2a
returning 404 is the EXPECTED baseline (no /a2a endpoint exists there by
design, settled in PR #8 on saidi-art/agent-assurance); alert only if it
starts returning something else.
"""

import json
import os
import sys
import urllib.error
import urllib.request

REPO = os.environ.get("GITHUB_REPOSITORY", "saidi-art/12-play-testers")
EXPECTED = {
    "https://play.kubeai.info/": 200,
    "https://play.kubeai.info/.well-known/agent-card.json": 200,
    "https://play.kubeai.info/a2a": 200,
    "https://play.kubeai.info/availability.json": 200,
    "https://play.kubeai.info/llms.txt": 200,
    "https://assurance.kubeai.info/": 200,
    "https://assurance.kubeai.info/.well-known/agent-card.json": 200,
    # 404 is the baseline here by design (PR #8); anything else is breakage.
    "https://assurance.kubeai.info/a2a": 404,
    "https://assurance.kubeai.info/llms.txt": 200,
}
TITLE = "Site check: an endpoint is off its expected baseline"


def status(url):
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "kubeai-daily-check/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return -1


def gh(path, token, method="GET", body=None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode() or "{}")


def main():
    breakages = []
    for url, want in EXPECTED.items():
        got = status(url)
        mark = "ok" if got == want else "OFF BASELINE"
        print(f"{got:>4} (want {want}) {mark}: {url}")
        if got != want:
            breakages.append(f"- `{url}` returned **{got}** (expected {want})")

    if not breakages:
        print("All endpoints on baseline.")
        sys.exit(0)

    token = os.environ.get("GITHUB_TOKEN")
    body = (
        "The daily baseline check found endpoints off their expected state.\n\n"
        + "\n".join(breakages)
        + "\n\nReminder: `assurance.kubeai.info/a2a` returning **404** is the "
        "expected baseline (no /a2a endpoint exists there by design). It only "
        "alerts when it returns something else.\n"
        "_This issue is opened at most once per breakage day; check for a "
        "newer one before debugging._")
    if token:
        open_issues = gh(
            f"/repos/{REPO}/issues?state=open&per_page=100", token)
        existing = [i for i in open_issues if i.get("title") == TITLE
                    and "pull_request" not in i]
        if existing:
            print(f"::notice::open issue #{existing[0]['number']} already "
                  "tracks this; not duplicating.")
        else:
            issue = gh("/repos/" + REPO + "/issues", token, "POST",
                       {"title": TITLE, "body": body})
            print(f"::notice::opened issue #{issue['number']}.")
    else:
        print("::error::breakage but no GITHUB_TOKEN: " + "; ".join(breakages))
        sys.exit(1)


if __name__ == "__main__":
    main()
