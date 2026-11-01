-- O visitante é informado e concorda com a publicação ao enviar a opinião.
-- Opiniões antigas continuam privadas; somente envios feitos após o aviso
-- explícito no formulário aparecem no histórico público.
alter table public.opinioes
  add column if not exists visivel_publicamente boolean not null default false;

grant select on table public.opinioes to anon, authenticated;

drop policy if exists "Visitantes podem consultar opinioes" on public.opinioes;
create policy "Visitantes podem consultar opinioes"
  on public.opinioes
  for select
  to anon, authenticated
  using (visivel_publicamente is true);

drop policy if exists "Visitantes podem enviar opinioes" on public.opinioes;
create policy "Visitantes podem enviar opinioes"
  on public.opinioes
  for insert
  to anon, authenticated
  with check (
    visivel_publicamente is true
    and length(btrim(nome)) between 2 and 80
    and length(btrim(opiniao)) between 5 and 1500
  );
