-- Corrige a limpeza da conversa quando o último participante sai.
-- O predicado explícito evita que o Supabase bloqueie um DELETE sem WHERE.
create or replace function public.sair_do_chat()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_apelido text;
begin
  if v_user_id is null then
    raise exception 'Sessão anônima necessária para sair do chat.';
  end if;

  -- Serializa saídas simultâneas para detectar corretamente quando a sala esvaziou.
  perform pg_catalog.pg_advisory_xact_lock(7319046101);

  select p.apelido
    into v_apelido
    from public.perfis as p
   where p.id = v_user_id
   for update;

  if v_apelido is null then
    raise exception 'Perfil do chat não encontrado.';
  end if;

  insert into public.mensagens (usuario_id, conteudo)
  values (v_user_id, v_apelido || ' saiu do chat');

  delete from public.perfis
   where id = v_user_id;

  if not exists (select 1 from public.perfis) then
    delete from public.mensagens
     where id is not null;
  end if;

  return v_apelido;
end;
$function$;

revoke all on function public.sair_do_chat() from public;
revoke all on function public.sair_do_chat() from anon;
grant execute on function public.sair_do_chat() to authenticated;
