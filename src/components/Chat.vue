<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'

const aberto = ref(false)
const apelidoEntrada = ref('')
const mensagemEntrada = ref('')
const usuario = ref(null)
const apelidoAtual = ref('')
const mensagens = ref([])
const carregando = ref(true)
const enviando = ref(false)
const erro = ref('')
const status = ref('')
const listaRef = ref(null)
let canal = null
let intervalo = null
let authSubscription = null
let sessaoDesde = null
let atualizandoMensagens = false
let versaoSessao = 0

const podeEntrar = computed(() => apelidoEntrada.value.trim().length >= 2)

function abrirChat() { aberto.value = true }
function fecharChat() { aberto.value = false }
defineExpose({ abrirChat })

function mensagemErro(error) {
  const code = error?.code
  if (code === '23505') return 'Esse apelido já está em uso. Escolha outro.'
  if (code === '42501') return 'O Supabase bloqueou esta ação pelas políticas de segurança (RLS). Confira as políticas das tabelas.'
  if (error?.message?.toLowerCase().includes('anonymous')) return 'O login anônimo não está habilitado no Supabase.'
  return error?.message || 'Não foi possível concluir a operação. Tente novamente.'
}

async function carregarMensagens() {
  if (!usuario.value || !sessaoDesde || atualizandoMensagens) return
  atualizandoMensagens = true
  const versaoAtual = versaoSessao

  try {
    const { data, error: erroConsulta } = await supabase
      .from('mensagens')
      .select('id, usuario_id, conteudo, criado_em')
      .gte('criado_em', sessaoDesde)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (versaoAtual !== versaoSessao) return
    if (erroConsulta) {
      erro.value = mensagemErro(erroConsulta)
      return
    }

    const ids = [...new Set((data || []).map(item => item.usuario_id))]
    let perfis = []
    if (ids.length) {
      const { data: dadosPerfis, error: erroPerfis } = await supabase
        .from('perfis')
        .select('id, apelido')
        .in('id', ids)
      if (!erroPerfis) perfis = dadosPerfis || []
    }
    if (versaoAtual !== versaoSessao) return
    const nomes = new Map(perfis.map(perfil => [perfil.id, perfil.apelido]))
    mensagens.value = (data || []).map(item => ({
      ...item,
      apelido: nomes.get(item.usuario_id) || 'Visitante lunar'
    })).reverse()
    erro.value = ''
    requestAnimationFrame(() => {
      if (listaRef.value) listaRef.value.scrollTop = listaRef.value.scrollHeight
    })
  } finally {
    atualizandoMensagens = false
  }
}

