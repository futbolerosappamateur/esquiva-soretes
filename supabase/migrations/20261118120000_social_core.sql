-- =====================================================================
-- ESQUIVA SORETES · Capa social online (etapa 1 + base de la etapa 2)
-- Migración 1 de 2: esquema, seguridad y funciones del servidor.
-- La migración 2 (…_game_rules.sql) carga las reglas del juego y se
-- genera desde el código con `npm run online:rules`.
--
-- Principios:
--  * El juego (el navegador) NUNCA escribe tablas directamente: todo cambio
--    pasa por funciones del servidor (RPC) que validan los datos. Son
--    `security definer` con search_path vacío y nombres calificados.
--  * Todas las tablas tienen Row Level Security. Los clientes sólo pueden
--    leer sus propias filas; rankings y perfiles públicos se leen con
--    funciones que aplican las reglas de privacidad y de bloqueos.
--  * No se guardan emails ni datos personales en estas tablas: el correo
--    vive sólo en auth.users (Supabase Auth) y ninguna función lo devuelve.
--  * Las validaciones de partidas son una primera barrera (coherencia de
--    tiempo, puntaje, progresión y eventos). No eliminan las trampas: ver
--    docs/ONLINE.md (verificación futura con registro de eventos).
-- =====================================================================

-- Funciones internas: en un esquema que la API de Supabase no expone.
create schema if not exists private;
revoke all on schema private from public;
-- Las políticas de RLS usan private.owns_profile(): el rol que consulta
-- necesita poder ejecutarla (nada más de este esquema).
grant usage on schema private to authenticated;

-- =====================================================================
-- 1. Reglas del juego (las carga la migración generada; lectura pública)
-- =====================================================================

create table public.game_rules (
  id int primary key default 1 check (id = 1),
  version text not null,
  speed_bonus_excellent int not null,
  speed_bonus_good int not null,
  speed_bonus_ok int not null,
  coins_per_new_star int not null,
  max_profiles_per_account int not null default 6,
  updated_at timestamptz not null default now()
);

create table public.game_barrios (
  id text primary key,
  sort_order int not null,
  name text not null
);

create table public.game_levels (
  id text primary key,
  barrio_id text not null references public.game_barrios (id),
  level_index int not null,
  level_number int not null,
  environment text not null,
  active boolean not null default true,
  blocks int not null,
  crossings int not null,
  coins int not null,
  dodgeables int not null,
  water_ladies int not null,
  mission_id text,
  mission_kind text check (mission_kind in ('trash', 'animal')),
  mission_items int not null default 0,
  mission_points int not null default 0,
  mission_coins int not null default 0,
  mission_first_bonus int not null default 0,
  stars_two int not null,
  stars_three int not null,
  time_excellent_s numeric not null,
  time_good_s numeric not null,
  time_ok_s numeric not null,
  -- Límites para validar resultados (calculados desde el nivel generado).
  min_time_ms int not null,
  max_distance_points int not null,
  max_dodge_points int not null,
  max_bonus_points int not null,
  max_score int not null,
  unique (barrio_id, level_index)
);

create table public.game_characters (
  id text primary key,
  name text not null,
  playable boolean not null,
  starter boolean not null,
  unlock_counter text,
  unlock_target int
);

create table public.game_achievements (
  id text primary key,
  label text not null
);

create table public.game_avatars (
  id text primary key,
  label text not null
);

create table public.game_banned_words (
  word text primary key,
  match text not null check (match in ('exact', 'contains'))
);

-- =====================================================================
-- 2. Cuentas y perfiles
-- =====================================================================

-- Una cuenta = una identidad de Supabase Auth (idealmente, un adulto).
-- Puede tener varios perfiles de jugador: el propio y perfiles
-- supervisados para chicos (sin email propio).
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  adult_confirmed_at timestamptz,
  terms_version text,
  role text not null default 'player' check (role in ('player', 'moderator', 'admin')),
  banned_at timestamptz,
  ban_reason text,
  data_deleted_at timestamptz
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- Apodo público (el personaje jugable es otra cosa).
  nickname text not null check (nickname ~ '^[A-Z0-9ÑÁÉÍÓÚÜ ]{3,10}$'),
  nickname_key text not null unique,
  avatar_id text not null references public.game_avatars (id),
  favorite_character text references public.game_characters (id),
  -- Perfil de un chico o una chica, supervisado por el adulto de la cuenta.
  supervised boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'friends', 'private')),
  show_in_rankings boolean not null default true,
  social_enabled boolean not null default true,
  nickname_changed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_account_idx on public.profiles (account_id);

-- Registro de consentimientos del adulto (perfiles supervisados).
create table public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  consent text not null check (consent in ('supervised_profile', 'social_features', 'public_profile', 'rankings')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
create index guardian_consents_account_idx on public.guardian_consents (account_id);

-- =====================================================================
-- 3. Progreso del perfil (lo escribe sólo el servidor)
-- =====================================================================

create table public.profile_stats (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  coins int not null default 0 check (coins >= 0),
  coins_earned int not null default 0,
  runs_played int not null default 0,
  runs_completed int not null default 0,
  levels_completed int not null default 0,
  crossings int not null default 0,
  car_hits int not null default 0,
  poops_dodged int not null default 0,
  play_time_ms bigint not null default 0,
  best_streak int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.profile_levels (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  level_id text not null references public.game_levels (id),
  completed boolean not null default false,
  stars int not null default 0 check (stars between 0 and 3),
  best_score int not null default 0,
  plays int not null default 0,
  -- 'import' = progreso local importado (no verificado).
  source text not null default 'game' check (source in ('game', 'import')),
  first_completed_at timestamptz,
  primary key (profile_id, level_id)
);

create table public.profile_achievements (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.game_achievements (id),
  count int not null default 0 check (count >= 0),
  primary key (profile_id, achievement_id)
);

create table public.profile_characters (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  character_id text not null references public.game_characters (id),
  source text not null check (source in ('starter', 'challenge', 'import')),
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, character_id)
);

-- Insignias: hitos que se pueden mostrar en el perfil ('char:…', 'barrio:…').
create table public.profile_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

create table public.profile_mission_rewards (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  mission_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (profile_id, mission_key)
);

-- =====================================================================
-- 4. Partidas (historial, récords y rankings)
-- =====================================================================

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_run_id text not null check (char_length(client_run_id) between 6 and 64),
  parent_client_run_id text,
  -- Apodo público al momento de la partida (los rankings muestran el actual).
  nickname text not null,
  level_id text not null references public.game_levels (id),
  barrio_id text not null,
  mode text not null check (mode in ('normal', 'timeTrial')),
  character_id text not null references public.game_characters (id),
  completed boolean not null,
  time_ms int,
  score int not null,
  -- Ayudas: checkpoint o atajos de prueba. Nunca entra a rankings oficiales.
  assisted boolean not null,
  assist_reasons text[] not null default '{}',
  continues int not null default 0,
  start_block int not null default 0,
  blocks_completed int not null default 0,
  shoes_left int not null default 0,
  details jsonb not null default '{}'::jsonb,
  splits int[] not null default '{}',
  -- Registro de eventos para una verificación más robusta en el futuro.
  event_log jsonb,
  rewards jsonb not null default '{}'::jsonb,
  source text not null default 'game' check (source in ('game', 'import')),
  -- valid: pasó las verificaciones · suspicious: datos raros (no entra a
  -- rankings, se acredita lo razonable) · rejected: imposible (no se
  -- acredita nada) · unverified: importado de un dispositivo.
  status text not null check (status in ('valid', 'suspicious', 'rejected', 'unverified')),
  status_reasons text[] not null default '{}',
  validation_version int not null default 1,
  -- Puede figurar en rankings oficiales (válida, completa y sin ayudas).
  official boolean not null default false,
  client_version text,
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (profile_id, client_run_id)
);
create index runs_speed_idx on public.runs (level_id, mode, time_ms) where official;
create index runs_score_idx on public.runs (level_id, mode, score desc) where official;
create index runs_character_idx on public.runs (level_id, mode, character_id, time_ms) where official;
create index runs_profile_recent_idx on public.runs (profile_id, created_at desc);
create index runs_account_recent_idx on public.runs (account_id, created_at desc);

-- =====================================================================
-- 5. Funciones sociales (etapa 2: amistades, bloqueos, reportes, desafíos)
-- =====================================================================

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('nickname', 'behavior', 'other')),
  details text check (char_length(details) <= 200),
  nickname_snapshot text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_open_idx on public.reports (status, created_at);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_profile uuid not null references public.profiles (id) on delete cascade,
  to_profile uuid not null references public.profiles (id) on delete cascade,
  level_id text not null references public.game_levels (id),
  mode text not null check (mode in ('normal', 'timeTrial')),
  kind text not null check (kind in ('time', 'score')),
  target_value int not null,
  target_run_id uuid references public.runs (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed', 'expired', 'cancelled')),
  result_run_id uuid references public.runs (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,
  check (from_profile <> to_profile)
);
create index challenges_to_idx on public.challenges (to_profile, status);
create index challenges_from_idx on public.challenges (from_profile, status);

-- =====================================================================
-- 6. Funciones auxiliares (internas)
-- =====================================================================

-- Lectura segura de valores del JSON que manda el juego.
create function private.jint(p jsonb, k text) returns int
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or jsonb_typeof(p -> k) is distinct from 'number' then return null; end if;
  return round(least(greatest((p ->> k)::numeric, -2000000000), 2000000000))::int;
exception when others then
  return null;
end $$;

create function private.jbool(p jsonb, k text) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p -> k) = 'boolean' then (p ->> k)::boolean else null end
$$;

create function private.jtext(p jsonb, k text, maxlen int) returns text
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p -> k) = 'string' and char_length(p ->> k) <= maxlen then p ->> k else null end
$$;

-- Clave para que los apodos sean únicos sin importar acentos ni espacios.
create function private.nickname_key(p_nick text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(btrim(coalesce(p_nick, '')), 'ÁÉÍÓÚÜ', 'AEIOUU'), '\s+', ' ', 'g')
$$;

