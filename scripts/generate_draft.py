#!/usr/bin/env python3
"""KubeAI SEO draft pipeline for play.kubeai.info (12-play-testers repo).

One run drafts ONE queued keyword with Gemini, lints it against the brand
rules, renders guides/<slug>/index.html and opens a review PR. It never
merges and never pushes to master. Nothing publishes until the founder
reviews the PR and gives the merge go-ahead (gate 1), and no scheduled run
happens at all until AUTOMATION_ENABLED=true (gate 2).
"""

import datetime as dt
import html as html_mod
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = os.environ.get("GITHUB_REPOSITORY", "saidi-art/12-play-testers")
PINNED_MODEL = "gemini-3.8-flash"
MODEL_ID = os.environ.get("MODEL_ID", PINNED_MODEL)
MODEL_PIN_OVERRIDE = os.environ.get("MODEL_PIN_OVERRIDE") == "1"
WEEKLY_LIMIT = int(os.environ.get("WEEKLY_DRAFT_LIMIT", "3"))
SPEND_CAP_USD = float(os.environ.get("SPEND_CAP_USD", "10"))
RUN_COST_ESTIMATE_USD = float(os.environ.get("RUN_COST_ESTIMATE_USD", "0.05"))
MIN_WORDS = int(os.environ.get("MIN_WORDS", "800"))
MAX_WORDS = int(os.environ.get("MAX_WORDS", "1800"))
ROOT = Path(__file__).resolve().parent.parent
GUIDES = ROOT / "guides"
QUEUE_FILE = ROOT / "scripts" / "queue.json"
PR_LABEL = "pipeline-draft"
CONTACT = "quotes@kubeai.info"
CORRECTIONS = "corrections@kubeai.info"
BYLINE = ("Draft prepared with AI assistance (Gemini). Every guide is reviewed "
          "by the KubeAI team before publishing.")
PUBLISHER = "Publisher: Yacine Zairi"

BANNED = re.compile(
    r"guarantee|money[- ]back|risk[- ]free|employment agency|staffing agency"
    r"|hiring agency|we (are|'re) an agency", re.I)
PRICE = re.compile(r"[$\u20ac\u00a3]\s?\d|\b\d+\s?(?:usd|eur|gbp)\b", re.I)


def die(msg):
    print(f"::error::{msg}")
    sys.exit(1)


def skip(msg):
    print(f"::notice::{msg}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"skipped={msg}\n")
    sys.exit(0)


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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"GitHub API {method} {path} -> {e.code}: {e.read().decode()[:400]}")


def open_draft_prs(token):
    prs = gh(f"/repos/{REPO}/pulls?state=open&per_page=100", token)
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)
    recent = 0
    for pr in prs:
        labels = {l["name"] for l in pr.get("labels", [])}
        created = dt.datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
        if PR_LABEL in labels and created >= cutoff:
            recent += 1
    return recent, [p["title"] for p in prs]


def runs_this_month(token):
    month_start = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-01")
    q = urllib.parse.quote(f">{month_start}", safe="")
    data = gh(
        f"/repos/{REPO}/actions/workflows/draft-weekly.yml/runs?per_page=1&created={q}",
        token)
    return data.get("total_count", 0)


