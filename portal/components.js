// Component set from the design file's component section. Every screen composes from these.
// Each function returns an HTML string; all data passes through esc().

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  run: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  activity: '<rect x="4" y="3" width="11" height="15" rx="2"/><path d="M9 21h9a2 2 0 0 0 2-2V8"/>',
  messages: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  attach: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
export const tickSvg = '<svg viewBox="0 0 12 12" width="16" height="16" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Avatar colours from the design, assigned by seat so a name never maps to a photo or identity.
const AV = ['#5F84A6', '#B0645A', '#6F9463', '#B8903F', '#86699F', '#4A8586', '#A8714B', '#5A6C99', '#A25878', '#68855A', '#3F6E8C', '#9A7A4E'];
export const avatar = (t, cls = '') =>
  `<span class="av ${cls}" style="background:${AV[(t.seat ?? 0) % AV.length]}" aria-hidden="true">${esc((t.name || '?').trim().charAt(0).toUpperCase())}</span>`;

export const logoDots = () => `<span class="logodots" aria-hidden="true">${'<i></i>'.repeat(12)}</span>`;

// Day line: 14 cells, on / miss / empty. cols = 7 (two rows, card) or 14 (one row).
export function dots(streak, cols = 7, label = '') {
  const cells = Array.from({ length: 14 }, (_, i) => streak?.[i] || '');
  const on = cells.filter((c) => c === 'on').length;
  const aria = label || `${on} of 14 days`;
  return `<div class="dots${cols === 14 ? ' w14' : ''}" role="img" aria-label="${esc(aria)}">${cells.map((c) => `<i${c ? ` class="${c}"` : ''}></i>`).join('')}</div>`;
}

// Day counter: variant day (red top), restart (orange), done (green).
export function dayCounter(n, variant = 'day') {
  const top = { day: 'DAY', restart: 'RESTART', done: 'DONE' }[variant];
  return `<div class="paper cal ${variant}" role="img" aria-label="Day ${n} of 14"><div class="top" aria-hidden="true">${top}</div><div class="num" aria-hidden="true">${n}</div><div class="of" aria-hidden="true">of 14</div></div>`;
}

export const tag = (text, tone) => `<span class="tag tag-${tone}">${esc(text)}</span>`;
export const stamp = (text = 'Requirement met') => `<div class="stamp">${esc(text)}</div>`;
export const tick = () => `<span class="tick" aria-hidden="true">${tickSvg}</span>`;

// Tester cards: active, missed day, replacement, opted in, joining.
export function testerCard(t, { wide = false } = {}) {
  if (t.status === 'joining') return `<div class="tcard joining">Joining</div>`;
  if (t.status === 'opted_in')
    return `<div class="paper tcard optin">${avatar(t, 'lg')}<span class="tname">${esc(t.name)}</span><span class="st">Opted in</span></div>`;
  const repl = t.status === 'replacement';
  const missed = (t.streak || []).includes('miss');
  const label = `${t.name}: ${t.days} of 14 days${missed ? ', missed a day' : ''}${repl ? ', new replacement tester' : ''}`;
  return `<div class="paper tcard${repl ? ' repl' : ''}">${repl ? `<span class="tag tag-o newtag" aria-hidden="true">New</span>` : ''}<div class="who">${avatar(t)}<span class="tname">${esc(t.name)}</span></div>${dots(t.streak, wide ? 14 : 7, label)}</div>`;
}

export const wall = (testers, label = 'Your 12 testers', { wide = false, cls = '' } = {}) =>
  `<ul class="wall${cls ? ' ' + cls : ''}" aria-label="${esc(label)}">${testers.map((t) => `<li>${testerCard(t, { wide })}</li>`).join('')}</ul>`;

// App header: app tile + name + subtitle, optional bell.
export function appHeader(run, sub, { bell = true } = {}) {
  return `<header class="hdr"><div class="id"><span class="paper applogo">${logoDots()}</span><div><div class="appname">${esc(run.app)}</div><div class="muted appsub">${esc(sub)}</div></div></div>${
    bell ? `<a class="paper ibtn" href="#settings" aria-label="Notification settings">${icon('bell')}</a>` : ''
  }</header>`;
}