-- null si el apodo se puede usar; si no, el motivo. Misma regla que
-- src/social/nicknameRules.ts (las pruebas comparan las dos).
create function private.nickname_problem(p_nick text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_norm text;
  v_compact text;
  v_tokens text[];
  v_token text;
  w record;
begin
  if p_nick is null or p_nick !~ '^[A-Z0-9ÑÁÉÍÓÚÜ ]{3,10}$' or p_nick <> btrim(p_nick) or position('  ' in p_nick) > 0 then
    return 'nickname_invalid';
  end if;
  if p_nick !~ '[A-ZÑÁÉÍÓÚÜ]' then
    return 'nickname_invalid';
  end if;
  -- Números usados como letras (P0TO → POTO) también se revisan.
  v_norm := translate(private.nickname_key(p_nick), '013457', 'OIEAST');
  v_compact := replace(v_norm, ' ', '');
  v_tokens := string_to_array(v_norm, ' ');
  for w in select word, match from public.game_banned_words loop
    if w.match = 'contains' then
      if position(w.word in v_compact) > 0 then return 'nickname_banned'; end if;
    else
      if v_compact = w.word or v_compact = w.word || 'S' then return 'nickname_banned'; end if;
      foreach v_token in array v_tokens loop
        if v_token = w.word or v_token = w.word || 'S' then return 'nickname_banned'; end if;
      end loop;
    end if;
  end loop;
  return null;
end $$;

create function private.owns_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_profile and account_id = auth.uid());
$$;

-- Perfil propio de quien llama (o error). Bloquea cuentas suspendidas.
create function private.require_profile(p_profile uuid) returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v from public.profiles where id = p_profile and account_id = auth.uid();
  if not found then
    raise exception 'profile_not_found';
  end if;
  if exists (select 1 from public.accounts where id = auth.uid() and banned_at is not null) then
    raise exception 'account_banned';
  end if;
  return v;
end $$;

create function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create function private.stars_for(p_score int, p_two int, p_three int) returns int
language sql immutable set search_path = '' as $$
  select case when p_score >= p_three then 3 when p_score >= p_two then 2 else 1 end
$$;

-- Bonus de velocidad que corresponde a un tiempo (misma regla que el juego).
create function private.speed_bonus(p_time_ms int, p_level text) returns int
language sql stable security definer set search_path = '' as $$
  select case
    when p_time_ms / 1000.0 <= l.time_excellent_s then r.speed_bonus_excellent
    when p_time_ms / 1000.0 <= l.time_good_s then r.speed_bonus_good
    when p_time_ms / 1000.0 <= l.time_ok_s then r.speed_bonus_ok
    else 0
  end
  from public.game_levels l cross join public.game_rules r
  where l.id = p_level and r.id = 1;
$$;

create function private.barrio_completed(p_profile uuid, p_barrio text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.game_levels where barrio_id = p_barrio and active)
     and not exists (
       select 1 from public.game_levels gl
       where gl.barrio_id = p_barrio and gl.active
         and not exists (
           select 1 from public.profile_levels pl
           where pl.profile_id = p_profile and pl.level_id = gl.id and pl.completed
         )
     );
$$;

-- Nivel 1 de un barrio desbloqueado; cada nivel siguiente, al completar el
-- anterior; un barrio, al completar el anterior (como en el juego).
create function private.level_unlocked(p_profile uuid, p_level text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lvl public.game_levels;
  v_pos int;
  v_prev text;
begin
  select * into v_lvl from public.game_levels where id = p_level and active;
  if not found then return false; end if;
  select sort_order into v_pos from public.game_barrios where id = v_lvl.barrio_id;
  select id into v_prev from public.game_barrios where sort_order < v_pos order by sort_order desc limit 1;
  if v_prev is not null and not private.barrio_completed(p_profile, v_prev) then
    return false;
  end if;
  if v_lvl.level_index = 0 then return true; end if;
  return exists (
    select 1
    from public.profile_levels pl
    join public.game_levels gl on gl.id = pl.level_id
    where pl.profile_id = p_profile and pl.completed
      and gl.barrio_id = v_lvl.barrio_id and gl.level_index = v_lvl.level_index - 1
  );
end $$;

-- Tope de cada logro en UNA partida de un nivel (para validar lo que llega).
create function private.achievement_cap(p_achievement text, p_level public.game_levels, p_completed boolean, p_flawless boolean)
returns int language sql immutable set search_path = '' as $$
  select case p_achievement
    when 'trashDeposited' then case when p_level.mission_kind = 'trash' then p_level.mission_items else 0 end
    when 'animalMissions' then case when p_level.mission_kind = 'animal' then 1 else 0 end
    when 'safeCrossings' then p_level.crossings
    when 'waterJetsDodged' then p_level.water_ladies
    when 'poopsDodged' then p_level.dodgeables
    when 'levelsCompleted' then case when p_completed then 1 else 0 end
    when 'flawlessLevels' then case when p_completed and p_flawless then 1 else 0 end
    when 'flawlessNightLevels' then case when p_completed and p_flawless and p_level.environment = 'night' then 1 else 0 end
    else 0
  end
$$;

-- Desbloquea los personajes cuyo desafío ya se cumplió. Devuelve los nuevos.
create function private.refresh_unlocks(p_profile uuid, p_source text) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_new text[] := '{}';
  v_c record;
begin
  for v_c in
    select gc.id
    from public.game_characters gc
    join public.profile_achievements pa on pa.profile_id = p_profile and pa.achievement_id = gc.unlock_counter
    where gc.playable and not gc.starter and gc.unlock_counter is not null and pa.count >= gc.unlock_target
      and not exists (select 1 from public.profile_characters pc where pc.profile_id = p_profile and pc.character_id = gc.id)
    order by gc.id
  loop
    insert into public.profile_characters (profile_id, character_id, source) values (p_profile, v_c.id, p_source);
    insert into public.profile_badges (profile_id, badge_id) values (p_profile, 'char:' || v_c.id) on conflict do nothing;
    v_new := v_new || v_c.id;
  end loop;
  return v_new;
end $$;

-- Estado completo de un perfil (lo que el juego guarda en su caché local).
create function private.profile_state(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'nickname', p.nickname,
      'avatarId', p.avatar_id,
      'favoriteCharacter', p.favorite_character,
      'supervised', p.supervised,
      'visibility', p.visibility,
      'showInRankings', p.show_in_rankings,
      'socialEnabled', p.social_enabled,
      'importedAt', p.imported_at,
      'nicknameChangedAt', p.nickname_changed_at,
      'createdAt', p.created_at
    ),
    'stats', (
      select jsonb_build_object(
        'coins', s.coins, 'coinsEarned', s.coins_earned, 'runsPlayed', s.runs_played,
        'runsCompleted', s.runs_completed, 'levelsCompleted', s.levels_completed,
        'crossings', s.crossings, 'carHits', s.car_hits, 'poopsDodged', s.poops_dodged,
        'playTimeMs', s.play_time_ms, 'bestStreak', s.best_streak)
      from public.profile_stats s where s.profile_id = p.id
    ),
    'levels', coalesce((
      select jsonb_object_agg(l.level_id, jsonb_build_object(
        'completed', l.completed, 'stars', l.stars, 'bestScore', l.best_score, 'plays', l.plays, 'source', l.source))
      from public.profile_levels l where l.profile_id = p.id
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_object_agg(a.achievement_id, a.count) from public.profile_achievements a where a.profile_id = p.id
    ), '{}'::jsonb),
    'characters', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.character_id, 'source', c.source) order by c.unlocked_at, c.character_id)
      from public.profile_characters c where c.profile_id = p.id
    ), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.badge_id, 'earnedAt', b.earned_at) order by b.earned_at, b.badge_id)
      from public.profile_badges b where b.profile_id = p.id
    ), '[]'::jsonb),
    'missionRewards', coalesce((
      select jsonb_agg(m.mission_key order by m.mission_key) from public.profile_mission_rewards m where m.profile_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = p_profile;
$$;

create function private.my_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account', (
      select jsonb_build_object(
        'adultConfirmed', a.adult_confirmed_at is not null,
        'termsVersion', a.terms_version,
        'role', a.role,
        'banned', a.banned_at is not null,
        'createdAt', a.created_at)
      from public.accounts a where a.id = auth.uid()
    ),
    'profiles', coalesce((
      select jsonb_agg(private.profile_state(p.id) order by p.created_at, p.id)
      from public.profiles p where p.account_id = auth.uid()
    ), '[]'::jsonb),
    'limits', jsonb_build_object('maxProfiles', (select max_profiles_per_account from public.game_rules where id = 1))
  );
$$;

-- Puestos que tendría una partida oficial entre las mejores marcas de cada perfil.
create function private.rank_speed(p_run public.runs) returns int
language sql stable security definer set search_path = '' as $$
  select case when p.show_in_rankings then 1 + (
    select count(distinct r.profile_id)::int
    from public.runs r
    join public.profiles op on op.id = r.profile_id
    join public.accounts oa on oa.id = op.account_id
    where r.official and r.level_id = p_run.level_id and r.mode = p_run.mode
      and r.profile_id <> p_run.profile_id and op.show_in_rankings and oa.banned_at is null
      and r.time_ms < p_run.time_ms
  ) end
  from public.profiles p where p.id = p_run.profile_id;
$$;

create function private.rank_score(p_run public.runs) returns int
language sql stable security definer set search_path = '' as $$
  select case when p.show_in_rankings then 1 + (
    select count(distinct r.profile_id)::int
    from public.runs r
    join public.profiles op on op.id = r.profile_id
    join public.accounts oa on oa.id = op.account_id
    where r.official and r.level_id = p_run.level_id and r.mode = p_run.mode
      and r.profile_id <> p_run.profile_id and op.show_in_rankings and oa.banned_at is null
      and r.score > p_run.score
  ) end
  from public.profiles p where p.id = p_run.profile_id;
$$;

create function private.run_result(p_run public.runs, p_duplicate boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'runId', p_run.id,
    'clientRunId', p_run.client_run_id,
    'status', p_run.status,
    'reasons', to_jsonb(p_run.status_reasons),
    'official', p_run.official,
    'duplicate', p_duplicate,
    'rewards', p_run.rewards,
    'ranks', jsonb_build_object(
      'speed', case when p_run.official then private.rank_speed(p_run) end,
      'score', case when p_run.official then private.rank_score(p_run) end),
    'state', private.profile_state(p_run.profile_id)
  );