def call_gemini(prompt):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        die("GEMINI_API_KEY secret is not set. Add it in Settings > Secrets and "
            "variables > Actions, then re-run.")
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{MODEL_ID}:generateContent")
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": 8192}}
    req = urllib.request.Request(
        url, method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        data=json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        die(f"Gemini API returned {e.code}: {e.read().decode()[:300]}")
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    usage = data.get("usageMetadata", {})
    return text.strip(), usage


def slugify(keyword):
    return re.sub(r"[^a-z0-9]+", "-", keyword.lower()).strip("-")


def build_prompt(item, extra=""):
    briefs = {
        "Listicle": ("A numbered-listicle guide: 5-7 clearly grouped sections, "
                     "each with a short H2 heading and 2-4 paragraphs or a "
                     "short bullet list."),
        "How-To": ("A step-by-step how-to: numbered steps with concrete Play "
                   "Console actions, plus a short troubleshooting section."),
        "Explainer": ("An explainer: what the thing is, why it matters for new "
                      "personal Play developer accounts, and the misconceptions "
                      "to clear up."),
        "Resources": ("A resources roundup: the official Google documentation "
                      "and tools that matter here, grouped, with a sentence or "
                      "two on when each one helps."),
    }
    return (
        'Write a complete SEO guide article for the blog of play.kubeai.info '
        '("12 Play Testers", a KubeAI service).\n'
        f'Target keyword: "{item["keyword"]}"\n'
        f"Format: {briefs[item['style']]}\n"
        "Audience: solo Android developers on new Google Play personal "
        "developer accounts who must run the required closed test (12 opted-in "
        "testers, 14 consecutive days) before applying for production access. "
        "English, plain, concrete, helpful. No fluff, no invented statistics, "
        "no quotes from named people.\n"
        f"Length: {MIN_WORDS}-{MAX_WORDS} words.\n"
        'Start with an H1 title ("# ...") containing the target keyword or a '
        'close natural variant. The title must NOT contain the word "free".\n'
        "Then H2 sections; short bullet lists where useful.\n"
        "Hard content rules:\n"
        "- Never mention prices, fees, discounts or currency amounts for any "
        "service, ours or competitors'.\n"
        '- Never promise guarantees ("guarantee(d)", "money-back", '
        '"risk-free").\n'
        "- Do not describe the service as an employment or staffing agency; it "
        "is a managed closed-testing service.\n"
        "- It is fine to mention 12 Play Testers once and end with a short "
        "paragraph pointing readers to the contact page "
        "(https://play.kubeai.info/contact/) and the email " + CONTACT +
        " for a quote. Nothing after that paragraph.\n"
        "- Output ONLY the markdown article, nothing else, no code fences.\n"
        + extra)


def lint(title, body, slug):
    problems = []
    words = len(re.findall(r"\S+", body))
    if words < MIN_WORDS or words > MAX_WORDS:
        problems.append(f"word count {words} outside {MIN_WORDS}-{MAX_WORDS}")
    if re.search(r"\bfree\b", title, re.I):
        problems.append('title contains "free"')
    m = PRICE.search(body)
    if m:
        problems.append(f"price-like text found: {m.group(0)!r}")
    m = BANNED.search(body)
    if m:
        problems.append(f"banned wording: {m.group(0)!r}")
    if CONTACT not in body:
        problems.append(f"missing contact {CONTACT}")
    if CORRECTIONS not in body:
        problems.append(f"missing corrections link {CORRECTIONS}")
    if "AI-assisted" not in body or PUBLISHER not in body:
        problems.append("missing AI byline / publisher line")
    for im in re.finditer(r"<img[^>]*>", body):
        if "ai-generated" not in im.group(0).lower():
            problems.append("image without an AI-generated label")
    if (GUIDES / slug / "index.html").exists():
        problems.append(f"guides/{slug}/ already exists (duplicate)")
    return problems, words


def inline(t):
    t = html_mod.escape(t, quote=True)
    t = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", t)
    return t


def md_to_html(md):
    out, in_list = [], False
    for line in md.splitlines():
        s = line.rstrip()
        if not s.strip():
            if in_list:
                out.append("</ul>")
                in_list = False
            continue
        if s.startswith("### "):
            out.append(f"<h3>{inline(s[4:])}</h3>")
        elif s.startswith("## "):
            out.append(f"<h2>{inline(s[3:])}</h2>")
        elif s.startswith("# "):
            out.append(f"<h1>{inline(s[2:])}</h1>")
        elif s.startswith("- ") or s.startswith("* "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(s[2:])}</li>")
        elif s.strip() == "---":
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append("<hr>")
        else:
            if in_list:
                out.append("</ul>")
                in_list = False
            out.append(f"<p>{inline(s)}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ — 12 Play Testers</title>
<meta name="description" content="__DESC__">
<link rel="stylesheet" href="/styles.css">
<link rel="canonical" href="https://play.kubeai.info/guides/__SLUG__/">
<meta property="og:type" content="article">
<meta property="og:site_name" content="12 Play Testers">
<meta property="og:title" content="__TITLE__">
<meta property="og:description" content="__DESC__">
<meta property="og:url" content="https://play.kubeai.info/guides/__SLUG__/">
<meta name="twitter:card" content="summary">
<style>
.prose{max-width:720px;padding-bottom:80px}
.prose h1{font-size:clamp(32px,4.6vw,46px);font-weight:800;letter-spacing:-.025em;line-height:1.08;margin:44px 0 14px}
.prose h2{font-size:22px;letter-spacing:-.01em;margin:34px 0 8px}
.prose p{color:var(--slate);margin:0 0 12px}
.prose ul{margin:10px 0 16px;padding-left:20px}
.prose li{color:var(--slate);margin:6px 0}
.prose a{color:var(--done);text-decoration:underline}
.prose hr{border:0;border-top:1px solid var(--line,#e5e5e5);margin:28px 0}
</style>
<script type="application/ld+json">
__JSONLD__
</script>
</head>
<body>
<header class="wrap">
  <div class="top">
    <a class="brand" href="/">12 Play Testers</a>
    <nav aria-label="Sections">
      <a href="/#how">How it works</a>
      <a href="/#faq">FAQ</a>
      <a href="/contact/">Contact</a>
    </nav>
    <a class="btn btn-dark btn-sm" href="/#contact">Get in touch</a>
  </div>
</header>

<main class="wrap">
  <div class="prose">
__BODY__
  </div>
</main>

<footer>
  <div class="wrap">12 Play Testers, a KubeAI service &middot; <a href="mailto:quotes@kubeai.info">quotes@kubeai.info</a> &middot; <a href="https://kubeai.info">kubeai.info</a> &middot; <a href="https://www.youtube.com/@KubeAI">YouTube @KubeAI</a> &middot; <a href="/about/">About</a> &middot; <a href="/contact/">Contact</a> &middot; <a href="/privacy/">Privacy</a></div>
</footer>
</body>
</html>
"""


def render_page(slug, title, body_html, description):
    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "url": f"https://play.kubeai.info/guides/{slug}/",
        "author": {"@type": "Organization", "name": "KubeAI",
                   "url": "https://kubeai.info"},
        "publisher": {"@type": "Person", "name": "Yacine Zairi"},
    })
    return (PAGE_TEMPLATE
            .replace("__TITLE__", html_mod.escape(title, quote=True))
            .replace("__DESC__", html_mod.escape(description, quote=True))
            .replace("__SLUG__", slug)
            .replace("__JSONLD__", jsonld)
            .replace("__BODY__", body_html))


def boilerplate():
    return (
        f"---\n\n*{BYLINE}*\n\n{PUBLISHER}\n\n"
        f"Questions or a quote? [{CONTACT}](mailto:{CONTACT}) or the "
        f"[contact page](/contact/).\n\n"
        f"Spotted an error? [{CORRECTIONS}](mailto:{CORRECTIONS}).\n")


def create_branch_and_pr(token, branch, path, content, commit_msg, pr_title,
                         pr_body):
    base = gh(f"/repos/{REPO}/git/ref/heads/master", token)
    base_sha = base["object"]["sha"]
    blob = gh("/repos/" + REPO + "/git/blobs", token, "POST",
              {"content": content, "encoding": "utf-8"})
    commit = gh(f"/repos/{REPO}/git/commits/{base_sha}", token)
    tree = gh("/repos/" + REPO + "/git/trees", token, "POST", {
        "base_tree": commit["tree"]["sha"],
        "tree": [{"path": path, "mode": "100644", "type": "blob",
                  "sha": blob["sha"]}]})
    new_commit = gh("/repos/" + REPO + "/git/commits", token, "POST", {
        "message": commit_msg, "tree": tree["sha"], "parents": [base_sha]})
    gh("/repos/" + REPO + "/git/refs", token, "POST", {
        "ref": f"refs/heads/{branch}", "sha": new_commit["sha"]})
    pr = gh("/repos/" + REPO + "/pulls", token, "POST", {
        "title": pr_title, "head": branch, "base": "master", "body": pr_body,
        "maintainer_can_modify": True})
    try:
        gh(f"/repos/{REPO}/issues/{pr['number']}/labels", token, "POST",
           {"labels": [PR_LABEL]})
    except RuntimeError:
        try:
            gh("/repos/" + REPO + "/labels", token, "POST",
               {"name": PR_LABEL, "color": "1A7F50"})
            gh(f"/repos/{REPO}/issues/{pr['number']}/labels", token, "POST",
               {"labels": [PR_LABEL]})
        except RuntimeError:
            print("::warning::could not attach label " + PR_LABEL)
    return pr


def main():
    if MODEL_ID != PINNED_MODEL and not MODEL_PIN_OVERRIDE:
        die(f'Model pin violated: MODEL_ID="{MODEL_ID}" but the pin is '
            f'"{PINNED_MODEL}". A switch is a deliberate change: set '
            "MODEL_PIN_OVERRIDE=1 in the workflow after review.")
    if os.environ.get("AUTOMATION_ENABLED") != "true":
        skip("AUTOMATION_ENABLED is not true; pipeline stays off (gate 2).")
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        die("GITHUB_TOKEN missing.")

    week_prs, open_titles = open_draft_prs(token)
    if week_prs >= WEEKLY_LIMIT:
        skip(f"weekly draft limit reached ({week_prs} open draft PRs in the "
             f"last 7 days, limit {WEEKLY_LIMIT}).")
    est = runs_this_month(token) * RUN_COST_ESTIMATE_USD
    if est >= SPEND_CAP_USD:
        skip(f"monthly Gemini spend ceiling reached ({runs_this_month(token)} "
             f"runs x ${RUN_COST_ESTIMATE_USD:.2f} estimate = ${est:.2f} of "
             f"${SPEND_CAP_USD:.2f} cap).")

    if not QUEUE_FILE.exists():
        die("scripts/queue.json is missing.")
    queue = json.loads(QUEUE_FILE.read_text())
    queue.sort(key=lambda x: x["date"])
    item = None
    slug = None
    for cand in queue:
        s = slugify(cand["keyword"])
        if any(cand["keyword"].lower() in t.lower() for t in open_titles):
            continue
        if (GUIDES / s).exists():
            continue
        item, slug = cand, s
        break
    if item is None:
        skip("queue is empty: every keyword is drafted or published.")

    usage_log = []
    draft, usage = call_gemini(build_prompt(item))
    m = re.search(r"^#\s+(.+)$", draft, re.M)
    if not m:
        die("draft has no H1 title.")
    title = m.group(1).strip()
    body = draft[m.end():].strip() + "\n\n" + boilerplate()
    problems, words = lint(title, body, slug)
    if problems:
        retry, _ = call_gemini(build_prompt(
            item, "Your previous attempt broke these rules: "
            + "; ".join(problems) + ". Rewrite the full article obeying them."))
        m = re.search(r"^#\s+(.+)$", retry, re.M)
        if not m:
            die("retry draft has no H1 title.")
        title = m.group(1).strip()
        body = retry[m.end():].strip() + "\n\n" + boilerplate()
        problems, words = lint(title, body, slug)
        if problems:
            die("draft failed the brand lint after one retry: "
                + "; ".join(problems))

    body_html = md_to_html(body)
    paras = re.findall(r"<p>(.*?)</p>", body_html, re.S)
    description = re.sub(r"<[^>]+>", "", paras[0])[:155] if paras else title
    page = render_page(slug, title, body_html, description)

    out = Path("guides") / slug / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page)

    branch = f"draft/{slug}"
    est_cost = RUN_COST_ESTIMATE_USD
    pr_body = (
        "Automated draft from the SEO queue (groundwork pipeline; this PR is "
        "a review copy only).\n\n"
        f"- Keyword: **{item['keyword']}**\n"
        f"- Distribb ID: {item['distribb_id']} (queue date {item['date']})\n"
        f"- Style: {item['style']}\n"
        f"- Words: {words} (allowed {MIN_WORDS}-{MAX_WORDS})\n"
        f"- Model: `{MODEL_ID}` (pinned) \u00b7 Gemini usage: "
        f"{usage.get('promptTokenCount', '?')} in / "
        f"{usage.get('candidatesTokenCount', '?')} out tokens "
        f"(\u2248${est_cost:.2f} conservative charge against the monthly cap)\n"
        f"- Brand lint: passed (no prices, no \u201cfree\u201d in title, no "
        f"guarantee/agency wording, {CONTACT} present, AI byline + publisher "
        "line, corrections link)\n\n"
        "**Review copy for Yacine only.** Merging this PR publishes the guide "
        "to play.kubeai.info. Nothing here merges automatically; Netlify "
        "shows a deploy preview on this PR. Do not dispatch "
        "onboarding packets or touch the live hub from this repo.")

    pr = create_branch_and_pr(
        token, branch, str(out.relative_to(ROOT)), page,
        f"Draft guide: {item['keyword']}", f"Draft guide: {item['keyword']}",
        pr_body)
    print(f"::notice::draft PR #{pr['number']} opened for {slug} "
          f"({words} words).")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"pr_number={pr['number']}\nslug={slug}\n")


if __name__ == "__main__":
    main()
