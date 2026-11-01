<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'

const props = defineProps({ expandido: { type: Boolean, default: false } })
const emit = defineEmits(['voltar-ao-popup'])
const aberto = ref(false)
watch(() => props.expandido, (expandido, anterior) => {
  if (anterior && !expandido) {
    aberto.value = false
    mostrandoPessoas.value = false
  }
})
const naoLidas = ref(0)
const mostrandoPessoas = ref(false)
const pessoas = ref([])
const digitando = ref([])
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
const timersDigitacao = new Map()
let ultimaNotificacaoDigitacao = 0
let intervalo = null
let authSubscription = null
let sessaoDesde = null
let atualizandoMensagens = false
let versaoSessao = 0

const podeEntrar = computed(() => apelidoEntrada.value.trim().length >= 2 && apelidoEntrada.value.trim().length <= 24)
const textoDigitando = computed(() => {
  const nomes = digitando.value.filter(pessoa => pessoa.id !== usuario.value?.id).map(pessoa => pessoa.apelido)
  if (!nomes.length) return ''
  if (nomes.length === 1) return `${nomes[0]} está digitando…`
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]} estão digitando…`
  return `${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2} ${nomes.length === 3 ? 'pessoa' : 'pessoas'} estão digitando…`
})

const apelidosSorteio = ['Luna', 'Marte', 'Vênus', 'Júpiter', 'Saturno', 'Mercúrio', 'Netuno', 'Urano', 'Estrela Polar', 'Cometa Halley']
function sortearApelido() {
  const disponiveis = apelidosSorteio.filter(nome => nome !== apelidoEntrada.value)
  apelidoEntrada.value = disponiveis[Math.floor(Math.random() * disponiveis.length)]
}
function abrirChat() { aberto.value = true; naoLidas.value = 0; mostrandoPessoas.value = false }
function minimizarChat() {
  if (props.expandido) {
    emit('voltar-ao-popup')
    return
  }
  aberto.value = false
  mostrandoPessoas.value = false
}
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
    const novasMensagens = (data || []).map(item => ({
      ...item,
      apelido: nomes.get(item.usuario_id) || 'Visitante lunar'
    })).reverse()
    const idsAnteriores = new Set(mensagens.value.map(item => item.id))
    if (aberto.value) naoLidas.value = 0
    else if (mensagens.value.length) {
      naoLidas.value += novasMensagens.filter(item => !idsAnteriores.has(item.id) && item.usuario_id !== usuario.value?.id).length
    }
    mensagens.value = novasMensagens
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
    .channel('lua-hoje-sala', { config: { presence: { key: usuario.value.id } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => {
      void carregarMensagens()
    })
    .on('presence', { event: 'sync' }, () => {
      const estado = canal?.presenceState() || {}
      const lista = Object.values(estado).flat().map(item => ({ id: item.id, apelido: item.apelido })).filter(item => item.id)
      pessoas.value = [...new Map(lista.map(item => [item.id, item])).values()]
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => atualizarPresenca(newPresences, true))
    .on('presence', { event: 'leave' }, ({ leftPresences }) => atualizarPresenca(leftPresences, false))
    .on('broadcast', { event: 'digitando' }, ({ payload }) => {
      if (!payload?.id || payload.id === usuario.value?.id) return
      const pessoa = { id: payload.id, apelido: payload.apelido }
      digitando.value = [...digitando.value.filter(item => item.id !== pessoa.id), pessoa]
      clearTimeout(timersDigitacao.get(pessoa.id))
      timersDigitacao.set(pessoa.id, setTimeout(() => {
        digitando.value = digitando.value.filter(item => item.id !== pessoa.id)
        timersDigitacao.delete(pessoa.id)
      }, 3500))
    })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        status.value = 'Atualização em tempo real ativa'
        void canal.track({ id: usuario.value.id, apelido: apelidoAtual.value })
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

function atualizarPresenca(registros, entrou) {
  const estado = canal?.presenceState() || {}
  const lista = Object.values(estado).flat().map(item => ({ id: item.id, apelido: item.apelido })).filter(item => item.id)
  pessoas.value = [...new Map(lista.map(item => [item.id, item])).values()]
  if (!entrou) {
    const ids = new Set((registros || []).map(item => item.id))
    digitando.value = digitando.value.filter(item => !ids.has(item.id))
    ids.forEach(id => { clearTimeout(timersDigitacao.get(id)); timersDigitacao.delete(id) })
  }
}

function notificarDigitacao() {
  if (!canal || !usuario.value || !mensagemEntrada.value.trim()) return
  const agora = Date.now()
  if (agora - ultimaNotificacaoDigitacao < 1000) return
  ultimaNotificacaoDigitacao = agora
  void canal.send({ type: 'broadcast', event: 'digitando', payload: { id: usuario.value.id, apelido: apelidoAtual.value } })
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
  pessoas.value = []
  digitando.value = []
  timersDigitacao.forEach(timer => clearTimeout(timer))
  timersDigitacao.clear()
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
  timersDigitacao.forEach(timer => clearTimeout(timer))
  authSubscription?.unsubscribe()
})
</script>

<template>
  <div class="chat-widget" :class="{ 'chat-widget-expandido': expandido }">
    <button v-if="!aberto" class="chat-launcher" type="button" aria-label="Abrir chat lunar" title="Abrir chat lunar" @click="abrirChat">
      <span class="chat-launcher-moon" aria-hidden="true">☾</span>
      <span v-if="naoLidas" class="chat-nao-lidas" :aria-label="`${naoLidas} mensagens novas`">{{ naoLidas > 99 ? '99+' : naoLidas }}</span>
    </button>

    <section v-else id="chat" class="chat-lunar" :class="{ 'chat-expandido': expandido }" :role="expandido ? undefined : 'dialog'" aria-label="Chat lunar">
      <div class="chat-card">
        <header class="chat-window-top">
          <div><span class="chat-window-moon">☾</span><div><strong>Chat lunar</strong><small>Uma conversa sob a mesma Lua</small></div></div>
          <button class="chat-close" type="button" :aria-label="expandido ? 'Voltar ao site e manter o chat aberto' : 'Minimizar chat'" :title="expandido ? 'Voltar ao site e manter o chat aberto' : 'Minimizar chat'" @click="minimizarChat">×</button>
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
            <div class="chat-apelido-linha"><input id="apelido-chat" v-model="apelidoEntrada" maxlength="24" minlength="2" autocomplete="nickname" placeholder="Ex.: Observador da Lua" required /><button type="button" class="chat-sortear" @click="sortearApelido">Sortear</button></div>
            <small class="chat-apelido-limite">2 a 24 caracteres</small>
            <button class="botao-principal" type="submit" :disabled="!podeEntrar || carregando">
              {{ carregando ? 'Conectando…' : 'Entrar no chat' }} <span>→</span>
            </button>
          </form>
        </div>

        <div v-else class="chat-sala">
          <div class="chat-cabecalho">
            <div><span class="chat-online-ponto"></span><strong>{{ apelidoAtual }}</strong><small>{{ status }}</small></div>
            <button class="chat-pessoas-botao" type="button" aria-label="Ver pessoas no chat" :aria-expanded="mostrandoPessoas" @click="mostrandoPessoas = !mostrandoPessoas">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6m3-3h-6" /></svg>
              <span>{{ pessoas.length }}</span>
            </button>
            <button class="chat-sair" type="button" @click="sairDoChat">Sair</button>
          </div>
          <div v-if="mostrandoPessoas" class="chat-pessoas-lista">
            <strong>No chat agora</strong>
            <p v-for="pessoa in pessoas" :key="pessoa.id"><span class="chat-online-ponto"></span>{{ pessoa.apelido }}<small v-if="pessoa.id === usuario.id">Você</small></p>
            <p v-if="!pessoas.length">Ninguém conectado no momento.</p>
          </div>
          <div v-if="textoDigitando" class="chat-digitando" aria-live="polite">{{ textoDigitando }}</div>
          <div ref="listaRef" class="chat-mensagens" aria-live="polite" aria-label="Mensagens do chat">
            <p v-if="!mensagens.length" class="chat-vazio">O céu está quieto por enquanto. Comece a conversa 🌙</p>
            <article v-for="mensagem in mensagens" :key="mensagem.id" class="chat-mensagem" :class="{ 'chat-mensagem-propria': mensagem.usuario_id === usuario.id, 'chat-aviso-sala': ehAvisoDeSala(mensagem) }">
              <div v-if="!ehAvisoDeSala(mensagem)" class="chat-mensagem-meta"><strong>{{ mensagem.apelido }}</strong><time :datetime="mensagem.criado_em">{{ formatarHora(mensagem.criado_em) }}</time></div>
              <p>{{ mensagem.conteudo }}</p>
            </article>
          </div>
          <form class="chat-compositor" @submit.prevent="enviarMensagem">
            <input v-model="mensagemEntrada" maxlength="500" aria-label="Sua mensagem" placeholder="Escreva sua mensagem…" autocomplete="off" @input="notificarDigitacao" />
            <button class="botao-principal" type="submit" :disabled="!mensagemEntrada.trim() || enviando">Enviar</button>
          </form>
          <p class="chat-limite">Até 500 caracteres por mensagem.</p>
        </div>
        <p v-if="erro" class="chat-erro" role="alert">{{ erro }}</p>
      </div>
    </section>
  </div>
</template>
