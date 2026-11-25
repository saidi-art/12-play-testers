// Desktop twins (artboards 10–17): same states as the phone screens, composed from the same components.
// The wall and status lead; Activity and Messages sit beside them.
import {
  esc, logoDots, dots, dayCounter, tag, stamp, tick, wall, toggle, bubble, polaroid, stickyNote,
  emptyActivity, emptyMessages, ROT, dayMonth, fullDate, counterVariant, todayLine, COPY,
} from './components.js';
import { WRITES } from './data.js';

let email = '';

const NAV = [['run', 'Run'], ['activity', 'Activity'], ['messages', 'Messages'], ['settings', 'Notifications']];

function topbar(run, current, unread, sub) {
  const links = NAV.map(([id, name]) => {
    const label = id === 'messages' && unread > 0 && current !== 'messages' ? `${name} (${unread})` : name;
    const sr = id === 'messages' && unread > 0 && current !== 'messages' ? `<span class="sr"> unread</span>` : '';
    return `<a class="dk-nav${current === id ? ' paper' : ''}" href="#${id}"${current === id ? ' aria-current="page"' : ''}>${label}${sr}</a>`;
  }).join('');
  return `<header class="dk-top"><div class="id"><span class="paper applogo">${logoDots()}</span><div><div class="appname">${esc(run.app)}</div><div class="muted appsub">${esc(sub)}</div></div></div><nav aria-label="Portal" class="dk-navs">${links}</nav></header>`;
}

const page = (run, current, unread, inner, sub = 'Closed test run') =>
  `<div class="felt dk">${topbar(run, current, unread, sub)}${inner}</div>`;

/* Sidebar cards */
function activityCard(items) {
  const day = items[0];
  if (!day) return `<section class="paper dk-card" aria-labelledby="dka-h"><div class="dk-cardhead"><h2 id="dka-h">Today’s activity</h2></div><p class="slate" style="margin-top:8px;font-size:14px;line-height:1.5">Screenshots start on day 1.</p></section>`;
  const note = day.notes[0] || items.find((d) => d.notes.length)?.notes[0];
  return `<section class="paper dk-card" aria-labelledby="dka-h">
    <div class="dk-cardhead"><h2 id="dka-h">Today’s activity</h2><a class="link link-g" href="#activity">See all</a></div>
    <ul class="shotgrid">${day.screenshots.slice(0, 6).map((s, j) => polaroid(s, ROT[j % 6])).join('')}</ul>
    ${note ? `<div style="margin-top:10px">${stickyNote(note, -1)}</div>` : ''}
  </section>`;
}

function messagesCard(msgs, { archived = false } = {}) {
  const last = msgs[msgs.length - 1];
  return `<section class="paper dk-card" aria-labelledby="dkm-h">
    <div class="dk-cardhead"><h2 id="dkm-h">Messages</h2><a class="link link-g" href="#messages">Open thread</a></div>
    ${last ? `<div class="dk-last" aria-label="Latest message">${bubble(last)}</div>` : `<p class="slate" style="margin-top:8px;font-size:14px">Say hello: questions about your run, a new build, anything.</p>`}
    ${archived ? '' : !WRITES ? `<p class="slate" style="margin-top:10px;font-size:13px;line-height:1.5">${esc(COPY.readonlyMessages)}</p>` : `<form class="dk-reply" id="composer">
      <label for="msg" class="sr">Reply</label>
      <input id="msg" class="field" autocomplete="off" placeholder="Reply">
      <button type="submit" class="btn btn-p">Send</button>
    </form>`}
  </section>`;
}

function statusCard(run, testers) {
  const tl = todayLine(run, testers);
  return `<section class="paper dk-card dk-status">${dayCounter(run.day, counterVariant(run))}<div><h2>Day ${run.day} of 14</h2><p class="slate">${esc(tl.text)}</p></div></section>`;
}

/* Run overview: in progress, restarted, seats filling (day 0 counter) */
function run(data) {
  const { run, testers } = data;
  const restart = run.state === 'restarted' && run.restart?.posted ? run.restart : null;
  let head;
  if (restart) {
    head = `<section class="paper dk-banner" aria-labelledby="dkr-h">
      <div class="dk-banner-day">${tag('Restart', 'o')}<p class="dk-bigday">Day ${run.day} of 14</p></div>
      <div class="dk-banner-txt"><h1 id="dkr-h" tabindex="-1">The streak restarted on ${esc(dayMonth(restart.date))}</h1>
      <p class="slate">${esc(restart.left)} stopped opting in. ${esc(restart.joined)} joined the same day, and the 14 days started again for all 12. There’s no extra cost to you.</p></div>
      <a class="btn btn-s dk-banner-btn" href="#messages">Ask us about it</a>
    </section>`;
  } else {
    const tl = todayLine(run, testers);
    head = `<section class="dk-statusrow">${dayCounter(run.day, 'day')}<div>
      <h1 class="dk-bigday" tabindex="-1">Day ${run.day} of 14</h1>
      <div class="today"><span class="dot${tl.alert ? ' alert' : ''}" aria-hidden="true"></span>${esc(tl.text)}</div>
      <div class="muted updated">Last update ${esc(run.lastUpdate)}</div></div></section>`;
  }
  return page(run, 'run', data.unread, `<div class="dk-cols">
    <main id="main" class="dk-main">${head}${wall(testers, 'Your 12 testers', { wide: true, cls: 'dk-wall' })}</main>
    <aside class="dk-side" aria-label="Activity and messages">${activityCard(data.activity)}${messagesCard(data.messages)}</aside>
  </div>`);
}

