-- Restringe mensagens ao período de participação e habilita Postgres Changes.
-- Aplicar depois das migrações existentes do chat.
begin;

alter table public.perfis
  add column if not exists entrou_em timestamptz not null default now();

create schema if not exists lua_private;
revoke all on schema lua_private from public, anon, authenticated;
grant usage on schema lua_private to authenticated;

create or replace function lua_private.usuario_participa_do_chat()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.perfis as p
     where p.id = (select auth.uid())
  );
$function$;

revoke all on function lua_private.usuario_participa_do_chat() from public, anon, authenticated;
grant execute on function lua_private.usuario_participa_do_chat() to authenticated;

create or replace function lua_private.marcar_entrada_chat()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.entrou_em := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

revoke all on function lua_private.marcar_entrada_chat() from public, anon, authenticated;

drop trigger if exists perfis_marcar_entrada_chat_insert on public.perfis;
create trigger perfis_marcar_entrada_chat_insert
  before insert on public.perfis
  for each row execute function lua_private.marcar_entrada_chat();

drop trigger if exists perfis_marcar_entrada_chat_update on public.perfis;
create trigger perfis_marcar_entrada_chat_update
  before update of apelido on public.perfis
  for each row execute function lua_private.marcar_entrada_chat();

-- O cliente só pode gravar o apelido; a data de entrada é controlada pelo banco.
revoke insert, update on table public.perfis from authenticated;
grant insert (id, apelido) on table public.perfis to authenticated;
grant update (apelido) on table public.perfis to authenticated;

drop policy if exists "Todos podem visualizar mensagens" on public.mensagens;
create policy "Participantes podem visualizar mensagens da sessão"
  on public.mensagens
  for select
  to authenticated
  using (
    (select lua_private.usuario_participa_do_chat())
    and criado_em >= (
      select p.entrou_em
        from public.perfis as p
       where p.id = (select auth.uid())
    )
  );

drop policy if exists "Todos podem visualizar perfis" on public.perfis;
create policy "Participantes podem visualizar perfis"
  on public.perfis
  for select
  to authenticated
  using ((select lua_private.usuario_participa_do_chat()));

drop policy if exists "Usuário pode enviar suas mensagens" on public.mensagens;
create policy "Usuário pode enviar suas mensagens"
  on public.mensagens
  for insert
  to authenticated
  with check (
    usuario_id = (select auth.uid())
    and criado_em >= (
      select p.entrou_em
        from public.perfis as p
       where p.id = (select auth.uid())
    )
    and criado_em <= now()
  );

do $publication$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'A publicação supabase_realtime não existe.';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'mensagens'
  ) then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;
end;
$publication$;

commit;
