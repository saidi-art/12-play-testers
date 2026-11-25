// Data layer for the static shell: mock JSON only.
// The real contract comes from the admin side and is Yacine's decision (spec 06/07).
// No endpoints are defined here on purpose; checkpoint 3 replaces loadPortal() once the feed is confirmed.

export const SCENARIOS = ['day0', 'day9', 'restart', 'met', 'closed'];

export function scenario() {
  const m = new URLSearchParams(location.search).get('mock');
  return m === 'error' || SCENARIOS.includes(m) ? m : 'day9';
}

export async function loadPortal() {
  const s = scenario();
  if (s === 'error') throw new Error('Mock load failure');
  const res = await fetch(`mock/${s}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Mock ${s} returned ${res.status}`);
  return res.json();
}

// Messaging and notification toggles are live features in production.
// In the shell they only update local state; nothing leaves the page.
export async function sendMessage(data, msg) {
  data.messages.push(msg);
  return msg;
}
export async function savePrefs(data, prefs) {
  Object.assign(data.prefs, prefs);
  return data.prefs;
}
