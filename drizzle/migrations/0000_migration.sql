create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- First registered user becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique,
  name text not null,
  contact text not null,
  issue_type text not null,
  description text not null,
  suggestion text,
  latitude double precision,
  longitude double precision,
  photos text[] not null default '{}',
  status text not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update, delete on public.complaints to authenticated;
grant all on public.complaints to service_role;
alter table public.complaints enable row level security;
create policy "Admins view complaints" on public.complaints for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update complaints" on public.complaints for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete complaints" on public.complaints for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.submit_complaint(
  _name text, _contact text, _issue_type text, _description text, _suggestion text,
  _latitude double precision, _longitude double precision, _photos text[]
) returns text language plpgsql security definer set search_path = public
as $$
declare code text;
begin
  if length(trim(coalesce(_name,''))) = 0 or length(_name) > 100 then raise exception 'Invalid name'; end if;
  if length(trim(coalesce(_contact,''))) = 0 or length(_contact) > 255 then raise exception 'Invalid contact'; end if;
  if _issue_type not in ('pothole','streetlight','sidewalk','drainage','signage','other') then raise exception 'Invalid issue type'; end if;
  if length(trim(coalesce(_description,''))) < 10 or length(_description) > 2000 then raise exception 'Invalid description'; end if;
  if length(coalesce(_suggestion,'')) > 1000 then raise exception 'Suggestion too long'; end if;
  if coalesce(array_length(_photos,1),0) > 6 then raise exception 'Too many photos'; end if;
  loop
    code := 'RW-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.complaints where tracking_code = code);
  end loop;
  insert into public.complaints (tracking_code, name, contact, issue_type, description, suggestion, latitude, longitude, photos)
  values (code, trim(_name), trim(_contact), _issue_type, trim(_description), nullif(trim(coalesce(_suggestion,'')),''), _latitude, _longitude, coalesce(_photos,'{}'));
  return code;
end $$;
grant execute on function public.submit_complaint to anon, authenticated;

create or replace function public.track_complaint(_code text)
returns table (tracking_code text, issue_type text, status text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$ select tracking_code, issue_type, status, created_at, updated_at from public.complaints where tracking_code = upper(trim(_code)) $$;
grant execute on function public.track_complaint to anon, authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;
create trigger complaints_touch before update on public.complaints for each row execute function public.touch_updated_at();

create policy "Anyone can upload complaint photos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'complaint-photos');
create policy "Anyone can view complaint photos" on storage.objects for select to anon, authenticated using (bucket_id = 'complaint-photos');