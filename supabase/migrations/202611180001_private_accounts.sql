-- LUMINA: independent accounts. No patient data or administrator secrets in source.
create table if not exists public.lumina_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint lumina_payload_size check (octet_length(payload::text) <= 10485760)
);
alter table public.lumina_workspaces enable row level security;
alter table public.lumina_workspaces force row level security;
revoke all on public.lumina_workspaces from anon, authenticated;
grant select on public.lumina_workspaces to authenticated;
create policy lumina_owner_reads on public.lumina_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.lumina_save_workspace(p_expected_revision bigint, p_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); next_revision bigint;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_expected_revision < 0 or p_expected_revision is null then raise exception 'Invalid revision'; end if;
  if jsonb_typeof(p_payload) <> 'object' or
    jsonb_typeof(p_payload->'patients') is distinct from 'array' or
    jsonb_typeof(p_payload->'appointments') is distinct from 'array' or
    jsonb_typeof(p_payload->'areas') is distinct from 'array' then
    raise exception 'Invalid workspace';
  end if;
  if p_expected_revision = 0 then
    insert into public.lumina_workspaces(user_id,payload,revision)
    values(owner_id,p_payload,1) on conflict (user_id) do nothing
    returning revision into next_revision;
  else
    update public.lumina_workspaces set payload=p_payload,revision=revision+1,updated_at=now()
    where user_id=owner_id and revision=p_expected_revision
    returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'A newer version exists' using errcode='40001'; end if;
  return next_revision;
end;
revoke all on function public.lumina_save_workspace(bigint,jsonb) from public,anon;
grant execute on function public.lumina_save_workspace(bigint,jsonb) to authenticated;

-- Private photographs, selected only through short-lived, authorized URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lumina-private','lumina-private',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy lumina_photo_read on storage.objects for select to authenticated
using (bucket_id='lumina-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy lumina_photo_insert on storage.objects for insert to authenticated
with check (bucket_id='lumina-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy lumina_photo_delete on storage.objects for delete to authenticated
using (bucket_id='lumina-private' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- For the future Web Push integration. No anonymous access and no cross-account reads.
create table public.lumina_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lumina_push_subscriptions enable row level security;
revoke all on public.lumina_push_subscriptions from anon;
grant select,insert,update,delete on public.lumina_push_subscriptions to authenticated;
create policy lumina_subscription_owner on public.lumina_push_subscriptions to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