/* Onboarding 2: welcome, day 0 */
function welcome(data) {
  const { run, testers } = data;
  const opted = testers.filter((t) => t.status === 'opted_in').length;
  return page(run, 'run', data.unread, `<div class="dk-cols">
    <main id="main" class="dk-main">
      <p class="hi muted" style="font-size:14px;font-weight:700">Welcome, ${esc(run.client)}</p>
      <h1 class="dk-h1" tabindex="-1">Your run starts ${esc(fullDate(run.startDate))}</h1>
      <p class="muted dk-lede">Your 12 testers are joining ${esc(run.app)}’s closed test now. Day 1 begins once all 12 have opted in. Nothing for you to fill in.</p>
      ${wall(testers, 'Tester seats', { cls: 'dk-seats' })}
    </main>
    <aside class="dk-side"><section class="paper dk-card">
      <p class="dk-count"><b>${opted} of 12</b> testers have opted in</p>
      <a class="btn btn-p btn-block" href="#settings" style="margin-top:12px">Turn on notifications</a>
      <p class="slate" style="margin-top:12px;font-size:14px">We’ll tell you the moment day 1 starts.</p>
    </section></aside>
  </div>`);
}

/* Requirement met */
function met(data) {
  const { run, testers } = data;
  return page(run, 'run', data.unread, `<div class="dk-cols">
    <main id="main" class="dk-main">
      <section class="paper dk-met" aria-labelledby="dkmet-h">
        <h1 id="dkmet-h" class="sr" tabindex="-1">Requirement met</h1>
        <p class="dk-bigday">Day 14 of 14</p>
        <ul class="checks"><li>${tick()}12 testers opted in</li><li>${tick()}14 days in a row</li></ul>
        ${stamp()}
      </section>
      ${wall(testers, 'Your 12 testers', { wide: true, cls: 'dk-wall' })}
    </main>
    <aside class="dk-side">
      <section class="paper dk-card next">
        <div class="k slate">Your next step</div>
        <h2 class="dk-nexth">Apply for production in Play Console</h2>
        <p class="slate">The application is now open to you. Google reviews it, usually within 7 days. We stay in the thread until then.</p>
        <!-- TODO: link to the production-access guide on play.kubeai.info once it is live; Messages until then (approved for checkpoint 1). -->
        <a class="btn btn-p btn-block" href="#messages" style="margin-top:14px">How to apply, step by step</a>
      </section>
      ${messagesCard(data.messages)}
    </aside>
  </div>`);
}

/* Closed */
function closed(data) {
  const { run, testers } = data;
  return page(run, 'run', 0, `<main id="main" class="dk-closed">
    <div class="paper grid14" role="group" aria-label="All 12 testers across 14 days">${testers.map((t) => dots(t.streak, 14, `${t.name}: ${t.days} of 14 days`)).join('')}</div>
    <h1 tabindex="-1">Thank you</h1>
    <p class="muted">Your run is closed. Everything stays here to read: the 14 days, the screenshots and our messages.</p>
    <div class="dk-closed-btns"><a class="btn btn-s" href="#activity">Look back at the activity</a><a class="btn btn-s" href="#messages">Read the thread (archived)</a></div>
    <a class="btn btn-g" href="https://play.kubeai.info/#contact">Another app to test? Get in touch</a>
  </main>`, `Run complete, ${dayMonth(run.closedOn)}`);
}

