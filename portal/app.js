// Client portal static shell: hash router + nine phone states, rendered from mock JSON.
// No demo controls ship (spec 04): day and tester states come only from the data.
import { loadPortal, sendMessage, savePrefs } from './data.js';
import {
  esc, icon, logoDots, dots, dayCounter, tag, stamp, tick, wall, appHeader, tabBar,
  toggle, bubble, polaroid, stickyNote, emptyActivity, emptyMessages,
} from './components.js';

const root = document.getElementById('app');
let data = null;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const d = (iso) => new Date(iso + 'T12:00:00Z');
const dayMonth = (iso) => `${d(iso).getUTCDate()} ${MONTHS[d(iso).getUTCMonth()]}`;
const fullDate = (iso) => `${DAYS[d(iso).getUTCDay()]} ${dayMonth(iso)}`;
const ROT = [-3, 2, -1.5, 2.5, -2, 1.5];

function screen(inner, { scroll = false } = {}) {
  return `<div class="felt scr${scroll ? ' scroll' : ''}">${inner}</div>`;
}

/* ---------- Onboarding 1: magic-link sign-in ---------- */
function signIn() {
  return screen(`
    <div class="brandrow">${logoDots()}<span>12 Play Testers</span></div>
    <main class="signin" id="main">
      <h1 tabindex="-1">Follow your run</h1>
      <p class="lede muted">Enter the email you booked with. We’ll send a sign-in link. No password.</p>
      <form class="paper" id="signin" novalidate>
        <label for="email">Email</label>
        <input class="field" id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
        <button class="btn btn-p btn-block" type="submit">Email me a sign-in link</button>
        <p id="signin-status" role="status" class="slate" style="font-size:13px;margin:10px 2px 0" hidden></p>
      </form>
      <p class="after muted">Then check your inbox. The link signs you in on this device and works once.</p>
    </main>
    <p class="foot muted">Only you can see your run.</p>`);
}

/* ---------- Onboarding 2: welcome, day 0 ---------- */
function welcome(run, testers) {
  const opted = testers.filter((t) => t.status === 'opted_in').length;
  return screen(`
    <main id="main" style="display:flex;flex-direction:column;flex:1;min-height:0">
      <header class="welcome">
        <p class="hi muted">Welcome, ${esc(run.client)}</p>
        <h1 tabindex="-1">Your run starts ${esc(fullDate(run.startDate))}</h1>
        <p class="muted">Your 12 testers are joining ${esc(run.app)}’s closed test now. Day 1 begins once all 12 have opted in. Nothing for you to fill in.</p>
      </header>
      ${wall(testers, 'Tester seats')}
      <p class="count"><b>${opted} of 12</b> testers have opted in</p>
      <div class="actions">
        <a class="btn btn-p btn-block" href="#settings">Turn on notifications</a>
        <a class="btn btn-s btn-block" href="#run">Go to my run</a>
      </div>
      <p class="note muted">On iPhone: Share, then Add to Home Screen, to get notifications.</p>
    </main>`);
}

/* ---------- Run overview (home): filling, in progress, restarted ---------- */
function home(run, testers) {
  const filling = run.state === 'filling';
  const restart = run.state === 'restarted' && run.restart?.posted ? run.restart : null;
  let status;
  if (restart) {
    status = `<section class="paper banner" aria-labelledby="rs-h">
      ${tag('Restart', 'o')}
      <h2 id="rs-h">Day ${run.day} of 14</h2>
      <h3>The streak restarted on ${esc(dayMonth(restart.date))}</h3>
      <p class="slate">${esc(restart.left)} stopped opting in. ${esc(restart.joined)} joined the same day, and the 14 days started again for all 12. There’s no extra cost to you.</p>
      <a class="link link-g" href="#messages">Ask us about it</a>
    </section>`;
  } else {
    const opted = testers.filter((t) => t.status !== 'joining').length;
    const missed = testers.filter((t) => t.status === 'missed' || t.streak?.[run.day - 1] === 'miss').length;
    const line = filling
      ? `<span class="dot" aria-hidden="true"></span>${opted} of 12 opted in · starts ${esc(dayMonth(run.startDate))}`
      : missed
        ? `<span class="dot alert" aria-hidden="true"></span>${missed} ${missed === 1 ? 'tester' : 'testers'} missed today`
        : `<span class="dot" aria-hidden="true"></span>All 12 testers active today`;
    status = `<section class="status">${dayCounter(run.day, 'day')}<div>
      <h1 class="bigday" tabindex="-1">Day ${run.day} of 14</h1>
      <div class="today">${line}</div>
      <div class="muted updated">Last update ${esc(run.lastUpdate)}</div></div></section>`;
  }
  return screen(`
    ${appHeader(run, 'Closed test run')}
    <main id="main" style="display:flex;flex-direction:column;flex:1;min-height:0">
      ${restart ? '<h1 class="sr" tabindex="-1">Your run</h1>' : ''}${status}
      ${wall(testers)}
    </main>
    ${tabBar('run', data.unread)}`);
}

