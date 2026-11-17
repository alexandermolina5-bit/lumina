-- Run in a disposable test project after migrations, never against production patient data.
-- All test fixtures are rolled back. No real users or patients are used.
begin;
insert into auth.users(id,email,aud,role) values
('10000000-0000-4000-8000-000000000001','lumina-a@example.invalid','authenticated','authenticated'),
('10000000-0000-4000-8000-000000000002','lumina-b@example.invalid','authenticated','authenticated');
insert into public.lumina_workspaces(user_id,payload,revision) values
('10000000-0000-4000-8000-000000000001','{"patients":[{"id":"patient_a","name":"Prueba A"}],"appointments":[],"areas":[]}',1),
('10000000-0000-4000-8000-000000000002','{"patients":[{"id":"patient_b","name":"Prueba B"}],"appointments":[],"areas":[]}',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.lumina_workspaces) <> 1 then raise exception 'FAIL: account A sees other accounts'; end if;
  if exists(select 1 from public.lumina_workspaces where user_id='10000000-0000-4000-8000-000000000002') then raise exception 'FAIL: B visible from A'; end if;
end $$;
select public.lumina_save_workspace(1,'{"patients":[{"id":"patient_a","name":"A updated"}],"appointments":[],"areas":[]}');
do $$ begin
  begin
    perform public.lumina_save_workspace(1,'{"patients":[],"appointments":[],"areas":[]}');
    raise exception 'FAIL: stale write allowed';
  exception when serialization_failure then null;
  end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.lumina_workspaces) <> 1 then raise exception 'FAIL: account B sees other accounts'; end if;
  if (select revision from public.lumina_workspaces) <> 1 then raise exception 'FAIL: B modified by A'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform 1 from public.lumina_workspaces;
    raise exception 'FAIL: anonymous access allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
