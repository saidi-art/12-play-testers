// Public settings for the live portal (CONTRACT.md).
// The anon key is meant to be public; row-level security on portal_runs protects the data.
// Leave URL and key empty to run on mock data only (the review copy).
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// On these hosts the portal is always live and ignores ?mock=.
export const LIVE_HOSTS = ['portal.kubeai.info'];