export function tabBar(current, unread = 0) {
  const tabs = [['run', 'Run'], ['activity', 'Activity'], ['messages', 'Messages']];
  return `<nav class="paper tabbar" aria-label="Portal">${tabs
    .map(([id, name]) => {
      const badge = id === 'messages' && unread > 0 && current !== 'messages'
        ? `<span class="badge" aria-hidden="true">${unread}</span><span class="sr">, ${unread} unread</span>` : '';
      return `<a class="tab" href="#${id}"${current === id ? ' aria-current="page"' : ''}>${icon(id)}${name}${badge}</a>`;
    })
    .join('')}</nav>`;
}

export const toggle = (id, title, sub, checked) =>
  `<label class="pref" for="${id}"><span><b>${esc(title)}</b><small>${esc(sub)}</small></span><input class="sw" type="checkbox" id="${id}"${checked ? ' checked' : ''}></label>`;

export function bubble(m) {
  const side = m.from === 'client' ? 'me' : 'us';
  if (m.type === 'file') {
    const inner = `<span class="ico" aria-hidden="true"></span>${esc(m.fileName)}`;
    return m.url
      ? `<a class="paper file ${side}" href="${esc(m.url)}" download>${inner}</a>`
      : `<div class="paper file ${side}">${inner}</div>`;
  }
  return `<div class="bub ${side}${side === 'us' ? ' paper' : ''}">${esc(m.text)}</div>`;
}

// Polaroid: caption (tester first name) shows on the desktop Activity strip only.
export const polaroid = (s, rot, { caption = false } = {}) => {
  const alt = s?.tester ? `Daily screenshot from ${s.tester}` : 'Daily screenshot';
  const pic = s?.src ? `<img src="${esc(s.src)}" alt="${esc(alt)}" loading="lazy">` : `<div role="img" aria-label="${esc(alt)}"></div>`;
  return `<li class="polaroid${caption ? ' cap' : ''}" style="transform:rotate(${rot}deg)">${pic}${caption && s?.tester ? `<span aria-hidden="true">${esc(s.tester)}</span>` : ''}</li>`;
};
export const ROT = [-3, 2, -1.5, 2.5, -2, 1.5];

// Dates: always computed from ISO dates in the data, so weekdays stay calendar-true.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const asDate = (iso) => new Date(iso + 'T12:00:00Z');
export const dayMonth = (iso) => `${asDate(iso).getUTCDate()} ${MONTHS[asDate(iso).getUTCMonth()]}`;
export const fullDate = (iso) => `${DAYS[asDate(iso).getUTCDay()]} ${dayMonth(iso)}`;

// Run status helpers shared by phone and desktop.
export function counterVariant(run) {
  if (run.state === 'restarted') return 'restart';
  if (run.state === 'requirement_met' || run.state === 'closed') return 'done';
  return 'day';
}
export function todayLine(run, testers) {
  if (run.state === 'filling') {
    const opted = testers.filter((t) => t.status !== 'joining').length;
    return { alert: false, text: `${opted} of 12 opted in · starts ${dayMonth(run.startDate)}` };
  }
  if (run.state === 'requirement_met' || run.state === 'closed') return { alert: false, text: 'Requirement met' };
  const missed = testers.filter((t) => t.status === 'missed' || t.streak?.[run.day - 1] === 'miss').length;
  if (missed) return { alert: true, text: `${missed} ${missed === 1 ? 'tester' : 'testers'} missed today` };
  return { alert: false, text: 'All 12 testers active today' };
}

export const stickyNote = (n, rot = -1) =>
  `<figure class="sticky" style="transform:rotate(${rot}deg);margin:0"><figcaption class="by">${esc(n.tester)} · note</figcaption><blockquote class="txt" style="margin:0">“${esc(n.text)}”</blockquote></figure>`;

// Empty states. The "Illustrative" tag appears here and nowhere else (decision 3).
export const emptyActivity = () =>
  `<div class="empty"><div class="faded" aria-hidden="true"><div class="polaroid"><div></div></div><div class="polaroid"><div></div></div><div class="polaroid"><div></div></div></div>${tag('Illustrative', 'n')}<h2>Screenshots start on day 1</h2><p class="muted">Each tester sends one a day. They land here, newest first, with any notes.</p></div>`;
export const emptyMessages = () =>
  `<div class="empty"><h2>Say hello</h2><p class="muted">Questions about your run, a new build, anything. One thread, and we reply the same day.</p></div>`;
