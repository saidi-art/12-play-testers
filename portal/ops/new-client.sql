-- New client run: one portal_runs row in the "seats filling" state (day 0).
-- Run once per client/app in the Supabase SQL editor, AFTER adding the client under
-- Authentication -> Users -> Add user -> Create new user (same email, "Auto Confirm User" ticked).
-- Edit only the five values in the first block.
with v as (
  select lower('client@example.com') as email,      -- the address the client booked with (sign-in email)
         'app-slug'                  as app,        -- lowercase slug, e.g. pocket-planner (also the screenshot folder)
         'Maya'                      as client,     -- client's first name ("Welcome, Maya")
         'Pocket Planner'            as app_name,   -- app display name
         date '2026-12-01'           as start_date  -- planned start; the weekday is computed by the portal
)
insert into public.portal_runs (client_email, app, doc)
select email, app, jsonb_build_object(
  'run', jsonb_build_object(
    'client', client, 'clientEmail', email, 'app', app_name,
    'startDate', to_char(start_date, 'YYYY-MM-DD'), 'day', 0, 'state', 'filling',
    'lastUpdate', to_char(now() at time zone 'Europe/Paris', 'FMDD FMMonth, HH24:MI')),
  'testers', (select jsonb_agg(jsonb_build_object(
                'seat', s, 'name', null, 'status', 'joining', 'days', 0,
                'streak', (select jsonb_agg(''::text) from generate_series(1, 14))) order by s)
              from generate_series(0, 11) s),
  'activity', '[]'::jsonb,
  'messages', '[]'::jsonb,
  'unread', 0,
  'prefs', jsonb_build_object('push', false, 'digest', true, 'quietFrom', '22:00', 'quietTo', '08:00'))
from v
returning client_email, app, doc -> 'run' as run;