/* ---------- Requirement met ---------- */
function met(run) {
  return screen(`
    ${appHeader(run, 'Closed test run')}
    <main id="main" class="body">
      <section class="paper met" aria-labelledby="met-h">
        <h1 id="met-h" class="sr" tabindex="-1">Requirement met</h1>
        <h2>Day 14 of 14</h2>
        <ul class="checks"><li>${tick()}12 testers opted in</li><li>${tick()}14 days in a row</li></ul>
        <div style="margin-top:14px">${dots(Array(14).fill('on'), 14, '14 of 14 days, all green')}</div>
        ${stamp()}
      </section>
      <section class="paper next">
        <div class="k slate">Your next step</div>
        <h3>Apply for production in Play Console</h3>
        <p class="slate">The application is now open to you. Google reviews it, usually within 7 days. We stay in the thread until then.</p>
        <!-- TODO: link to the production-access guide on play.kubeai.info once it is live; Messages until then (approved for checkpoint 1). -->
        <a class="btn btn-p btn-block" href="#messages" style="margin-top:14px">How to apply, step by step</a>
      </section>
    </main>
    ${tabBar('run', data.unread)}`);
}

/* ---------- Closed ---------- */
function closed(run, testers) {
  const grid = testers.map((t) => dots(t.streak, 14, `${t.name}: ${t.days} of 14 days`)).join('');
  return screen(`
    ${appHeader(run, `Run complete, ${dayMonth(run.closedOn)}`, { bell: false })}
    <main id="main" class="closed">
      <div class="paper grid14" role="group" aria-label="All 12 testers across 14 days">${grid}</div>
      <h1 tabindex="-1">Thank you</h1>
      <p class="muted">Your run is closed. Everything stays here to read: the 14 days, the screenshots and our messages.</p>
    </main>
    <div class="actions" style="padding-bottom:6px">
      <a class="btn btn-s btn-block" href="#activity">Look back at the activity</a>
      <a class="btn btn-s btn-block" href="#messages">Read the thread (archived)</a>
      <a class="btn btn-g" href="/#contact" style="align-self:center">Another app to test? Get in touch</a>
    </div>
    <div style="height:14px"></div>`);
}

/* ---------- Activity feed ---------- */
function activity(run, items) {
  const body = items.length
    ? items.map((day, i) => `
      <section aria-labelledby="ad-${i}" style="display:flex;flex-direction:column;gap:14px">
        <div class="dayhead"><h2 id="ad-${i}">${esc(day.label || `Day ${day.day}`)}</h2><span class="muted">${day.checkedIn} of 12 checked in</span></div>
        <div class="paper shots">
          <div class="lbl">Daily screenshots</div>
          <ul class="shotgrid" data-shots="${i}">${day.screenshots.slice(0, 6).map((s, j) => polaroid(s, ROT[j % 6])).join('')}</ul>
          ${day.screenshots.length > 6 ? `<button type="button" class="link link-g" style="font-size:13px;text-decoration:none" data-more="${i}">See all ${day.screenshots.length}</button>` : ''}
        </div>
        ${day.notes.map((n, j) => stickyNote(n, j % 2 ? 0.8 : -1)).join('')}
      </section>`).join('')
    : emptyActivity();
  return screen(`
    <header class="pagehdr"><h1 tabindex="-1">Activity</h1><p class="muted">Screenshots and tester notes, newest first</p></header>
    <main id="main" class="body scrolly">${body}</main>
    ${tabBar('activity', data.unread)}`);
}

/* ---------- Messages ---------- */
function messages(run, msgs) {
  const archived = run.state === 'closed';
  let last = null;
  const thread = msgs.map((m) => {
    const sep = m.day !== last ? `<div class="daysep muted">${m.day === run.day && !archived ? 'Today' : `Day ${m.day}`}</div>` : '';
    last = m.day;
    return sep + bubble(m);
  }).join('');
  return screen(`
    <header class="pagehdr" style="padding-bottom:8px"><h1 tabindex="-1">Messages</h1><p class="muted">${archived ? 'The thread for this run, archived.' : 'One thread for this run. We reply the same day.'}</p></header>
    <main id="main" style="flex:1;min-height:0;display:flex;flex-direction:column">
      ${msgs.length ? `<div class="thread" id="thread" role="log" aria-label="Message thread">${thread}</div>` : `<div class="body">${emptyMessages()}</div>`}
      ${archived
        ? '<p class="archived muted">This run is closed. The thread stays here to read.</p>'
        : `<form class="composer" id="composer">
            <input type="file" id="file" class="sr" tabindex="-1" aria-hidden="true">
            <button type="button" class="paper ibtn" id="attach" aria-label="Attach a file">${icon('attach')}</button>
            <label for="msg" class="sr">Message</label>
            <input id="msg" class="field" autocomplete="off" placeholder="Write a message" style="flex:1;border-radius:14px">
            <button type="submit" class="btn btn-p" style="min-height:50px;padding:0 16px">Send</button>
          </form>`}
    </main>
    ${tabBar('messages', 0)}`);
}

