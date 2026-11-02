# LuaHoje

Projeto Integrador do curso de Tecnologia da Informação da UFMS. O site reúne acompanhamento das fases da Lua, desenho para observação, referências sazonais agrícolas por região, dedicatória, opiniões da comunidade e chat anônimo.

## Desenvolvimento local

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_PUBLISHABLE_KEY` com a chave pública Publishable (ou anon) do projeto.
3. Inicie a aplicação com `npm run dev`.
4. Gere a versão de produção com `npm run build`; para visualizar o resultado localmente, use `npm run preview`.

Use apenas a chave pública no frontend. Nunca coloque chaves `service_role` ou `secret` em variáveis `VITE_*`.
## Supabase e chat lunar

1. No painel Supabase do projeto LuaHoje, abra **Project Settings → API Keys** e copie a chave pública **Publishable** (ou a chave legada **anon**). Nunca use `service_role` ou uma chave `secret` no frontend.
2. Cole essa chave no valor `VITE_SUPABASE_PUBLISHABLE_KEY` do arquivo `.env.local`. A URL do projeto já está configurada nesse arquivo.
3. Reinicie o servidor Vite depois de alterar variáveis `VITE_*`.
4. Confirme que o login anônimo está habilitado e que as tabelas `perfis` e `mensagens` mantêm RLS e as políticas criadas para `authenticated` no SQL do projeto.

O chat cria uma sessão anônima do Supabase, associa o apelido ao `auth.uid()` em `perfis` e limita mensagens a 500 caracteres. O banco controla `perfis.entrou_em` e aplica RLS para que cada participante consulte apenas mensagens posteriores à própria entrada; o filtro do frontend continua sincronizado com essa regra. `mensagens` integra a publicação `supabase_realtime`, e a consulta periódica de segurança a cada 3 segundos permanece como alternativa de atualização. Ao sair, a tela local é limpa; quando o último participante sai, o SQL remove o histórico da conversa encerrada.

### Saída do chat e limpeza da conversa

Aplique as migrações do chat em ordem. Em bancos que já executaram `20261102_sair_do_chat_delete_seguro.sql`, aplique também `supabase/migrations/20261102_sessao_chat_rls_realtime.sql` para restringir a leitura ao período da sessão e habilitar atualizações Postgres Changes.

### Aba Deixe sua opinião

O formulário grava nome e opinião na tabela `public.opinioes` do Supabase. Para habilitar o envio, execute uma vez o arquivo `supabase/migrations/20261031_opinioes.sql` no **SQL Editor** do projeto. O histórico público depende também da migração `supabase/migrations/20261101_opinioes_historico_publico.sql`.

Essa migração mantém opiniões antigas privadas. As opiniões novas só aparecem no histórico depois que a pessoa marca a autorização de publicação no formulário. A consulta pública continua protegida por RLS e a aplicação usa apenas a chave Publishable.
