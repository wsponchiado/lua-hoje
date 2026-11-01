# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).
## Supabase e chat lunar

1. No painel Supabase do projeto LuaHoje, abra **Project Settings → API Keys** e copie a chave pública **Publishable** (ou a chave legada **anon**). Nunca use `service_role` ou uma chave `secret` no frontend.
2. Cole essa chave no valor `VITE_SUPABASE_PUBLISHABLE_KEY` do arquivo `.env.local`. A URL do projeto já está configurada nesse arquivo.
3. Reinicie o servidor Vite depois de alterar variáveis `VITE_*`.
4. Confirme que o login anônimo está habilitado e que as tabelas `perfis` e `mensagens` mantêm RLS e as políticas criadas para `authenticated` no SQL do projeto.

O chat cria uma sessão anônima do Supabase, associa o apelido ao `auth.uid()` em `perfis` e limita mensagens a 500 caracteres. Cada entrada marca o início da sessão: a pessoa vê apenas mensagens enviadas desde que entrou. O Realtime atualiza a conversa imediatamente quando disponível, com consulta periódica de segurança a cada 3 segundos. Ao sair, a tela local é limpa; quando o último participante sai, o SQL remove o histórico da conversa encerrada.

### Saída do chat e limpeza da conversa

Execute o arquivo `supabase/migrations/20261101_chat_temporario.sql` no SQL Editor do Supabase. Ele atualiza `sair_do_chat()` para liberar o apelido e apagar o histórico quando a sala ficar sem participantes. Cada pessoa vê apenas mensagens enviadas desde sua própria entrada.

### Aba Deixe sua opinião

O formulário grava nome e opinião na tabela `public.opinioes` do Supabase. Para habilitar o envio, execute uma vez o arquivo `supabase/migrations/20261031_opinioes.sql` no **SQL Editor** do projeto. A política permite inserir opiniões para visitantes e usuários autenticados, sem liberar a leitura pública dos registros.