/* Activity */
function activity(data) {
  const { run, activity: items } = data;
  const body = items.length
    ? items.map((day, i) => `<section aria-labelledby="dkad-${i}" class="dk-day">
        <div class="dayhead"><h2 id="dkad-${i}">${esc(day.label || `Day ${day.day}`)}</h2><span class="muted">${day.checkedIn} of 12 checked in</span></div>
        <div class="paper dk-strip"><ul class="shotgrid dk-shots">${day.screenshots.map((s, j) => polaroid(s, ROT[j % 6] / 2, { caption: true })).join('')}</ul></div>
        ${day.notes.map((n, j) => `<div class="dk-note">${stickyNote(n, j % 2 ? 0.4 : -0.4)}</div>`).join('')}
      </section>`).join('')
    : `<div class="dk-empty">${emptyActivity()}</div>`;
  return page(run, 'activity', data.unread, `<main id="main" class="dk-wide"><h1 class="dk-h1" tabindex="-1">Activity</h1>${body}</main>`,
    run.state === 'closed' ? `Run complete, ${dayMonth(run.closedOn)}` : 'Closed test run');
}

/* Messages */
function messages(data) {
  const { run, testers, messages: msgs } = data;
  const archived = run.state === 'closed';
  let last = null;
  const thread = msgs.map((m) => {
    const sep = m.day !== last ? `<div class="daysep slate">${m.day === run.day && !archived ? 'Today' : `Day ${m.day}`}</div>` : '';
    last = m.day;
    return sep + bubble(m);
  }).join('');
  return page(run, 'messages', 0, `<div class="dk-cols">
    <main id="main" class="dk-main">
      <h1 class="dk-h1" tabindex="-1">Messages</h1>
      <p class="muted dk-lede" style="margin-top:4px">${archived ? 'The thread for this run, archived.' : 'One thread for this run. We reply the same day.'}</p>
      <div class="paper dk-thread">
        ${msgs.length ? `<div class="thread" id="thread" role="log" aria-label="Message thread">${thread}</div>` : `<div class="dk-say">${emptyMessages()}</div>`}
        ${archived
          ? '<p class="archived slate">This run is closed. The thread stays here to read.</p>'
          : !WRITES ? `<p class="archived slate">${esc(COPY.readonlyMessages)}</p>`
          : `<form class="composer" id="composer">
              <input type="file" id="file" class="sr" tabindex="-1" aria-hidden="true">
              <button type="button" class="paper ibtn" id="attach" aria-label="Attach a file"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg></button>
              <label for="msg" class="sr">Message</label>
              <input id="msg" class="field" autocomplete="off" placeholder="Write a message" style="flex:1;border-radius:14px">
              <button type="submit" class="btn btn-p" style="min-height:50px;padding:0 22px">Send</button>
            </form>`}
      </div>
    </main>
    <aside class="dk-side">${statusCard(run, testers)}</aside>
  </div>`, archived ? `Run complete, ${dayMonth(run.closedOn)}` : 'Closed test run');
}

/* Notifications */
function settings(data) {
  const { run, prefs } = data;
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  const opts = (sel) => hours.map((h) => `<option${h === sel ? ' selected' : ''}>${h}</option>`).join('');
  return page(run, 'settings', data.unread, `<main id="main" class="dk-wide dk-settings">
    <h1 class="dk-h1" tabindex="-1">Notifications</h1>
    <div class="paper">
      ${toggle('push', 'Push notifications', 'Milestones and messages from us', prefs.push, { disabled: !WRITES })}
      <div class="rule"></div>
      ${toggle('digest', 'Daily email digest', 'One email a day with the run’s status', prefs.digest, { disabled: !WRITES })}
    </div>
    ${WRITES ? '' : `<p class="muted" style="font-size:14px">${esc(COPY.readonlyPrefs)}</p>`}
    <fieldset class="paper" style="padding:16px;border:0;margin:0">
      <legend class="sr">Quiet hours</legend>
      <div style="font-weight:700;font-size:16px" aria-hidden="true">Quiet hours</div>
      <div class="slate" style="font-size:13px;margin-top:2px">No push notifications between these times</div>
      <div class="qh" style="max-width:420px">
        <label class="slate">From<select class="field" id="qfrom"${WRITES ? '' : ' disabled'}>${opts(prefs.quietFrom)}</select></label>
        <label class="slate">To<select class="field" id="qto"${WRITES ? '' : ' disabled'}>${opts(prefs.quietTo)}</select></label>
      </div>
    </fieldset>
    <p class="muted" style="font-size:14px">Signed in as ${esc(email)} · <button type="button" class="link" data-signout style="color:#fff;min-height:44px">Sign out</button></p>
  </main>`, run.state === 'closed' ? `Run complete, ${dayMonth(run.closedOn)}` : 'Closed test run');
}

export function render(route, data, ctx = {}) {
  email = ctx.email || data.run.clientEmail || '';
  const s = data.run.state;
  if (route === 'activity') return activity(data);
  if (route === 'messages') return messages(data);
  if (route === 'settings') return settings(data);
  // Desktop has no separate onboarding page: welcome and the Run tab are one view while seats fill.
  if (s === 'filling') return welcome(data);
  if (s === 'requirement_met') return met(data);
  if (s === 'closed') return closed(data);
  return run(data);
}