/* ---------- Notification settings ---------- */
function settings(run, prefs) {
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  const opts = (sel) => hours.map((h) => `<option${h === sel ? ' selected' : ''}>${h}</option>`).join('');
  return screen(`
    <header class="backhdr"><a class="ibtn bare" href="#run" aria-label="Back to your run">${icon('back')}</a><h1 tabindex="-1">Notifications</h1></header>
    <main id="main" class="body scrolly" style="gap:12px;padding-top:6px">
      <div class="paper">
        ${toggle('push', 'Push notifications', 'Milestones and messages from us', prefs.push)}
        <div class="rule"></div>
        ${toggle('digest', 'Daily email digest', 'One email a day with the run’s status', prefs.digest)}
      </div>
      <fieldset class="paper" style="padding:16px;border:0;margin:0">
        <legend class="sr">Quiet hours</legend>
        <div style="font-weight:700;font-size:16px" aria-hidden="true">Quiet hours</div>
        <div class="slate" style="font-size:13px;margin-top:2px">No push notifications between these times</div>
        <div class="qh">
          <label class="slate">From<select class="field" id="qfrom">${opts(prefs.quietFrom)}</select></label>
          <label class="slate">To<select class="field" id="qto">${opts(prefs.quietTo)}</select></label>
        </div>
      </fieldset>
      <p class="muted" style="margin:6px 4px 0;font-size:13px;line-height:1.5">On iPhone, add the portal to your home screen first: Safari only sends web notifications to apps added there.</p>
      <p class="muted" style="margin:14px 4px 0;font-size:13px">Signed in as ${esc(run.clientEmail)}</p>
      <a href="#signin" class="link" style="align-self:flex-start;margin-left:4px;font-size:15px;color:#fff">Sign out</a>
    </main>`);
}

/* ---------- Error ---------- */
function errorScreen() {
  return screen(`
    <div class="brandrow">${logoDots()}<span>12 Play Testers</span></div>
    <main id="main" class="paper err" role="alert">
      <h1 class="sr" tabindex="-1">Something went wrong</h1>
      <h2>We couldn’t load your run</h2>
      <p class="slate">Check your connection and try again. Still stuck? Email us and we’ll sort it.</p>
      <button type="button" class="btn btn-p btn-block" id="retry">Try again</button>
    </main>`);
}

/* ---------- Router ---------- */
const TITLES = { signin: 'Sign in', welcome: 'Welcome', run: 'Your run', activity: 'Activity', messages: 'Messages', settings: 'Notifications' };

function route() {
  const h = location.hash.slice(1);
  if (h) return h;
  return data?.run.state === 'filling' ? 'welcome' : 'run';
}

function render() {
  const r = route();
  let html;
  if (r === 'signin') html = signIn();
  else if (!data) html = errorScreen();
  else {
    const { run, testers } = data;
    if (r === 'welcome') html = welcome(run, testers);
    else if (r === 'activity') html = activity(run, data.activity);
    else if (r === 'messages') { data.unread = 0; html = messages(run, data.messages); }
    else if (r === 'settings') html = settings(run, data.prefs);
    else if (run.state === 'requirement_met') html = met(run);
    else if (run.state === 'closed') html = closed(run, testers);
    else html = home(run, testers);
  }
  root.innerHTML = html;
  document.title = `${TITLES[r] || 'Your run'} · 12 Play Testers`;
  wire();
  const h1 = root.querySelector('h1[tabindex]');
  if (h1 && document.body.dataset.ready) h1.focus({ preventScroll: true });
  document.body.dataset.ready = '1';
}

function wire() {
  const t = root.querySelector('#thread');
  if (t) t.scrollTop = t.scrollHeight;

  root.querySelector('#signin')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = root.querySelector('#signin-status');
    s.hidden = false;
    s.textContent = 'Review copy: sign-in isn’t connected yet, so no email was sent.';
  });

  root.querySelector('#retry')?.addEventListener('click', boot);

  root.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.more;
    root.querySelector(`[data-shots="${i}"]`).innerHTML = data.activity[i].screenshots.map((s, j) => polaroid(s, ROT[j % 6])).join('');
    b.remove();
  }));

  const f = root.querySelector('#composer');
  if (f) {
    const add = async (msg) => {
      await sendMessage(data, { day: data.run.day, ...msg });
      render();
      root.querySelector('#msg')?.focus();
    };
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = f.querySelector('#msg').value.trim();
      if (v) add({ from: 'client', type: 'text', text: v });
    });
    const file = f.querySelector('#file');
    f.querySelector('#attach').addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const fl = file.files[0];
      if (fl) add({ from: 'client', type: 'file', fileName: fl.name });
    });
  }

  const sp = (k, v) => savePrefs(data, { [k]: v });
  root.querySelector('#push')?.addEventListener('change', (e) => sp('push', e.target.checked));
  root.querySelector('#digest')?.addEventListener('change', (e) => sp('digest', e.target.checked));
  root.querySelector('#qfrom')?.addEventListener('change', (e) => sp('quietFrom', e.target.value));
  root.querySelector('#qto')?.addEventListener('change', (e) => sp('quietTo', e.target.value));
}

async function boot() {
  try { data = await loadPortal(); } catch (err) { console.error(err); data = null; }
  render();
}

window.addEventListener('hashchange', render);
boot();