function iniciarAtualizacoes() {
  if (!usuario.value) return

  canal = supabase
    .channel(`lua-hoje-mensagens-${usuario.value.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => {
      void carregarMensagens()
    })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        status.value = 'Atualização em tempo real ativa'
      } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
        status.value = 'Atualização periódica ativa'
      }
    })

  // Mantém uma consulta periódica mesmo quando o canal Realtime informa SUBSCRIBED.
  // Isso cobre projetos em que o canal conecta, mas a tabela não está publicada no Realtime.
  if (intervalo) clearInterval(intervalo)
  intervalo = setInterval(() => {
    if (usuario.value) void carregarMensagens()
  }, 3000)
}

async function registrarEntrada(id, apelido) {
  return supabase
    .from('mensagens')
    .insert({
      usuario_id: id,
      conteudo: `${apelido} entrou no chat`
    })
    .select('criado_em')
    .single()
}
async function abrirSala(id, apelido, inicioSessao) {
  versaoSessao += 1
  mensagens.value = []
  usuario.value = { id }
  apelidoAtual.value = apelido
  sessaoDesde = inicioSessao
  await carregarMensagens()
  iniciarAtualizacoes()
}
async function entrarNoChat() {
  if (!podeEntrar.value || !supabase) return
  carregando.value = true
  erro.value = ''
  const apelido = apelidoEntrada.value.trim().replace(/\s+/g, ' ')
  if (apelido.length > 24) {
    erro.value = 'O apelido deve ter no máximo 24 caracteres.'
    carregando.value = false
    return
  }

  let { data: sessaoData, error: erroAuth } = await supabase.auth.getSession()
  if (erroAuth) {
    erro.value = mensagemErro(erroAuth)
    carregando.value = false
    return
  }
  let user = sessaoData.session?.user
  if (!user) {
    const resultado = await supabase.auth.signInAnonymously()
    if (resultado.error) {
      erro.value = mensagemErro(resultado.error)
      carregando.value = false
      return
    }
    user = resultado.data.user
  }

  const { data: perfil, error: erroPerfil } = await supabase
    .from('perfis')
    .select('id, apelido')
    .eq('id', user.id)
    .maybeSingle()

  if (erroPerfil) {
    erro.value = mensagemErro(erroPerfil)
    carregando.value = false
    return
  }

  if (perfil) {
    if (perfil.apelido.toLocaleLowerCase('pt-BR') !== apelido.toLocaleLowerCase('pt-BR')) {
      const { error: erroAtualizacao } = await supabase
        .from('perfis')
        .update({ apelido })
        .eq('id', user.id)
      if (erroAtualizacao) {
        erro.value = mensagemErro(erroAtualizacao)
        carregando.value = false
        return
      }
    }
  } else {
    const { error: erroCriacao } = await supabase
      .from('perfis')
      .insert({ id: user.id, apelido })
    if (erroCriacao) {
      erro.value = mensagemErro(erroCriacao)
      carregando.value = false
      return
    }
  }

  const { data: entrada, error: erroEntrada } = await registrarEntrada(user.id, apelido)
  if (erroEntrada) {
    erro.value = mensagemErro(erroEntrada)
    carregando.value = false
    return
  }

  await abrirSala(user.id, apelido, entrada.criado_em)
  carregando.value = false
}

async function enviarMensagem() {
  const conteudo = mensagemEntrada.value.trim()
  if (!conteudo || conteudo.length > 500 || enviando.value || !usuario.value) return
  enviando.value = true
  erro.value = ''
  const { error: erroEnvio } = await supabase.from('mensagens').insert({
    usuario_id: usuario.value.id,
    conteudo
  })
  if (erroEnvio) erro.value = mensagemErro(erroEnvio)
  else {
    mensagemEntrada.value = ''
    await carregarMensagens()
  }
  enviando.value = false
}

function ehAvisoDeSala(mensagem) {
  return / (?:entrou|saiu) do chat$/i.test(mensagem.conteudo)
}

function formatarHora(data) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(data))
}

async function sairDoChat() {
  if (!usuario.value || enviando.value) return
  enviando.value = true
  erro.value = ''

  const { error: erroSaida } = await supabase.rpc('sair_do_chat')
  if (erroSaida) {
    erro.value = ['PGRST202', '42883'].includes(erroSaida.code)
      ? 'A saída com liberação do apelido ainda não foi ativada no Supabase. Aplique o SQL de saída do chat e tente novamente.'
      : mensagemErro(erroSaida)
    enviando.value = false
    return
  }

  versaoSessao += 1
  sessaoDesde = null
  if (canal) await supabase.removeChannel(canal)
  canal = null
  if (intervalo) clearInterval(intervalo)
  intervalo = null
  await supabase.auth.signOut({ scope: 'local' })
  usuario.value = null
  apelidoAtual.value = ''
  mensagens.value = []
  status.value = ''
  mensagemEntrada.value = ''
  enviando.value = false
}

onMounted(async () => {
  if (!supabaseConfigured) {
    carregando.value = false
    return
  }
  const { data, error: erroSessao } = await supabase.auth.getSession()
  if (erroSessao) erro.value = mensagemErro(erroSessao)
  if (data.session?.user) {
    const { data: perfil } = await supabase
      .from('perfis')
      .select('id, apelido')
      .eq('id', data.session.user.id)
      .maybeSingle()
    if (perfil) {
      const { data: entrada, error: erroEntrada } = await registrarEntrada(perfil.id, perfil.apelido)
      if (erroEntrada) erro.value = mensagemErro(erroEntrada)
      else await abrirSala(perfil.id, perfil.apelido, entrada.criado_em)
    }
  }
  const { data: listener } = supabase.auth.onAuthStateChange((_evento, sessao) => {
    if (!sessao) {
      usuario.value = null
      apelidoAtual.value = ''
    }
  })
  authSubscription = listener.subscription
  carregando.value = false
})

onUnmounted(() => {
  if (intervalo) clearInterval(intervalo)
  if (canal && supabase) supabase.removeChannel(canal)
  authSubscription?.unsubscribe()
})
</script>

<template>
  <div class="chat-widget">
    <button v-if="!aberto" class="chat-launcher" type="button" aria-label="Abrir chat lunar" title="Abrir chat lunar" @click="abrirChat">
      <span class="chat-launcher-moon" aria-hidden="true">☾</span>
    </button>

    <section v-else id="chat" class="chat-lunar" role="dialog" aria-label="Chat lunar">
      <div class="chat-card">
        <header class="chat-window-top">
          <div><span class="chat-window-moon">☾</span><div><strong>Chat lunar</strong><small>Uma conversa sob a mesma Lua</small></div></div>
          <button class="chat-close" type="button" aria-label="Fechar chat" @click="fecharChat">×</button>
        </header>

        <div v-if="!supabaseConfigured" class="chat-aviso-config">
          <span class="chat-lua-icone">☾</span>
          <h3>Falta configurar a chave pública</h3>
          <p>Preencha <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no arquivo <code>.env.local</code> e reinicie o Vite.</p>
        </div>

        <div v-else-if="!usuario" class="chat-entrada">
          <span class="chat-lua-icone">☾</span>
          <h3>Qual será seu apelido?</h3>
          <p>Sem e-mail e sem senha. Seu apelido aparecerá junto às mensagens.</p>
          <form @submit.prevent="entrarNoChat">
            <label for="apelido-chat">Apelido</label>
            <input id="apelido-chat" v-model="apelidoEntrada" maxlength="24" minlength="2" autocomplete="nickname" placeholder="Ex.: Observador da Lua" required />
            <button class="botao-principal" type="submit" :disabled="!podeEntrar || carregando">
              {{ carregando ? 'Conectando…' : 'Entrar no chat' }} <span>→</span>
            </button>
          </form>
        </div>

        <div v-else class="chat-sala">
          <div class="chat-cabecalho">
            <div><span class="chat-online-ponto"></span><strong>{{ apelidoAtual }}</strong><small>{{ status }}</small></div>
            <button class="chat-sair" type="button" @click="sairDoChat">Sair</button>
          </div>
          <div ref="listaRef" class="chat-mensagens" aria-live="polite" aria-label="Mensagens do chat">
            <p v-if="!mensagens.length" class="chat-vazio">O céu está quieto por enquanto. Comece a conversa 🌙</p>
            <article v-for="mensagem in mensagens" :key="mensagem.id" class="chat-mensagem" :class="{ 'chat-mensagem-propria': mensagem.usuario_id === usuario.id, 'chat-aviso-sala': ehAvisoDeSala(mensagem) }">
              <div v-if="!ehAvisoDeSala(mensagem)" class="chat-mensagem-meta"><strong>{{ mensagem.apelido }}</strong><time :datetime="mensagem.criado_em">{{ formatarHora(mensagem.criado_em) }}</time></div>
              <p>{{ mensagem.conteudo }}</p>
            </article>
          </div>
          <form class="chat-compositor" @submit.prevent="enviarMensagem">
            <input v-model="mensagemEntrada" maxlength="500" aria-label="Sua mensagem" placeholder="Escreva sua mensagem…" autocomplete="off" />
            <button class="botao-principal" type="submit" :disabled="!mensagemEntrada.trim() || enviando">Enviar</button>
          </form>
          <p class="chat-limite">Até 500 caracteres por mensagem.</p>
        </div>
        <p v-if="erro" class="chat-erro" role="alert">{{ erro }}</p>
      </div>
    </section>
  </div>
</template>