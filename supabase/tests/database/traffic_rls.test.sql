begin;

select plan(10);

insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
values
    (
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-0000-0000-000000000001',
        'authenticated',
        'authenticated',
        'rls-one@example.test',
        '',
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"RLS User One"}',
        now(),
        now()
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-0000-0000-000000000002',
        'authenticated',
        'authenticated',
        'rls-two@example.test',
        '',
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"RLS User Two"}',
        now(),
        now()
    );

insert into public.user_preferences (user_id, preferences)
values
    ('10000000-0000-0000-0000-000000000001', '{"theme":"dark"}'),
    ('10000000-0000-0000-0000-000000000002', '{"theme":"light"}');

insert into public.traffic_observations (
    provider, city, provider_reference, speed_mps
)
values
    ('HERE', 'Jaipur', 'test-jaipur-road', 8.5),
    ('HERE', 'Other City', 'test-other-road', 9.5);

insert into public.provider_sync_logs (provider, city, status)
values ('HERE', 'Jaipur', 'SUCCEEDED');

insert into public.traffic_incidents (
    provider, city, provider_reference, incident_type
)
values
    ('HERE', 'Jaipur', 'test-jaipur-incident', 'accident'),
    ('HERE', 'Other City', 'test-other-incident', 'accident');

set local role anon;
select is(
    (select count(*)::integer from public.traffic_observations),
    1,
    'anonymous users see only Jaipur traffic observations'
);
select is(
    (select count(*)::integer from public.profiles),
    0,
    'anonymous users cannot read profiles'
);
select ok(
    not has_table_privilege('anon', 'public.provider_sync_logs', 'select'),
    'anonymous users cannot query provider sync logs'
);
select is(
    (select count(*)::integer from public.traffic_incidents),
    1,
    'anonymous users see only Jaipur traffic incidents'
);

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
);
select is(
    (select count(*)::integer from public.profiles),
    1,
    'authenticated users see only their own profile'
);
select is(
    (select count(*)::integer from public.user_preferences),
    1,
    'authenticated users see only their own preferences'
);
select lives_ok(
    $$update public.user_preferences
      set preferences = '{"theme":"hacked"}'
      where user_id = '10000000-0000-0000-0000-000000000002'$$,
    'updating another user preferences affects no rows'
);

reset role;
select is(
    (select preferences from public.user_preferences
      where user_id = '10000000-0000-0000-0000-000000000002'),
    '{"theme":"light"}'::jsonb,
    'another users preferences remain unchanged'
);

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
);
select throws_ok(
    $$insert into public.user_preferences (user_id, preferences)
      values ('10000000-0000-0000-0000-000000000002', '{"theme":"dark"}')$$,
    '42501',
    null,
    'authenticated users cannot create preferences for another user'
);
select is(
    (select count(*)::integer from public.traffic_incidents),
    1,
    'authenticated users can read Jaipur incident information'
);

select * from finish();
rollback;
