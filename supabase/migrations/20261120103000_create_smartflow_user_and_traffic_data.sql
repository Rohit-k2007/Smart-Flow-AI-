create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.traffic_observations (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    city text not null,
    provider_reference text,
    speed_mps double precision,
    free_flow_speed_mps double precision,
    jam_factor double precision,
    confidence double precision,
    traversability text,
    geometry jsonb,
    provider_timestamp timestamptz,
    observed_at timestamptz not null default now(),
    constraint traffic_observations_speed_nonnegative
        check (speed_mps is null or speed_mps >= 0),
    constraint traffic_observations_free_flow_nonnegative
        check (free_flow_speed_mps is null or free_flow_speed_mps >= 0),
    constraint traffic_observations_jam_factor_range
        check (jam_factor is null or jam_factor between 0 and 10),
    constraint traffic_observations_provider_snapshot_unique
        unique (provider, city, provider_reference, provider_timestamp)
);

create table if not exists public.traffic_incidents (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    city text not null,
    provider_reference text,
    incident_type text,
    summary text,
    description text,
    start_time timestamptz,
    end_time timestamptz,
    criticality text,
    status text,
    road_closed boolean,
    road_segment_reference text,
    geometry jsonb,
    provider_timestamp timestamptz,
    observed_at timestamptz not null default now(),
    constraint traffic_incidents_provider_snapshot_unique
        unique (provider, city, provider_reference, provider_timestamp)
);

create table if not exists public.intersections (
    id uuid primary key default gen_random_uuid(),
    city text not null,
    name text not null,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    geometry jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (city, name)
);

create table if not exists public.user_preferences (
    user_id uuid primary key references auth.users (id) on delete cascade,
    preferences jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.provider_sync_logs (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    city text not null,
    status text not null check (status in ('SUCCEEDED', 'DEGRADED', 'FAILED')),
    observations_received integer not null default 0 check (observations_received >= 0),
    incidents_received integer not null default 0 check (incidents_received >= 0),
    error_code text,
    message text,
    started_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists traffic_observations_city_time_idx
    on public.traffic_observations (city, observed_at desc);
create index if not exists traffic_observations_provider_reference_idx
    on public.traffic_observations (provider, provider_reference, provider_timestamp desc);
create index if not exists traffic_incidents_city_time_idx
    on public.traffic_incidents (city, observed_at desc);
create index if not exists traffic_incidents_provider_reference_idx
    on public.traffic_incidents (provider, provider_reference, provider_timestamp desc);
create index if not exists intersections_city_name_idx
    on public.intersections (city, name);
create index if not exists provider_sync_logs_city_time_idx
    on public.provider_sync_logs (city, started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        nullif(new.raw_user_meta_data ->> 'name', '')
    )
    on conflict (id) do update
        set email = excluded.email,
            display_name = coalesce(public.profiles.display_name, excluded.display_name);
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
    before update on public.user_preferences
    for each row execute function public.set_updated_at();

drop trigger if exists intersections_set_updated_at on public.intersections;
create trigger intersections_set_updated_at
    before update on public.intersections
    for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.traffic_observations enable row level security;
alter table public.traffic_incidents enable row level security;
alter table public.intersections enable row level security;
alter table public.user_preferences enable row level security;
alter table public.provider_sync_logs enable row level security;

create policy "Users can read their own profile"
    on public.profiles for select to authenticated
    using ((select auth.uid()) = id);
create policy "Users can update their own profile"
    on public.profiles for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

create policy "Public can read Jaipur traffic observations"
    on public.traffic_observations for select to anon, authenticated
    using (city = 'Jaipur');
create policy "Public can read Jaipur traffic incidents"
    on public.traffic_incidents for select to anon, authenticated
    using (city = 'Jaipur');
create policy "Public can read Jaipur intersections"
    on public.intersections for select to anon, authenticated
    using (city = 'Jaipur');

create policy "Users can read their own preferences"
    on public.user_preferences for select to authenticated
    using ((select auth.uid()) = user_id);
create policy "Users can create their own preferences"
    on public.user_preferences for insert to authenticated
    with check ((select auth.uid()) = user_id);
create policy "Users can update their own preferences"
    on public.user_preferences for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select on public.traffic_observations to anon, authenticated;
grant select on public.traffic_incidents to anon, authenticated;
grant select on public.intersections to anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant all on public.profiles to service_role;
grant all on public.traffic_observations to service_role;
grant all on public.traffic_incidents to service_role;
grant all on public.intersections to service_role;
grant all on public.user_preferences to service_role;
grant all on public.provider_sync_logs to service_role;