$$;

-- Fila pública mínima de un perfil (para listas de amigos, bloqueos, etc.).
create function private.profile_card(p_profile uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('profileId', p.id, 'nickname', p.nickname, 'avatarId', p.avatar_id)
  from public.profiles p where p.id = p_profile;
$$;

-- =====================================================================
-- 7. Cuenta y perfiles (RPC)
-- =====================================================================

-- Estado de la cuenta de quien llama: perfiles y todo su progreso.
create function public.get_my_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return private.my_state();
end $$;

-- Primer paso de una cuenta nueva: confirmar que la usa un adulto (los
-- chicos juegan con perfiles supervisados, sin email propio).
create function public.accept_terms(p_adult boolean, p_terms_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_adult is distinct from true then raise exception 'adult_required'; end if;
  if p_terms_version is null or char_length(p_terms_version) > 20 then raise exception 'invalid_payload'; end if;
  insert into public.accounts (id, adult_confirmed_at, terms_version)
  values (auth.uid(), now(), p_terms_version)
  on conflict (id) do update set
    adult_confirmed_at = coalesce(public.accounts.adult_confirmed_at, now()),
    terms_version = excluded.terms_version;
  return private.my_state();
end $$;

create function public.create_profile(
  p_nickname text,
  p_avatar text,
  p_favorite text default null,
  p_supervised boolean default false,
  p_guardian_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_acc public.accounts;
  v_problem text;
  v_id uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_acc from public.accounts where id = auth.uid();
  if not found or v_acc.adult_confirmed_at is null then raise exception 'terms_required'; end if;
  if v_acc.banned_at is not null then raise exception 'account_banned'; end if;
  select max_profiles_per_account into v_max from public.game_rules where id = 1;
  if (select count(*) from public.profiles where account_id = auth.uid()) >= coalesce(v_max, 6) then
    raise exception 'too_many_profiles';
  end if;
  v_problem := private.nickname_problem(p_nickname);
  if v_problem is not null then raise exception '%', v_problem; end if;
  if exists (select 1 from public.profiles where nickname_key = private.nickname_key(p_nickname)) then
    raise exception 'nickname_taken';
  end if;
  if not exists (select 1 from public.game_avatars where id = p_avatar) then raise exception 'avatar_invalid'; end if;
  if p_favorite is not null and not exists (select 1 from public.game_characters where id = p_favorite and playable) then
    raise exception 'character_invalid';
  end if;
  if coalesce(p_supervised, false) and p_guardian_consent is distinct from true then
    raise exception 'consent_required';
  end if;

  insert into public.profiles (account_id, nickname, nickname_key, avatar_id, favorite_character, supervised,
                               visibility, show_in_rankings, social_enabled)
  values (auth.uid(), p_nickname, private.nickname_key(p_nickname), p_avatar, p_favorite, coalesce(p_supervised, false),
          -- Supervisado: privado y sin funciones sociales hasta que el adulto las habilite.
          case when p_supervised then 'private' else 'public' end,
          not coalesce(p_supervised, false),
          not coalesce(p_supervised, false))
  returning id into v_id;

  insert into public.profile_stats (profile_id) values (v_id);
  insert into public.profile_characters (profile_id, character_id, source)
  select v_id, id, 'starter' from public.game_characters where starter and playable;
  if p_supervised then
    insert into public.guardian_consents (account_id, profile_id, consent, granted, policy_version)
    values (auth.uid(), v_id, 'supervised_profile', true, coalesce(v_acc.terms_version, '1'));
  end if;
  return private.profile_state(v_id);
end $$;

-- Cambios permitidos: nickname, avatarId, favoriteCharacter, visibility,
-- showInRankings, socialEnabled. En perfiles supervisados, hacerlos más
-- visibles o habilitar lo social exige guardianConsent = true.
create function public.update_profile(p_profile uuid, p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
  v_acc public.accounts;
  v_nick text;
  v_problem text;
  v_avatar text;
  v_fav text;
  v_vis text;
  v_rank boolean;
  v_social boolean;
  v_consent boolean;
begin
  v := private.require_profile(p_profile);
  select * into v_acc from public.accounts where id = auth.uid();
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'invalid_payload'; end if;
  v_consent := coalesce(private.jbool(p_changes, 'guardianConsent'), false);

  if p_changes ? 'nickname' then
    v_nick := private.jtext(p_changes, 'nickname', 20);
    if v_nick is distinct from v.nickname then
      v_problem := private.nickname_problem(v_nick);
      if v_problem is not null then raise exception '%', v_problem; end if;
      if exists (select 1 from public.profiles where nickname_key = private.nickname_key(v_nick) and id <> v.id) then
        raise exception 'nickname_taken';
      end if;
      -- El primer cambio es libre (por si quedó mal escrito); después, uno por día.
      if v.nickname_changed_at is not null and v.nickname_changed_at > now() - interval '1 day' then
        raise exception 'nickname_cooldown';
      end if;
      v.nickname := v_nick;
      v.nickname_changed_at := now();
    end if;
  end if;

  if p_changes ? 'avatarId' then
    v_avatar := private.jtext(p_changes, 'avatarId', 40);
    if not exists (select 1 from public.game_avatars where id = v_avatar) then raise exception 'avatar_invalid'; end if;
    v.avatar_id := v_avatar;
  end if;

  if p_changes ? 'favoriteCharacter' then
    if jsonb_typeof(p_changes -> 'favoriteCharacter') = 'null' then
      v.favorite_character := null;
    else
      v_fav := private.jtext(p_changes, 'favoriteCharacter', 64);
      if not exists (select 1 from public.game_characters where id = v_fav and playable) then raise exception 'character_invalid'; end if;
      v.favorite_character := v_fav;
    end if;
  end if;

  if p_changes ? 'visibility' then
    v_vis := private.jtext(p_changes, 'visibility', 10);
    if v_vis is null or v_vis not in ('public', 'friends', 'private') then raise exception 'invalid_payload'; end if;
    if v.supervised and v_vis <> 'private' and v.visibility = 'private' and not v_consent then raise exception 'consent_required'; end if;
    if v.supervised and v_vis <> 'private' and v.visibility = 'private' then
      insert into public.guardian_consents (account_id, profile_id, consent, granted, policy_version)
      values (auth.uid(), v.id, 'public_profile', true, coalesce(v_acc.terms_version, '1'));
    end if;
    v.visibility := v_vis;
  end if;

  if p_changes ? 'showInRankings' then
    v_rank := private.jbool(p_changes, 'showInRankings');
    if v_rank is null then raise exception 'invalid_payload'; end if;
    if v.supervised and v_rank and not v.show_in_rankings then
      if not v_consent then raise exception 'consent_required'; end if;
      insert into public.guardian_consents (account_id, profile_id, consent, granted, policy_version)
      values (auth.uid(), v.id, 'rankings', true, coalesce(v_acc.terms_version, '1'));
    end if;
    v.show_in_rankings := v_rank;
  end if;

  if p_changes ? 'socialEnabled' then
    v_social := private.jbool(p_changes, 'socialEnabled');
    if v_social is null then raise exception 'invalid_payload'; end if;
    if v.supervised and v_social and not v.social_enabled then
      if not v_consent then raise exception 'consent_required'; end if;
      insert into public.guardian_consents (account_id, profile_id, consent, granted, policy_version)
      values (auth.uid(), v.id, 'social_features', true, coalesce(v_acc.terms_version, '1'));
    end if;
    if not v_social then
      -- Sin funciones sociales: se cortan las solicitudes y desafíos pendientes.
      delete from public.friendships where status = 'pending' and (requester_id = v.id or addressee_id = v.id);
      update public.challenges set status = 'cancelled', responded_at = now()
      where status in ('pending', 'accepted') and (from_profile = v.id or to_profile = v.id);
    end if;
    v.social_enabled := v_social;
  end if;

  update public.profiles set
    nickname = v.nickname,
    nickname_key = private.nickname_key(v.nickname),
    nickname_changed_at = v.nickname_changed_at,
    avatar_id = v.avatar_id,
    favorite_character = v.favorite_character,
    visibility = v.visibility,
    show_in_rankings = v.show_in_rankings,
    social_enabled = v.social_enabled,
    updated_at = now()
  where id = v.id;
  return private.profile_state(v.id);
end $$;

-- Borra un perfil con todo su progreso y sus partidas.
create function public.delete_profile(p_profile uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_profile);
  delete from public.profiles where id = p_profile;
  return private.my_state();
end $$;

-- Borra todos los perfiles y partidas de la cuenta. La identidad de
-- Supabase Auth (el email) se elimina desde el panel o con una función de
-- administración (ver docs/ONLINE.md).
create function public.delete_my_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.profiles where account_id = auth.uid();
  delete from public.guardian_consents where account_id = auth.uid();
  update public.accounts set data_deleted_at = now() where id = auth.uid();
  return private.my_state();
end $$;

-- =====================================================================
-- 8. Partidas: recepción y validación (RPC)
-- =====================================================================

create function public.submit_run(p_profile uuid, p_run jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prof public.profiles;
  v_rules public.game_rules;
  v_lvl public.game_levels;
  v_existing public.runs;
  v_run public.runs;
  v_client_id text;
  v_parent_id text;
  v_mode text;
  v_char text;
  v_completed boolean;
  v_time int;
  v_start_time int;
  v_score int;
  v_client_assisted boolean;
  v_assisted boolean;
  v_assist_reasons text[] := '{}';
  v_continues int;
  v_start int;
  v_blocks int;
  v_shoes int;
  v_flawless boolean;
  v_bd jsonb;
  v_counts jsonb;
  v_attempt jsonb;
  v_events jsonb;
  v_dist int;
  v_dodge int;
  v_bonus int;
  v_pen int;
  v_speed int;
  v_expected_speed int;
  v_dodged int;
  v_streak int;
  v_cross int;
  v_missions int;
  v_att_dodged int;
  v_att_cross int;
  v_att_car int;
  v_att_missions int;
  v_att_coins int;
  v_att_time int;
  v_splits int[] := '{}';
  v_prev int := 0;
  v_value int;
  v_x jsonb;
  v_key text;
  v_cap int;
  v_played timestamptz;
  v_hard text[] := '{}';
  v_soft text[] := '{}';
  v_notes text[] := '{}';
  v_status text;
  v_official boolean;
  v_mission_key text;
  v_first_unclaimed boolean := false;
  v_coins_cap int;
  v_coins_credit int := 0;
  v_ach_credit jsonb := '{}'::jsonb;
  v_stars int := 0;
  v_prev_level public.profile_levels;
  v_new_stars int := 0;
  v_star_coins int := 0;
  v_first_completion boolean := false;
  v_unlocked text[] := '{}';
  v_badges text[] := '{}';
begin
  v_prof := private.require_profile(p_profile);
  -- Una partida por vez por perfil (evita carreras entre envíos simultáneos).
  perform 1 from public.profiles where id = p_profile for update;

  if p_run is null or jsonb_typeof(p_run) <> 'object' then raise exception 'invalid_payload'; end if;
  v_client_id := private.jtext(p_run, 'clientRunId', 64);
  if v_client_id is null or v_client_id !~ '^[A-Za-z0-9._-]{6,64}$' then
    raise exception 'invalid_payload' using detail = 'clientRunId';
  end if;

  -- Reenvío de la misma partida (por ejemplo, tras un corte de conexión).
  select * into v_existing from public.runs where profile_id = p_profile and client_run_id = v_client_id;
  if found then return private.run_result(v_existing, true); end if;

  if (select count(*) from public.runs where account_id = v_prof.account_id and created_at > now() - interval '5 minutes') >= 40 then
    raise exception 'rate_limited';
  end if;

  select * into v_rules from public.game_rules where id = 1;
  select * into v_lvl from public.game_levels where id = private.jtext(p_run, 'levelId', 64) and active;
  if not found then raise exception 'invalid_payload' using detail = 'levelId'; end if;
  v_mode := private.jtext(p_run, 'mode', 16);
  if v_mode is null or v_mode not in ('normal', 'timeTrial') then raise exception 'invalid_payload' using detail = 'mode'; end if;
  v_char := private.jtext(p_run, 'characterId', 64);
  if v_char is null or not exists (select 1 from public.game_characters where id = v_char and playable) then
    raise exception 'invalid_payload' using detail = 'characterId';
  end if;
  v_completed := private.jbool(p_run, 'completed');
  v_score := private.jint(p_run, 'score');
  if v_completed is null or v_score is null then raise exception 'invalid_payload' using detail = 'completed/score'; end if;

  v_time := private.jint(p_run, 'timeMs');
  v_start_time := greatest(0, coalesce(private.jint(p_run, 'startTimeMs'), 0));
  v_client_assisted := coalesce(private.jbool(p_run, 'assisted'), false);
  v_continues := greatest(0, least(coalesce(private.jint(p_run, 'continues'), 0), 99));
  v_start := greatest(0, least(coalesce(private.jint(p_run, 'startBlock'), 0), v_lvl.blocks - 1));
  v_blocks := greatest(0, least(coalesce(private.jint(p_run, 'blocksCompleted'), 0), v_lvl.blocks));
  v_shoes := greatest(0, least(coalesce(private.jint(p_run, 'shoesLeft'), 0), 3));
  v_parent_id := private.jtext(p_run, 'parentRunId', 64);

  if jsonb_typeof(p_run -> 'assistReasons') = 'array' then
    select coalesce(array_agg(distinct x order by x), '{}') into v_assist_reasons
    from jsonb_array_elements_text(p_run -> 'assistReasons') as x
    where x in ('checkpoint', 'debug');
  end if;
  -- Retomar desde una esquina siempre es una partida asistida.
  v_assisted := v_client_assisted or v_continues > 0 or v_start > 0;
  if (v_continues > 0 or v_start > 0) and not ('checkpoint' = any (v_assist_reasons)) then
    v_assist_reasons := v_assist_reasons || 'checkpoint'::text;
  end if;
  if not v_client_assisted and (v_continues > 0 or v_start > 0) then
    v_soft := v_soft || 'assist_inconsistent'::text;
  end if;
  v_flawless := v_completed and v_shoes = 3 and v_continues = 0;

  -- Personaje y progresión según el progreso guardado en el servidor.
  if not exists (select 1 from public.profile_characters where profile_id = p_profile and character_id = v_char) then
    v_hard := v_hard || 'character_locked'::text;
  end if;
  if v_mode = 'normal' then
    if not private.level_unlocked(p_profile, v_lvl.id) then v_hard := v_hard || 'level_locked'::text; end if;
  elsif not exists (select 1 from public.profile_levels where profile_id = p_profile and level_id = v_lvl.id and completed) then
    v_hard := v_hard || 'level_locked'::text;
  end if;

  -- Tiempo.
  if v_completed then
    if v_time is null then
      v_hard := v_hard || 'time_missing'::text;
    elsif v_time < v_lvl.min_time_ms then
      v_hard := v_hard || 'time_impossible'::text;
    elsif v_time > 10800000 then
      v_hard := v_hard || 'time_invalid'::text;
    end if;
    if v_blocks <> v_lvl.blocks then
      v_soft := v_soft || 'blocks_incoherent'::text;
      v_blocks := v_lvl.blocks;
    end if;
  elsif v_time is not null and (v_time < 0 or v_time > 10800000) then
    v_time := null;
    v_notes := v_notes || 'time_dropped'::text;
  end if;
  v_start_time := least(v_start_time, coalesce(v_time, 0));
  v_att_time := greatest(0, coalesce(v_time, 0) - v_start_time);

  -- Puntaje: nunca más que el máximo teórico del nivel.
  if v_score < 0 or v_score > v_lvl.max_score then
    v_hard := v_hard || 'score_impossible'::text;
  end if;

  -- Desglose del puntaje.
  v_bd := case when jsonb_typeof(p_run -> 'breakdown') = 'object' then p_run -> 'breakdown' end;
  if v_bd is null then
    v_soft := v_soft || 'breakdown_missing'::text;
  else
    v_dist := coalesce(private.jint(v_bd, 'distance'), -1);
    v_dodge := coalesce(private.jint(v_bd, 'dodge'), -1);
    v_bonus := coalesce(private.jint(v_bd, 'bonus'), -1);
    v_pen := coalesce(private.jint(v_bd, 'penalty'), -1);
    v_speed := coalesce(private.jint(v_bd, 'speed'), 0);
    if least(v_dist, v_dodge, v_bonus, v_pen) < 0 then
      v_soft := v_soft || 'breakdown_invalid'::text;
    else
      if v_dist + v_dodge + v_bonus - v_pen <> v_score then v_soft := v_soft || 'breakdown_mismatch'::text; end if;
      if v_dist > v_lvl.max_distance_points then v_soft := v_soft || 'distance_high'::text; end if;
      if v_dodge > v_lvl.max_dodge_points then v_soft := v_soft || 'dodge_high'::text; end if;
      if v_bonus > v_lvl.max_bonus_points then v_soft := v_soft || 'bonus_high'::text; end if;
    end if;
    v_expected_speed := case
      when v_completed and v_mode = 'normal' and not v_assisted and v_time is not null then private.speed_bonus(v_time, v_lvl.id)
      else 0 end;
    if v_speed <> v_expected_speed then v_soft := v_soft || 'speed_bonus_mismatch'::text; end if;
  end if;

  -- Contadores de la partida (totales) y de este intento (lo que se acredita).
  v_counts := case when jsonb_typeof(p_run -> 'counts') = 'object' then p_run -> 'counts' else '{}'::jsonb end;
  v_attempt := case when jsonb_typeof(p_run -> 'attempt') = 'object' then p_run -> 'attempt' else '{}'::jsonb end;
  v_dodged := greatest(0, coalesce(private.jint(v_counts, 'dodged'), 0));
  v_streak := greatest(0, coalesce(private.jint(v_counts, 'bestStreak'), 0));
  v_cross := greatest(0, coalesce(private.jint(v_counts, 'crossings'), 0));
  v_missions := greatest(0, coalesce(private.jint(v_counts, 'missions'), 0));
  v_att_dodged := greatest(0, coalesce(private.jint(v_attempt, 'dodged'), 0));
  v_att_cross := greatest(0, coalesce(private.jint(v_attempt, 'crossings'), 0));
  v_att_car := greatest(0, least(coalesce(private.jint(v_attempt, 'carHits'), 0), 50));
  v_att_missions := greatest(0, coalesce(private.jint(v_attempt, 'missions'), 0));
  v_att_coins := greatest(0, coalesce(private.jint(v_attempt, 'coinsBanked'), 0));
  if v_dodged > v_lvl.dodgeables or v_att_dodged > v_lvl.dodgeables then
    v_soft := v_soft || 'dodges_high'::text;
  end if;
  if v_streak > v_lvl.dodgeables then
    v_soft := v_soft || 'streak_high'::text;
  end if;
  -- Cada sorete esquivado vale como máximo lo del mejor combo con "por un pelo".
  if v_bd is not null and v_dodge > v_dodged * (v_lvl.max_dodge_points / greatest(v_lvl.dodgeables, 1)) then
    v_soft := v_soft || 'dodge_points_incoherent'::text;
  end if;
  if v_cross > v_lvl.crossings or v_att_cross > v_lvl.crossings then
    v_soft := v_soft || 'crossings_high'::text;
  end if;
  if v_missions > 1 or v_att_missions > 1 or (v_lvl.mission_id is null and greatest(v_missions, v_att_missions) > 0) then
    v_soft := v_soft || 'missions_high'::text;
  end if;
  v_att_dodged := least(v_att_dodged, v_lvl.dodgeables);
  v_att_cross := least(v_att_cross, v_lvl.crossings);
  v_att_missions := least(v_att_missions, case when v_lvl.mission_id is null then 0 else 1 end);
  v_streak := least(v_streak, v_lvl.dodgeables);

  -- Monedas: las del nivel y, si entregó la misión, su premio (y el bonus
  -- de primera vez si todavía no lo cobró en el servidor).
  if v_lvl.mission_id is not null and v_att_missions > 0 then
    v_mission_key := v_lvl.mission_id || '@' || v_lvl.id;
    v_first_unclaimed := not exists (
      select 1 from public.profile_mission_rewards where profile_id = p_profile and mission_key = v_mission_key);
  end if;
  v_coins_cap := v_lvl.coins + case
    when v_att_missions > 0 then v_lvl.mission_coins + case when v_first_unclaimed then v_lvl.mission_first_bonus else 0 end
    else 0 end;
  if v_att_coins > v_coins_cap then v_soft := v_soft || 'coins_high'::text; end if;

  -- Logros del intento, cada uno con su tope para este nivel.
  if jsonb_typeof(v_attempt -> 'achievements') = 'object' then
    for v_key, v_x in select key, value from jsonb_each(v_attempt -> 'achievements') loop
      if not exists (select 1 from public.game_achievements where id = v_key) or jsonb_typeof(v_x) <> 'number' then
        continue;
      end if;
      v_value := greatest(0, round((v_x #>> '{}')::numeric)::int);
      v_cap := private.achievement_cap(v_key, v_lvl, v_completed, v_flawless);
      if v_value > v_cap then
        if not ('achievements_high' = any (v_soft)) then v_soft := v_soft || 'achievements_high'::text; end if;
        v_value := v_cap;
      end if;
      if v_value > 0 then v_ach_credit := v_ach_credit || jsonb_build_object(v_key, v_value); end if;
    end loop;
  end if;

  -- Parciales en cada esquina: crecientes y dentro del tiempo total.
  if jsonb_typeof(p_run -> 'splits') = 'array' then
    for v_x in select value from jsonb_array_elements(p_run -> 'splits') loop
      if jsonb_typeof(v_x) <> 'number' or coalesce(array_length(v_splits, 1), 0) >= v_lvl.blocks then
        v_soft := v_soft || 'splits_incoherent'::text;
        exit;
      end if;
      v_value := round((v_x #>> '{}')::numeric)::int;
      if v_value <= v_prev or (v_time is not null and v_value > v_time) then
        v_soft := v_soft || 'splits_incoherent'::text;
        exit;
      end if;
      v_splits := v_splits || v_value;
      v_prev := v_value;
    end loop;
  end if;

  -- Fecha de la partida según el dispositivo (sólo para mostrar).
  begin
    v_played := (p_run ->> 'playedAt')::timestamptz;
  exception when others then
    v_played := null;
  end;
  if v_played is null or v_played > now() + interval '10 minutes' or v_played < now() - interval '30 days' then
    v_played := now();
    v_notes := v_notes || 'clock_adjusted'::text;
  end if;

  v_events := case when p_run ? 'events' and char_length((p_run -> 'events')::text) <= 16384 then p_run -> 'events' end;

  v_status := case
    when cardinality(v_hard) > 0 then 'rejected'
    when cardinality(v_soft) > 0 then 'suspicious'
    else 'valid' end;
  v_official := v_status = 'valid' and v_completed and not v_assisted;

  -- Recompensas (nada si la partida es imposible).
  if v_status <> 'rejected' then
    v_coins_credit := least(v_att_coins, v_coins_cap);
    if v_first_unclaimed then
      insert into public.profile_mission_rewards (profile_id, mission_key) values (p_profile, v_mission_key);
    end if;

    if v_completed and v_mode = 'normal' then
      v_stars := private.stars_for(v_score, v_lvl.stars_two, v_lvl.stars_three);
      select * into v_prev_level from public.profile_levels where profile_id = p_profile and level_id = v_lvl.id;
      v_first_completion := not coalesce(v_prev_level.completed, false);
      v_new_stars := greatest(0, v_stars - coalesce(v_prev_level.stars, 0));
      v_star_coins := v_new_stars * v_rules.coins_per_new_star;
      insert into public.profile_levels as pl (profile_id, level_id, completed, stars, best_score, plays, source, first_completed_at)
      values (p_profile, v_lvl.id, true, v_stars, v_score, 1, 'game', now())
      on conflict (profile_id, level_id) do update set
        completed = true,
        stars = greatest(pl.stars, excluded.stars),
        best_score = greatest(pl.best_score, excluded.best_score),
        plays = pl.plays + 1,
        source = 'game',
        first_completed_at = coalesce(pl.first_completed_at, now());
      if v_first_completion and private.barrio_completed(p_profile, v_lvl.barrio_id) then
        insert into public.profile_badges (profile_id, badge_id) values (p_profile, 'barrio:' || v_lvl.barrio_id) on conflict do nothing;
        if found then v_badges := v_badges || ('barrio:' || v_lvl.barrio_id); end if;
      end if;
    end if;

    for v_key, v_x in select key, value from jsonb_each(v_ach_credit) loop
      insert into public.profile_achievements as a (profile_id, achievement_id, count)
      values (p_profile, v_key, (v_x #>> '{}')::int)
      on conflict (profile_id, achievement_id) do update set count = a.count + excluded.count;
    end loop;

    update public.profile_stats set
      coins = coins + v_coins_credit + v_star_coins,
      coins_earned = coins_earned + v_coins_credit + v_star_coins,
      runs_played = runs_played + 1,
      runs_completed = runs_completed + case when v_completed then 1 else 0 end,
      levels_completed = levels_completed + case when v_first_completion then 1 else 0 end,
      crossings = crossings + v_att_cross,
      car_hits = car_hits + v_att_car,
      poops_dodged = poops_dodged + v_att_dodged,
      play_time_ms = play_time_ms + v_att_time,
      best_streak = greatest(best_streak, v_streak),
      updated_at = now()
    where profile_id = p_profile;

    v_unlocked := private.refresh_unlocks(p_profile, 'challenge');
    v_badges := v_badges || array(select 'char:' || u from unnest(v_unlocked) as u);
  end if;

  insert into public.runs (
    profile_id, account_id, client_run_id, parent_client_run_id, nickname, level_id, barrio_id, mode, character_id,
    completed, time_ms, score, assisted, assist_reasons, continues, start_block, blocks_completed, shoes_left,
    details, splits, event_log, rewards, source, status, status_reasons, official, client_version, played_at)
  values (
    p_profile, v_prof.account_id, v_client_id, v_parent_id, v_prof.nickname, v_lvl.id, v_lvl.barrio_id, v_mode, v_char,
    v_completed, v_time, v_score, v_assisted, v_assist_reasons, v_continues, v_start, v_blocks, v_shoes,
    jsonb_build_object('breakdown', v_bd, 'counts', v_counts, 'attempt', v_attempt),
    v_splits, v_events,
    jsonb_build_object('coins', v_coins_credit, 'starCoins', v_star_coins, 'newStars', v_new_stars, 'stars', v_stars,
                       'firstCompletion', v_first_completion, 'achievements', v_ach_credit,
                       'unlockedCharacters', to_jsonb(v_unlocked), 'badges', to_jsonb(v_badges)),
    'game', v_status, v_hard || v_soft || v_notes, v_official,
    private.jtext(p_run, 'clientVersion', 20), v_played)
  returning * into v_run;

  -- Desafíos aceptados que esta partida supera (etapa 2).
  if v_official then
    update public.challenges set status = 'completed', result_run_id = v_run.id
    where to_profile = p_profile and status = 'accepted' and expires_at > now()
      and level_id = v_lvl.id and mode = v_mode
      and ((kind = 'time' and v_time < target_value) or (kind = 'score' and v_score > target_value));
  end if;

  return private.run_result(v_run, false);
end $$;

-- Historial de partidas de un perfil propio (las más recientes primero).
create function public.get_my_runs(p_profile uuid, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_profile(p_profile);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'runId', r.id, 'clientRunId', r.client_run_id, 'levelId', r.level_id, 'mode', r.mode,
      'characterId', r.character_id, 'completed', r.completed, 'timeMs', r.time_ms, 'score', r.score,
      'assisted', r.assisted, 'status', r.status, 'reasons', to_jsonb(r.status_reasons),
      'official', r.official, 'source', r.source, 'playedAt', r.played_at, 'rewards', r.rewards
    ) order by r.created_at desc, r.id)
    from (
      select * from public.runs
      where profile_id = p_profile
      order by created_at desc, id
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    ) r
  ), '[]'::jsonb);
end $$;

-- Récords personales por nivel y modalidad: mejor tiempo oficial, mejor
-- puntaje verificado y, aparte, las marcas importadas (no verificadas).
create function public.get_personal_records(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_profile(p_profile);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'levelId', k.level_id,
      'mode', k.mode,
      'bestTime', (
        select jsonb_build_object('timeMs', r.time_ms, 'characterId', r.character_id, 'playedAt', r.played_at)
        from public.runs r where r.profile_id = p_profile and r.level_id = k.level_id and r.mode = k.mode and r.official
        order by r.time_ms, r.score desc, r.played_at limit 1),
      'bestScore', (
        select jsonb_build_object('score', r.score, 'characterId', r.character_id, 'assisted', r.assisted, 'playedAt', r.played_at)
        from public.runs r where r.profile_id = p_profile and r.level_id = k.level_id and r.mode = k.mode
          and r.status = 'valid' and r.completed
        order by r.score desc, r.time_ms nulls last, r.played_at limit 1),
      'unverifiedTime', (
        select jsonb_build_object('timeMs', r.time_ms, 'characterId', r.character_id, 'playedAt', r.played_at)
        from public.runs r where r.profile_id = p_profile and r.level_id = k.level_id and r.mode = k.mode
          and r.status = 'unverified' and r.time_ms is not null and not r.assisted
        order by r.time_ms limit 1),
      'unverifiedScore', (
        select jsonb_build_object('score', r.score, 'characterId', r.character_id, 'playedAt', r.played_at)
        from public.runs r where r.profile_id = p_profile and r.level_id = k.level_id and r.mode = k.mode
          and r.status = 'unverified'
        order by r.score desc limit 1)
    ) order by k.level_id, k.mode)
    from (
      select distinct level_id, mode from public.runs
      where profile_id = p_profile and status in ('valid', 'unverified') and completed
    ) k
  ), '[]'::jsonb);
end $$;

-- =====================================================================
-- 9. Rankings y perfiles públicos (RPC; también para invitados)
-- =====================================================================

-- p_kind: 'speed' (menor tiempo), 'score' (mayor puntaje) o 'character'
-- (mejor tiempo de cada personaje). p_scope: 'global' o 'friends'.
-- Sólo partidas oficiales (válidas, completas y sin ayudas), una marca por
-- perfil, sin perfiles ocultos de los rankings, suspendidos o bloqueados.
create function public.get_leaderboard(
  p_level text,
  p_mode text,
  p_kind text,
  p_scope text default 'global',
  p_viewer uuid default null,
  p_limit int default 10
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_viewer uuid;
  v_limit int := greatest(1, least(coalesce(p_limit, 10), 50));
  v_rows jsonb;
  v_me jsonb;
begin
  if p_mode not in ('normal', 'timeTrial') or p_kind not in ('speed', 'score', 'character') or p_scope not in ('global', 'friends') then
    raise exception 'invalid_payload';
  end if;
  if p_viewer is not null and private.owns_profile(p_viewer) then v_viewer := p_viewer; end if;
  if p_scope = 'friends' and v_viewer is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'me', null);
  end if;

  with eligible as (
    select r.id, r.profile_id, r.character_id, r.time_ms, r.score, r.played_at, p.nickname, p.avatar_id
    from public.runs r
    join public.profiles p on p.id = r.profile_id
    join public.accounts a on a.id = p.account_id
    where r.official and r.level_id = p_level and r.mode = p_mode
      and p.show_in_rankings and a.banned_at is null
      and (v_viewer is null or not private.blocked_between(v_viewer, p.id))
      and (p_scope = 'global' or p.id = v_viewer or private.are_friends(v_viewer, p.id))
  ),
  best as (
    select distinct on (case when p_kind = 'character' then e.character_id else e.profile_id::text end) e.*
    from eligible e
    order by case when p_kind = 'character' then e.character_id else e.profile_id::text end,
             case when p_kind = 'score' then -e.score else e.time_ms end,
             case when p_kind = 'score' then e.time_ms else -e.score end,
             e.played_at, e.id
  ),
  ranked as (
    select row_number() over (
             order by case when p_kind = 'score' then -b.score else b.time_ms end,
                      case when p_kind = 'score' then b.time_ms else -b.score end,
                      b.played_at, b.id) as rank,
           b.*
    from best b
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', x.rank, 'profileId', x.profile_id, 'nickname', x.nickname, 'avatarId', x.avatar_id,
        'characterId', x.character_id, 'timeMs', x.time_ms, 'score', x.score, 'playedAt', x.played_at,
        'isMe', x.profile_id = v_viewer,
        'isFriend', v_viewer is not null and private.are_friends(v_viewer, x.profile_id)
      ) order by x.rank)
      from ranked x where x.rank <= v_limit
    ), '[]'::jsonb),
    (
      select jsonb_build_object(
        'rank', x.rank, 'profileId', x.profile_id, 'nickname', x.nickname, 'avatarId', x.avatar_id,
        'characterId', x.character_id, 'timeMs', x.time_ms, 'score', x.score, 'playedAt', x.played_at,
        'isMe', true, 'isFriend', false)
      from ranked x where x.profile_id = v_viewer
      order by x.rank limit 1
    )
  into v_rows, v_me;

  return jsonb_build_object('rows', v_rows, 'me', v_me);
end $$;

-- Ficha pública de un perfil, según su privacidad. Nunca incluye datos de
-- la cuenta (ni email, ni a qué cuenta pertenece).
create function public.get_public_profile(p_profile uuid, p_viewer uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.profiles;
  v_viewer uuid;
  v_owner boolean;
  v_friend boolean := false;
  v_full boolean;
  v_friend_status text := 'none';
  v_blocked_by_me boolean := false;
begin
  select * into v from public.profiles where id = p_profile;
  if not found or exists (select 1 from public.accounts where id = v.account_id and banned_at is not null) then
    raise exception 'profile_not_found';
  end if;
  if p_viewer is not null and private.owns_profile(p_viewer) then v_viewer := p_viewer; end if;
  v_owner := v.account_id = auth.uid();
  if v_viewer is not null and not v_owner then
    if exists (select 1 from public.blocks where blocker_id = v.id and blocked_id = v_viewer) then
      raise exception 'profile_not_found';
    end if;
    v_blocked_by_me := exists (select 1 from public.blocks where blocker_id = v_viewer and blocked_id = v.id);
    v_friend := private.are_friends(v_viewer, v.id);
    select case
      when f.status = 'accepted' then 'friends'
      when f.requester_id = v_viewer then 'outgoing'
      else 'incoming' end
    into v_friend_status
    from public.friendships f
    where (f.requester_id = v_viewer and f.addressee_id = v.id) or (f.requester_id = v.id and f.addressee_id = v_viewer);
    v_friend_status := coalesce(v_friend_status, 'none');
  end if;
  v_full := v_owner or (not v_blocked_by_me and (v.visibility = 'public' or (v.visibility = 'friends' and v_friend)));

  return jsonb_build_object(
    'profileId', v.id,
    'nickname', v.nickname,
    'avatarId', v.avatar_id,
    'visibility', v.visibility,
    'limited', not v_full,
    'supervised', case when v_owner then v.supervised else null end,
    'socialEnabled', v.social_enabled,
    'friendStatus', v_friend_status,
    'blockedByMe', v_blocked_by_me,
    'favoriteCharacter', case when v_full then v.favorite_character end,
    'memberSince', case when v_full then v.created_at end,
    'stats', case when v_full then (
      select jsonb_build_object('levelsCompleted', s.levels_completed, 'runsCompleted', s.runs_completed,
                                'poopsDodged', s.poops_dodged, 'bestStreak', s.best_streak)
      from public.profile_stats s where s.profile_id = v.id) end,
    'badges', case when v_full then coalesce((
      select jsonb_agg(b.badge_id order by b.earned_at, b.badge_id) from public.profile_badges b where b.profile_id = v.id
    ), '[]'::jsonb) end,
    'characters', case when v_full then coalesce((
      select jsonb_agg(c.character_id order by c.unlocked_at, c.character_id) from public.profile_characters c where c.profile_id = v.id
    ), '[]'::jsonb) end
  );
end $$;

-- Buscar un perfil por apodo exacto (para agregar amigos).
create function public.find_profile(p_nickname text, p_viewer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.profiles;
begin
  perform private.require_profile(p_viewer);
  select * into v from public.profiles where nickname_key = private.nickname_key(p_nickname);
  if not found or v.id = p_viewer or private.blocked_between(p_viewer, v.id) then
    return null;
  end if;
  return private.profile_card(v.id);
end $$;

-- =====================================================================
-- 10. Importación del progreso local (no verificado)
-- =====================================================================

-- Una sola vez por perfil. Todo lo importado queda marcado como no
-- verificado: cuenta para la campaña y los récords personales, nunca para
-- los rankings oficiales. Los valores se recortan a lo posible.
create function public.import_local_progress(p_profile uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
  v_rules public.game_rules;
  v_lvl public.game_levels;
  v_in jsonb;
  v_plays int;
  v_stars int;
  v_best int;
  v_key text;
  v_x jsonb;
  v_cap int;
  v_value int;
  v_coins int;
  v_coins_cap int := 0;
  v_rec jsonb;
  v_rec_level public.game_levels;
  v_rec_time int;
  v_rec_score int;
  v_rec_mode text;
  v_rec_char text;
  v_rec_id text;
  v_rec_date timestamptz;
  v_records int := 0;
begin
  v := private.require_profile(p_profile);
  if v.imported_at is not null then raise exception 'already_imported'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload'; end if;
  select * into v_rules from public.game_rules where id = 1;

  -- Niveles, en el orden de la campaña: sólo se acepta un nivel completo si
  -- ya estaba desbloqueado (así el progreso importado es coherente).
  if jsonb_typeof(p_payload -> 'levels') = 'object' then
    for v_lvl in
      select gl.* from public.game_levels gl join public.game_barrios gb on gb.id = gl.barrio_id
      where gl.active order by gb.sort_order, gl.level_index
    loop
      v_in := p_payload -> 'levels' -> v_lvl.id;
      if v_in is null or jsonb_typeof(v_in) <> 'object' or private.jbool(v_in, 'completed') is distinct from true then continue; end if;
      if not private.level_unlocked(p_profile, v_lvl.id) then continue; end if;
      v_plays := greatest(1, least(coalesce(private.jint(v_in, 'plays'), 1), 999));
      v_stars := greatest(1, least(coalesce(private.jint(v_in, 'stars'), 1), 3));
      v_best := greatest(0, least(coalesce(private.jint(v_in, 'bestScore'), 0), v_lvl.max_score));
      insert into public.profile_levels as pl (profile_id, level_id, completed, stars, best_score, plays, source, first_completed_at)
      values (p_profile, v_lvl.id, true, v_stars, v_best, v_plays, 'import', now())
      on conflict (profile_id, level_id) do update set
        completed = true,
        stars = greatest(pl.stars, excluded.stars),
        best_score = greatest(pl.best_score, excluded.best_score),
        plays = greatest(pl.plays, excluded.plays),
        first_completed_at = coalesce(pl.first_completed_at, now());
      v_coins_cap := v_coins_cap + (v_lvl.coins + v_lvl.mission_coins + v_lvl.mission_first_bonus + 3 * v_rules.coins_per_new_star) * least(v_plays, 10);
    end loop;
  end if;

  -- Logros: cada contador, hasta lo que se puede juntar en los niveles importados.
  if jsonb_typeof(p_payload -> 'achievements') = 'object' then
    for v_key, v_x in select key, value from jsonb_each(p_payload -> 'achievements') loop
      if not exists (select 1 from public.game_achievements where id = v_key) or jsonb_typeof(v_x) <> 'number' then continue; end if;
      select coalesce(sum(private.achievement_cap(v_key, gl, true, true) * pl.plays), 0)::int into v_cap
      from public.profile_levels pl join public.game_levels gl on gl.id = pl.level_id
      where pl.profile_id = p_profile and pl.completed;
      v_value := greatest(0, least(round((v_x #>> '{}')::numeric)::int, v_cap));
      if v_value > 0 then
        insert into public.profile_achievements as a (profile_id, achievement_id, count)
        values (p_profile, v_key, v_value)
        on conflict (profile_id, achievement_id) do update set count = greatest(a.count, excluded.count);
      end if;
    end loop;
  end if;

  -- Premios de primera vez de misiones de niveles completos.
  if jsonb_typeof(p_payload -> 'missionRewards') = 'array' then
    insert into public.profile_mission_rewards (profile_id, mission_key)
    select distinct p_profile, k
    from jsonb_array_elements_text(p_payload -> 'missionRewards') as k
    join public.game_levels gl on gl.mission_id is not null and k = gl.mission_id || '@' || gl.id
    join public.profile_levels pl on pl.profile_id = p_profile and pl.level_id = gl.id and pl.completed
    on conflict do nothing;
  end if;

  -- Monedas, con tope según lo que se pudo ganar en esos niveles.
  v_coins := least(greatest(0, coalesce(private.jint(p_payload, 'coins'), 0)), v_coins_cap);

  -- Récords del dispositivo: quedan como partidas no verificadas.
  if jsonb_typeof(p_payload -> 'records') = 'array' then
    for v_rec in select value from jsonb_array_elements(p_payload -> 'records') limit 60 loop
      if jsonb_typeof(v_rec) <> 'object' then continue; end if;
      select * into v_rec_level from public.game_levels where id = private.jtext(v_rec, 'levelId', 64) and active;
      if not found then continue; end if;
      v_rec_mode := private.jtext(v_rec, 'mode', 16);
      if v_rec_mode is null or v_rec_mode not in ('normal', 'timeTrial') then continue; end if;
      v_rec_char := private.jtext(v_rec, 'characterId', 64);
      if v_rec_char is null or not exists (select 1 from public.game_characters where id = v_rec_char) then
        v_rec_char := (select id from public.game_characters where starter order by id limit 1);
      end if;
      v_rec_score := private.jint(v_rec, 'score');
      if v_rec_score is null or v_rec_score < 0 or v_rec_score > v_rec_level.max_score then continue; end if;
      v_rec_time := private.jint(v_rec, 'timeMs');
      if v_rec_time is not null and (v_rec_time < v_rec_level.min_time_ms or v_rec_time > 10800000) then v_rec_time := null; end if;
      v_rec_id := private.jtext(v_rec, 'id', 56);
      if v_rec_id is null or v_rec_id !~ '^[A-Za-z0-9._-]{1,56}$' then continue; end if;
      begin
        v_rec_date := (v_rec ->> 'date')::timestamptz;
      exception when others then
        v_rec_date := null;
      end;
      if v_rec_date is null or v_rec_date > now() then v_rec_date := now(); end if;
      insert into public.runs (
        profile_id, account_id, client_run_id, nickname, level_id, barrio_id, mode, character_id, completed,
        time_ms, score, assisted, assist_reasons, source, status, status_reasons, official, played_at)
      values (
        p_profile, v.account_id, 'import-' || v_rec_id, v.nickname, v_rec_level.id, v_rec_level.barrio_id, v_rec_mode, v_rec_char, true,
        v_rec_time, v_rec_score, coalesce(private.jbool(v_rec, 'assisted'), false), '{}', 'import', 'unverified', array['imported'], false, v_rec_date)
      on conflict (profile_id, client_run_id) do nothing;
      if found then v_records := v_records + 1; end if;
    end loop;
  end if;

  update public.profile_stats set
    coins = coins + v_coins,
    coins_earned = coins_earned + v_coins,
    levels_completed = (select count(*) from public.profile_levels where profile_id = p_profile and completed),
    updated_at = now()
  where profile_id = p_profile;
  perform private.refresh_unlocks(p_profile, 'import');
  update public.profiles set imported_at = now(), updated_at = now() where id = p_profile;

  return private.profile_state(p_profile) || jsonb_build_object('imported', jsonb_build_object('coins', v_coins, 'records', v_records));
end $$;

-- =====================================================================
-- 11. Bloqueos y reportes (desde la etapa 1)
-- =====================================================================

create function public.block_profile(p_me uuid, p_other uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  if p_other is null or p_other = p_me or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'profile_not_found';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (p_me, p_other) on conflict do nothing;
  -- Bloquear corta la amistad, las solicitudes y los desafíos entre los dos.
  delete from public.friendships
  where (requester_id = p_me and addressee_id = p_other) or (requester_id = p_other and addressee_id = p_me);
  update public.challenges set status = 'cancelled', responded_at = now()
  where status in ('pending', 'accepted')
    and ((from_profile = p_me and to_profile = p_other) or (from_profile = p_other and to_profile = p_me));
  return true;
end $$;

create function public.unblock_profile(p_me uuid, p_other uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  delete from public.blocks where blocker_id = p_me and blocked_id = p_other;
  return true;
end $$;

create function public.get_blocked(p_me uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  return coalesce((
    select jsonb_agg(private.profile_card(b.blocked_id) order by b.created_at)
    from public.blocks b where b.blocker_id = p_me
  ), '[]'::jsonb);
end $$;

-- Reportar un apodo inapropiado (lo revisa un moderador desde el panel).
create function public.report_profile(p_me uuid, p_other uuid, p_reason text, p_details text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_nick text;
begin
  perform private.require_profile(p_me);
  if p_reason not in ('nickname', 'behavior', 'other') then raise exception 'invalid_payload'; end if;
  select nickname into v_nick from public.profiles where id = p_other;
  if v_nick is null or p_other = p_me then raise exception 'profile_not_found'; end if;
  if (select count(*) from public.reports where reporter_id = p_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.reports where reporter_id = p_me and reported_id = p_other and reason = p_reason and status = 'open') then
    return true;
  end if;
  insert into public.reports (reporter_id, reported_id, reason, details, nickname_snapshot)
  values (p_me, p_other, p_reason, left(nullif(btrim(coalesce(p_details, '')), ''), 200), v_nick);
  return true;
end $$;

-- =====================================================================
-- 12. Amistades y desafíos (etapa 2: el servidor ya los soporta)
-- =====================================================================

create function private.require_social(p_profile uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_profile and social_enabled) then
    raise exception 'social_disabled';
  end if;
end $$;

create function public.send_friend_request(p_me uuid, p_other uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.friendships;
begin
  perform private.require_profile(p_me);
  if p_other is null or p_other = p_me or not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'profile_not_found';
  end if;
  perform private.require_social(p_me);
  perform private.require_social(p_other);
  if private.blocked_between(p_me, p_other) then raise exception 'blocked'; end if;
  select * into v_row from public.friendships
  where (requester_id = p_me and addressee_id = p_other) or (requester_id = p_other and addressee_id = p_me);
  if found then
    if v_row.status = 'accepted' then return 'friends'; end if;
    if v_row.requester_id = p_other then
      -- Los dos quieren ser amigos: se acepta directamente.
      update public.friendships set status = 'accepted', responded_at = now()
      where requester_id = p_other and addressee_id = p_me;
      return 'friends';
    end if;
    return 'pending';
  end if;
  if (select count(*) from public.friendships where requester_id = p_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  insert into public.friendships (requester_id, addressee_id) values (p_me, p_other);
  return 'pending';
end $$;

create function public.respond_friend_request(p_me uuid, p_other uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  if not exists (select 1 from public.friendships where requester_id = p_other and addressee_id = p_me and status = 'pending') then
    raise exception 'request_not_found';
  end if;
  if p_accept then
    perform private.require_social(p_me);
    update public.friendships set status = 'accepted', responded_at = now() where requester_id = p_other and addressee_id = p_me;
    return 'friends';
  end if;
  delete from public.friendships where requester_id = p_other and addressee_id = p_me;
  return 'none';
end $$;

create function public.remove_friend(p_me uuid, p_other uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  delete from public.friendships
  where (requester_id = p_me and addressee_id = p_other) or (requester_id = p_other and addressee_id = p_me);
  return true;
end $$;

create function public.get_friends(p_me uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(private.profile_card(case when f.requester_id = p_me then f.addressee_id else f.requester_id end)
                       || jsonb_build_object('since', f.responded_at) order by f.responded_at)
      from public.friendships f
      where f.status = 'accepted' and (f.requester_id = p_me or f.addressee_id = p_me)
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(private.profile_card(f.requester_id) || jsonb_build_object('since', f.created_at) order by f.created_at)
      from public.friendships f where f.status = 'pending' and f.addressee_id = p_me
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(private.profile_card(f.addressee_id) || jsonb_build_object('since', f.created_at) order by f.created_at)
      from public.friendships f where f.status = 'pending' and f.requester_id = p_me
    ), '[]'::jsonb)
  );
end $$;

-- Desafío a un amigo: superar mi mejor marca oficial en un nivel.
create function public.create_challenge(p_me uuid, p_other uuid, p_level text, p_mode text, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_best public.runs;
  v_id uuid;
begin
  perform private.require_profile(p_me);
  perform private.require_social(p_me);
  perform private.require_social(p_other);
  if p_mode not in ('normal', 'timeTrial') or p_kind not in ('time', 'score') then raise exception 'invalid_payload'; end if;
  if not private.are_friends(p_me, p_other) then raise exception 'not_friends'; end if;
  if (select count(*) from public.challenges where from_profile = p_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  select * into v_best from public.runs
  where profile_id = p_me and level_id = p_level and mode = p_mode and official
  order by case when p_kind = 'time' then time_ms else -score end, played_at
  limit 1;
  if not found then raise exception 'no_official_record'; end if;
  insert into public.challenges (from_profile, to_profile, level_id, mode, kind, target_value, target_run_id, expires_at)
  values (p_me, p_other, p_level, p_mode, p_kind, case when p_kind = 'time' then v_best.time_ms else v_best.score end,
          v_best.id, now() + interval '7 days')
  returning id into v_id;
  return jsonb_build_object('challengeId', v_id, 'targetValue', case when p_kind = 'time' then v_best.time_ms else v_best.score end);
end $$;

create function public.respond_challenge(p_me uuid, p_challenge uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  update public.challenges
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_challenge and to_profile = p_me and status = 'pending' and expires_at > now();
  if not found then raise exception 'challenge_not_found'; end if;
  return case when p_accept then 'accepted' else 'declined' end;
end $$;

create function public.get_challenges(p_me uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_profile(p_me);
  update public.challenges set status = 'expired'
  where (from_profile = p_me or to_profile = p_me) and status in ('pending', 'accepted') and expires_at <= now();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'challengeId', c.id, 'levelId', c.level_id, 'mode', c.mode, 'kind', c.kind, 'targetValue', c.target_value,
      'status', c.status, 'expiresAt', c.expires_at, 'incoming', c.to_profile = p_me,
      'other', private.profile_card(case when c.to_profile = p_me then c.from_profile else c.to_profile end)
    ) order by c.created_at desc)
    from public.challenges c
    where (c.from_profile = p_me or c.to_profile = p_me) and c.created_at > now() - interval '30 days'
  ), '[]'::jsonb);
end $$;

-- =====================================================================
-- 13. Moderación (sólo service_role: panel de Supabase o un backend propio)
-- =====================================================================

create function public.moderate_nickname(p_profile uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_nick text;
begin
  loop
    v_nick := 'JUG ' || upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.profiles where nickname_key = v_nick) and v_nick ~ '[A-Z]';
  end loop;
  update public.profiles set nickname = v_nick, nickname_key = v_nick, nickname_changed_at = now(), updated_at = now()
  where id = p_profile;
  update public.reports set status = 'resolved', resolved_at = now() where reported_id = p_profile and status = 'open';
  return v_nick;
end $$;

create function public.set_run_status(p_run uuid, p_status text, p_reasons text[] default '{}') returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('valid', 'suspicious', 'rejected', 'unverified') then raise exception 'invalid_payload'; end if;
  update public.runs set
    status = p_status,
    status_reasons = coalesce(p_reasons, '{}'),
    validation_version = validation_version + 1,
    official = p_status = 'valid' and completed and not assisted and source = 'game'
  where id = p_run;
  return found;
end $$;

create function public.set_account_ban(p_account uuid, p_banned boolean, p_reason text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.accounts set
    banned_at = case when p_banned then now() end,
    ban_reason = case when p_banned then p_reason end
  where id = p_account;
  return found;
end $$;

create function public.resolve_report(p_report uuid, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('resolved', 'dismissed') then raise exception 'invalid_payload'; end if;
  update public.reports set status = p_status, resolved_at = now() where id = p_report;
  return found;
end $$;

-- =====================================================================
-- 14. Row Level Security y permisos mínimos
-- =====================================================================

alter table public.game_rules enable row level security;
alter table public.game_barrios enable row level security;
alter table public.game_levels enable row level security;
alter table public.game_characters enable row level security;
alter table public.game_achievements enable row level security;
alter table public.game_avatars enable row level security;
alter table public.game_banned_words enable row level security;
alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.profile_stats enable row level security;
alter table public.profile_levels enable row level security;
alter table public.profile_achievements enable row level security;
alter table public.profile_characters enable row level security;
alter table public.profile_badges enable row level security;
alter table public.profile_mission_rewards enable row level security;
alter table public.runs enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.challenges enable row level security;

-- Nadie (salvo el servidor) escribe tablas. Supabase da permisos amplios
-- por defecto en el esquema public: se quitan todos y se dan sólo lecturas.
revoke all on table
  public.game_rules, public.game_barrios, public.game_levels, public.game_characters, public.game_achievements,
  public.game_avatars, public.game_banned_words, public.accounts, public.profiles, public.guardian_consents,
  public.profile_stats, public.profile_levels, public.profile_achievements, public.profile_characters,
  public.profile_badges, public.profile_mission_rewards, public.runs, public.friendships, public.blocks,
  public.reports, public.challenges
from anon, authenticated;

-- Reglas del juego: públicas (la lista de palabras prohibidas, no).
grant select on public.game_rules, public.game_barrios, public.game_levels, public.game_characters,
  public.game_achievements, public.game_avatars to anon, authenticated;
create policy "reglas visibles" on public.game_rules for select to anon, authenticated using (true);
create policy "barrios visibles" on public.game_barrios for select to anon, authenticated using (true);
create policy "niveles visibles" on public.game_levels for select to anon, authenticated using (true);
create policy "personajes visibles" on public.game_characters for select to anon, authenticated using (true);
create policy "logros visibles" on public.game_achievements for select to anon, authenticated using (true);
create policy "avatares visibles" on public.game_avatars for select to anon, authenticated using (true);

-- Datos propios: sólo lectura de las filas de la cuenta que consulta.
grant select on public.accounts, public.profiles, public.guardian_consents, public.profile_stats, public.profile_levels,
  public.profile_achievements, public.profile_characters, public.profile_badges, public.profile_mission_rewards,
  public.runs, public.friendships, public.blocks, public.challenges to authenticated;

create policy "mi cuenta" on public.accounts for select to authenticated using (id = auth.uid());
create policy "mis perfiles" on public.profiles for select to authenticated using (account_id = auth.uid());
create policy "mis consentimientos" on public.guardian_consents for select to authenticated using (account_id = auth.uid());
create policy "mis estadísticas" on public.profile_stats for select to authenticated using (private.owns_profile(profile_id));
create policy "mis niveles" on public.profile_levels for select to authenticated using (private.owns_profile(profile_id));
create policy "mis logros" on public.profile_achievements for select to authenticated using (private.owns_profile(profile_id));
create policy "mis personajes" on public.profile_characters for select to authenticated using (private.owns_profile(profile_id));
create policy "mis insignias" on public.profile_badges for select to authenticated using (private.owns_profile(profile_id));
create policy "mis misiones" on public.profile_mission_rewards for select to authenticated using (private.owns_profile(profile_id));
create policy "mis partidas" on public.runs for select to authenticated using (account_id = auth.uid());
create policy "mis amistades" on public.friendships for select to authenticated
  using (private.owns_profile(requester_id) or private.owns_profile(addressee_id));
create policy "mis bloqueos" on public.blocks for select to authenticated using (private.owns_profile(blocker_id));
create policy "mis desafíos" on public.challenges for select to authenticated
  using (private.owns_profile(from_profile) or private.owns_profile(to_profile));
-- reports: sin políticas para clientes (sólo moderación con service_role).

-- Funciones: ninguna es ejecutable por defecto; se habilitan una por una.
revoke all on function
  private.jint(jsonb, text), private.jbool(jsonb, text), private.jtext(jsonb, text, int), private.nickname_key(text),
  private.nickname_problem(text), private.owns_profile(uuid), private.require_profile(uuid),
  private.blocked_between(uuid, uuid), private.are_friends(uuid, uuid), private.stars_for(int, int, int),
  private.speed_bonus(int, text), private.barrio_completed(uuid, text), private.level_unlocked(uuid, text),
  private.achievement_cap(text, public.game_levels, boolean, boolean), private.refresh_unlocks(uuid, text),
  private.profile_state(uuid), private.my_state(), private.rank_speed(public.runs), private.rank_score(public.runs),
  private.run_result(public.runs, boolean), private.profile_card(uuid), private.require_social(uuid),
  public.get_my_state(), public.accept_terms(boolean, text), public.create_profile(text, text, text, boolean, boolean),
  public.update_profile(uuid, jsonb), public.delete_profile(uuid), public.delete_my_data(),
  public.submit_run(uuid, jsonb), public.get_my_runs(uuid, int), public.get_personal_records(uuid),
  public.get_leaderboard(text, text, text, text, uuid, int), public.get_public_profile(uuid, uuid),
  public.find_profile(text, uuid), public.import_local_progress(uuid, jsonb),
  public.block_profile(uuid, uuid), public.unblock_profile(uuid, uuid), public.get_blocked(uuid),
  public.report_profile(uuid, uuid, text, text),
  public.send_friend_request(uuid, uuid), public.respond_friend_request(uuid, uuid, boolean),
  public.remove_friend(uuid, uuid), public.get_friends(uuid),
  public.create_challenge(uuid, uuid, text, text, text), public.respond_challenge(uuid, uuid, boolean),
  public.get_challenges(uuid),
  public.moderate_nickname(uuid), public.set_run_status(uuid, text, text[]), public.set_account_ban(uuid, boolean, text),
  public.resolve_report(uuid, text)
from public, anon, authenticated;

-- Necesaria para evaluar las políticas de RLS.
grant execute on function private.owns_profile(uuid) to authenticated;

-- Invitados (sin cuenta) y jugadores: rankings y perfiles públicos.
grant execute on function public.get_leaderboard(text, text, text, text, uuid, int), public.get_public_profile(uuid, uuid)
  to anon, authenticated;

-- Jugadores con cuenta.
grant execute on function
  public.get_my_state(), public.accept_terms(boolean, text), public.create_profile(text, text, text, boolean, boolean),
  public.update_profile(uuid, jsonb), public.delete_profile(uuid), public.delete_my_data(),
  public.submit_run(uuid, jsonb), public.get_my_runs(uuid, int), public.get_personal_records(uuid),
  public.find_profile(text, uuid), public.import_local_progress(uuid, jsonb),
  public.block_profile(uuid, uuid), public.unblock_profile(uuid, uuid), public.get_blocked(uuid),
  public.report_profile(uuid, uuid, text, text),
  public.send_friend_request(uuid, uuid), public.respond_friend_request(uuid, uuid, boolean),
  public.remove_friend(uuid, uuid), public.get_friends(uuid),
  public.create_challenge(uuid, uuid, text, text, text), public.respond_challenge(uuid, uuid, boolean),
  public.get_challenges(uuid)
to authenticated;

-- Moderación: sólo con la clave secreta (nunca en el juego).
grant execute on function
  public.moderate_nickname(uuid), public.set_run_status(uuid, text, text[]), public.set_account_ban(uuid, boolean, text),
  public.resolve_report(uuid, text)
to service_role;
