-- Premium trial reminder pipeline
-- Run this in the Supabase SQL editor before deploying the edge functions.

create extension if not exists "pgcrypto";

create table if not exists public.revenuecat_webhook_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text,
  original_app_user_id text,
  original_transaction_id text,
  product_id text,
  environment text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists public.premium_trial_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_user_id text not null,
  original_app_user_id text,
  product_id text not null,
  store text,
  environment text,
  original_transaction_id text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz not null,
  reminder_due_at timestamptz not null,
  sent_at timestamptz,
  cancelled_at timestamptz,
  converted_at timestamptz,
  expired_at timestamptz,
  last_delivery_attempt_at timestamptz,
  last_delivery_error text,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists premium_trial_reminders_original_txn_uidx
  on public.premium_trial_reminders (original_transaction_id);

create unique index if not exists premium_trial_reminders_fallback_uidx
  on public.premium_trial_reminders (app_user_id, product_id, trial_ends_at);

create index if not exists premium_trial_reminders_due_idx
  on public.premium_trial_reminders (reminder_due_at)
  where sent_at is null
    and cancelled_at is null
    and converted_at is null
    and expired_at is null;

create index if not exists premium_trial_reminders_user_id_idx
  on public.premium_trial_reminders (user_id);

alter table if exists public.revenuecat_webhook_events enable row level security;
alter table if exists public.premium_trial_reminders enable row level security;

revoke all on public.revenuecat_webhook_events from anon;
revoke all on public.revenuecat_webhook_events from authenticated;
revoke all on public.premium_trial_reminders from anon;
revoke all on public.premium_trial_reminders from authenticated;

-- Cron helper for the reminder sender edge function.
-- Replace <CRON_SECRET> before running this block.
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

create or replace function public.invoke_send_trial_reminders(payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    'https://ueiptamivkuwhswotwpn.functions.supabase.co/send-trial-reminders',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    coalesce(payload, '{}'::jsonb)
  );
end;
$$;

-- Run hourly. Adjust if you want a tighter cadence.
do $block$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'premium-trial-reminder-email-hourly'
  ) then
    perform cron.schedule(
      'premium-trial-reminder-email-hourly',
      '0 * * * *',
      $$select public.invoke_send_trial_reminders();$$
    );
  end if;
end;
$block$;
