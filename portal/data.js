// Data and auth layer (see CONTRACT.md).
// Live: Supabase Auth magic link (PKCE) plus a read-only select of the signed-in client's portal_runs row.
// Mock: the JSON files in mock/, used everywhere except the live hosts in config.js (review copy, previews, local).
import { SUPABASE_URL, SUPABASE_ANON_KEY, LIVE_HOSTS, SCREENSHOT_BUCKET, SIGNED_URL_SECONDS } from './config.js';

export const SCENARIOS = ['day0', 'day9', 'restart', 'met', 'closed'];
const params = new URLSearchParams(location.search);
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
// Live only on the hosts Supabase Auth redirects to; previews and local runs stay on mock data.
export const LIVE = configured && LIVE_HOSTS.includes(location.hostname);
// v1 reads the run document read-only. Writes (messages, prefs) wait on Yacine's write-path decision.
export const WRITES = !LIVE;

/* ---------- Supabase client (vendored supabase-js 2.118.0, loaded only in live mode) ---------- */
let sb = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}
async function client() {
  if (sb) return sb;
  if (!window.supabase?.createClient) await loadScript('vendor/supabase-js-2.118.0.js');
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
  return sb;
}

// Strip auth parameters from the address bar once handled, keeping ?app= and the hash route.
function cleanUrl() {
  const keep = new URLSearchParams();
  for (const k of ['app', 'mock']) if (params.has(k)) keep.set(k, params.get(k));
  const q = keep.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
}

/* ---------- Session ---------- */
// Returns { email } or null. linkFailed is true when the page was opened from a sign-in link that didn't work.
export async function getSession() {
  if (!LIVE) return { session: { email: null }, linkFailed: false };
  const fromLink = params.has('code') || params.has('error') || params.has('error_description');
  const c = await client();
  const { data, error } = await c.auth.getSession();
  if (error) console.error('Session error', error);
  if (fromLink) cleanUrl();
  const email = data?.session?.user?.email || null;
  return { session: email ? { email } : null, linkFailed: fromLink && !email };
}

// Returns 'sent' | 'rate' | 'error' | 'mock'.
// Unknown addresses report 'sent' too, so the screen never reveals who is a client.
export async function requestLink(email) {
  if (!LIVE) return 'mock';
  try {
    const c = await client();
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
    });
    if (!error) return 'sent';
    console.warn('Magic link request', error.status, error.code, error.message);
    if (error.status === 429) return 'rate';
    if (error.status >= 400 && error.status < 500) return 'sent';
    return 'error';
  } catch (err) {
    console.error(err);
    return 'error';
  }
}

export async function signOut() {
  if (!LIVE) return;
  const c = await client();
  await c.auth.signOut();
}

/* ---------- Run document ---------- */
export function scenario() {
  const m = params.get('mock');
  return m === 'error' || SCENARIOS.includes(m) ? m : 'day9';
}

// Returns the validated document, or null when the signed-in client has no run yet.
export async function loadPortal() {
  if (!LIVE) {
    const s = scenario();
    if (s === 'error') throw new Error('Mock load failure');
    const res = await fetch(`mock/${s}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Mock ${s} returned ${res.status}`);
    return validate(await res.json());
  }
  const c = await client();
  let q = c.from('portal_runs').select('doc, app').order('updated_at', { ascending: false }).limit(1);
  if (params.get('app')) q = q.eq('app', params.get('app'));
  const { data, error } = await q;
  if (error) throw new Error(`portal_runs: ${error.message}`);
  if (!data?.length) return null;
  return validate(data[0].doc);
}

