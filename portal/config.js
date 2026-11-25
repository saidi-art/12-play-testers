// Public settings for the live portal (CONTRACT.md). Project: portal-kubeai (eu-north-1).
// The anon key is meant to be public (role "anon"): row-level security and grants on portal_runs
// protect the data. The service-role key must never appear in this repo.
export const SUPABASE_URL = 'https://wtejbawmpmmhkusvgfla.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZWpiYXdtcG1taGt1c3ZnZmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1Njc1NTYsImV4cCI6MjExMTE0MzU1Nn0.mlXfynfoKtnzPxPlrZe24k_PpYey4gop8_2UtqeY5hI';

// The portal runs live (real sign-in and data) only on these hosts. Everywhere else
// (deploy previews, local) it runs on mock data and never contacts Supabase.
// Add a preview host here only after it is added to Supabase Auth's Redirect URLs.
export const LIVE_HOSTS = ['portal.kubeai.info'];