const STATES = ['filling', 'in_progress', 'restarted', 'requirement_met', 'closed'];
const TSTATUS = ['joining', 'opted_in', 'active', 'missed', 'replacement'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const safeUrl = (u) => u == null || /^https:\/\//i.test(u);
// Storage path: <client email>/<app>/day-NN/<seat>-<name>.<ext>, plain characters only, no "..".
const SHOT_PATH = /^[a-z0-9._@+-]+(\/[a-z0-9._@+-]+){1,4}\.(webp|jpe?g|png)$/;
const safePath = (p) => p == null || (SHOT_PATH.test(p) && !p.includes('..'));

// The document is edited by hand in the dashboard, so check it before drawing anything.
export function validate(doc) {
  const p = [];
  const run = doc?.run;
  if (!run) throw new Error('Run document: missing run');
  if (!STATES.includes(run.state)) p.push(`run.state "${run.state}"`);
  if (!Number.isInteger(run.day) || run.day < 0 || run.day > 14) p.push(`run.day ${run.day}`);
  if (!ISO.test(run.startDate || '')) p.push('run.startDate');
  if (!run.app) p.push('run.app');
  if (run.state === 'closed' && !ISO.test(run.closedOn || '')) p.push('run.closedOn (needed when closed)');
  if (run.restart && run.restart.posted && !ISO.test(run.restart.date || '')) p.push('run.restart.date');
  if (!Array.isArray(doc.testers) || doc.testers.length !== 12) p.push('testers (need exactly 12)');
  (doc.testers || []).forEach((t, i) => {
    if (!TSTATUS.includes(t.status)) p.push(`testers[${i}].status "${t.status}"`);
    if (t.status !== 'joining' && !t.name) p.push(`testers[${i}].name`);
    if (!Array.isArray(t.streak) || t.streak.length !== 14 || t.streak.some((c) => !['on', 'miss', ''].includes(c))) p.push(`testers[${i}].streak`);
  });
  for (const [i, a] of (doc.activity || []).entries()) {
    if (!Array.isArray(a.screenshots) || !Array.isArray(a.notes)) p.push(`activity[${i}] screenshots/notes`);
    if ((a.screenshots || []).some((s) => !safeUrl(s.src))) p.push(`activity[${i}] screenshot src must be https`);
    if ((a.screenshots || []).some((s) => !safePath(s.path))) p.push(`activity[${i}] screenshot path (lowercase, e.g. maya@x.app/pocket-planner/day-09/03-dev.webp)`);
  }
  for (const [i, m] of (doc.messages || []).entries()) {
    if (!['us', 'client'].includes(m.from) || !['text', 'file'].includes(m.type)) p.push(`messages[${i}] from/type`);
    if (!safeUrl(m.url)) p.push(`messages[${i}].url must be https`);
  }
  if (p.length) throw new Error(`Run document failed checks: ${p.join('; ')}`);
  doc.activity ||= [];
  doc.messages ||= [];
  doc.unread ||= 0;
  doc.prefs ||= { push: false, digest: false, quietFrom: '22:00', quietTo: '08:00' };
  return doc;
}

/* ---------- Screenshots: signed links from the private bucket ---------- */
// Signs storage paths in one batched call and caches each link until shortly before it expires,
// so scrolling back and forth never re-signs. Returns Map(path -> url); unsigned paths are left out.
const signed = new Map(); // path -> { url, until }
export async function signScreens(paths) {
  const now = Date.now();
  const out = new Map();
  const todo = [];
  for (const p of new Set(paths)) {
    const c = signed.get(p);
    if (c && c.until > now) out.set(p, c.url);
    else todo.push(p);
  }
  if (!LIVE || !todo.length) return out;
  try {
    const c = await client();
    const { data, error } = await c.storage.from(SCREENSHOT_BUCKET).createSignedUrls(todo, SIGNED_URL_SECONDS);
    if (error) throw error;
    for (const r of data || []) {
      if (r.error || !r.signedUrl) { console.warn('Screenshot not signed', r.path, r.error); continue; }
      signed.set(r.path, { url: r.signedUrl, until: now + (SIGNED_URL_SECONDS - 300) * 1000 });
      out.set(r.path, r.signedUrl);
    }
  } catch (err) {
    console.warn('Screenshot signing failed; showing placeholders', err);
  }
  return out;
}

// Mock-only: in live v1 the document is read-only and the UI doesn't offer these.
export async function sendMessage(data, msg) {
  if (!WRITES) return null;
  data.messages.push(msg);
  return msg;
}
export async function savePrefs(data, prefs) {
  if (!WRITES) return null;
  Object.assign(data.prefs, prefs);
  return data.prefs;
}
