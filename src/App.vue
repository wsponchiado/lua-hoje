<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import Chat from './components/Chat.vue'
import { supabase, supabaseConfigured } from './lib/supabase'
import { mesesAgricolas, intervalosDeMeses, regioesAgricolas } from './data/calendarioAgricola'

const hoje = new Date()

// Referência astronômica aproximada para o ciclo lunar
const referenciaLua = new Date('2000-01-06T18:14:00Z')
const duracaoCiclo = 29.530588853
const diasDesdeReferencia = (hoje - referenciaLua) / 86400000
const idadeLua = ((diasDesdeReferencia % duracaoCiclo) + duracaoCiclo) % duracaoCiclo
const progresso = idadeLua / duracaoCiclo

const fases = [
  { nome: 'Lua Nova', emoji: '🌑', inicio: 0,
    texto: 'A Lua fica entre a Terra e o Sol, e sua face iluminada não é visível da Terra.' },
  { nome: 'Lua Crescente', emoji: '🌒', inicio: 0.0625,
    texto: 'Um pequeno arco iluminado começa a aparecer no céu.' },
  { nome: 'Quarto Crescente', emoji: '🌓', inicio: 0.1875,
    texto: 'Metade aparente do disco lunar está iluminada.' },
  { nome: 'Crescente Gibosa', emoji: '🌔', inicio: 0.3125,
    texto: 'Mais da metade da Lua está iluminada, aproximando-se da Lua Cheia.' },
  { nome: 'Lua Cheia', emoji: '🌕', inicio: 0.4375,
    texto: 'A face lunar voltada para a Terra aparece praticamente toda iluminada.' },
  { nome: 'Minguante Gibosa', emoji: '🌖', inicio: 0.5625,
    texto: 'A iluminação começa a diminuir, mas mais da metade continua visível.' },
  { nome: 'Quarto Minguante', emoji: '🌗', inicio: 0.6875,
    texto: 'Metade aparente do disco lunar está iluminada durante a fase minguante.' },
  { nome: 'Lua Minguante', emoji: '🌘', inicio: 0.8125,
    texto: 'Um pequeno arco iluminado permanece visível antes da Lua Nova.' }
]

const faseAtual = computed(() => {
  return [...fases]
    .reverse()
    .find(fase => progresso >= fase.inicio) || fases[0]
})

const iluminacao = computed(() => {
  return Math.round((1 - Math.cos(2 * Math.PI * progresso)) / 2 * 100)
})

const regiaoAtiva = ref(0)
const carrosselRegioes = ref(null)
function selecionarRegiao(indice) {
  const destino = Math.max(0, Math.min(regioesAgricolas.length - 1, indice))
  regiaoAtiva.value = destino
  const faixa = carrosselRegioes.value
  const cartao = faixa?.querySelector(`[data-regiao-indice="${destino}"]`)
  if (faixa && cartao) faixa.scrollTo({ left: cartao.offsetLeft - faixa.offsetLeft, behavior: 'smooth' })
}
function atualizarRegiaoVisivel() {
  const faixa = carrosselRegioes.value
  if (!faixa) return
  const centro = faixa.scrollLeft + faixa.clientWidth / 2
  let maisProxima = 0
  let distancia = Infinity
  faixa.querySelectorAll('[data-regiao-indice]').forEach((cartao, indice) => {
    const centroCartao = cartao.offsetLeft + cartao.offsetWidth / 2
    const atual = Math.abs(centroCartao - centro)
    if (atual < distancia) { distancia = atual; maisProxima = indice }
  })
  regiaoAtiva.value = maisProxima
}
const paginaAtiva = ref('principal')
const chatRef = ref(null)
const paginaAnteriorChat = ref('principal')
const paginasDisponiveis = new Set(['principal', 'fases', 'observacao', 'agricultura', 'chat', 'opiniao', 'dedicatoria'])
const nomeOpiniao = ref('')
const textoOpiniao = ref('')
const enviandoOpiniao = ref(false)
const retornoOpiniao = ref('')
const erroOpiniao = ref('')
const aceitaPublicarOpiniao = ref(false)
const historicoVisivel = ref(false)
const opinioesAnteriores = ref([])
const carregandoHistorico = ref(false)
const historicoErro = ref('')
const historicoOffset = ref(0)
const historicoTemMais = ref(true)
const visitantesOnline = ref(0)
const contagemVisitantesConectada = ref(false)
let canalVisitantes = null

function iniciarContagemVisitantes() {
  if (!supabaseConfigured || !supabase) return
  const idSessao = globalThis.crypto?.randomUUID?.() || `sessao-${Date.now()}-${Math.random().toString(36).slice(2)}`
  canalVisitantes = supabase.channel('lua-hoje-visitantes', { config: { presence: { key: idSessao } } })
    .on('presence', { event: 'sync' }, () => {
      visitantesOnline.value = Object.keys(canalVisitantes?.presenceState() || {}).length
      contagemVisitantesConectada.value = true
    })
    .subscribe(estado => {
      if (estado === 'SUBSCRIBED') {
        contagemVisitantesConectada.value = true
        void canalVisitantes.track({ ativo: true })
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) {
        visitantesOnline.value = 0
        contagemVisitantesConectada.value = false
      }
    })
}

function mensagemErroOpiniao(error) {
  if (['42P01', 'PGRST205'].includes(error?.code)) {
    return 'A tabela de opiniões ainda não existe no Supabase. Execute a migração supabase/migrations/20261031_opinioes.sql.'
  }
  if (['PGRST204', '42703'].includes(error?.code)) {
    return 'O Supabase ainda não tem a coluna de publicação das opiniões. Execute supabase/migrations/20261101_opinioes_historico_publico.sql no SQL Editor.'
  }
  if (error?.code === '42501') {
    return 'O Supabase bloqueou esta ação pelas políticas da tabela opinioes. Confira as políticas da migração de histórico público.'
  }
  return 'Não foi possível conectar ao Supabase para acessar as opiniões. Verifique a conexão e tente novamente.'
}

async function carregarHistorico(limpar = false) {
  if (!supabaseConfigured || !supabase) {
    historicoErro.value = 'A conexão com o Supabase ainda não está configurada.'
    return
  }
  if (carregandoHistorico.value || (!historicoTemMais.value && !limpar)) return

  carregandoHistorico.value = true
  historicoErro.value = ''
  const inicio = limpar ? 0 : historicoOffset.value

  try {
    const { data, error } = await supabase
      .from('opinioes')
      .select('id, nome, opiniao, criado_em')
      .eq('visivel_publicamente', true)
      .order('criado_em', { ascending: false })
      .range(inicio, inicio + 49)

    if (error) {
      historicoErro.value = mensagemErroOpiniao(error)
      return
    }

    const resultados = data || []
    opinioesAnteriores.value = limpar ? resultados : [...opinioesAnteriores.value, ...resultados]
    historicoOffset.value = inicio + resultados.length
    historicoTemMais.value = resultados.length === 50
  } catch (error) {
    historicoErro.value = mensagemErroOpiniao(error)
  } finally {
    carregandoHistorico.value = false
  }
}

async function alternarHistorico() {
  historicoVisivel.value = !historicoVisivel.value
  if (historicoVisivel.value && !opinioesAnteriores.value.length) await carregarHistorico(true)
}

function formatarDataOpiniao(data) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data))
}

async function enviarOpiniao() {
  const nome = nomeOpiniao.value.trim()
  const opiniao = textoOpiniao.value.trim()
  retornoOpiniao.value = ''
  erroOpiniao.value = ''

  if (!supabaseConfigured || !supabase) {
    erroOpiniao.value = 'A conexão com o Supabase ainda não está configurada.'
    return
  }
  if (nome.length < 2 || nome.length > 80) {
    erroOpiniao.value = 'Informe um nome entre 2 e 80 caracteres.'
    return
  }
  if (opiniao.length < 5 || opiniao.length > 1500) {
    erroOpiniao.value = 'A opinião deve ter entre 5 e 1.500 caracteres.'
    return
  }

  enviandoOpiniao.value = true
  try {
    const { error } = await supabase.from('opinioes').insert({ nome, opiniao, visivel_publicamente: true })
    if (error) {
      erroOpiniao.value = mensagemErroOpiniao(error)
      return
    }

    retornoOpiniao.value = `Obrigado, ${nome}! Sua opinião foi registrada.`
    nomeOpiniao.value = ''
    textoOpiniao.value = ''
    aceitaPublicarOpiniao.value = false
    if (historicoVisivel.value) await carregarHistorico(true)
  } catch (error) {
    erroOpiniao.value = mensagemErroOpiniao(error)
  } finally {
    enviandoOpiniao.value = false
  }
}
function lerPaginaDaUrl() {
  const pagina = window.location.hash.slice(1)
  return paginasDisponiveis.has(pagina) ? pagina : 'principal'
}

function sincronizarPaginaComUrl() {
  const pagina = lerPaginaDaUrl()
  if (paginaAtiva.value === 'chat' && pagina !== 'chat') {
    paginaAnteriorChat.value = pagina
  } else if (pagina === 'chat' && paginaAtiva.value !== 'chat') {
    paginaAnteriorChat.value = paginaAtiva.value
  }
  paginaAtiva.value = pagina
  if (pagina === 'chat') chatRef.value?.abrirChat()
  window.scrollTo({ top: 0 })
}

function navegar(pagina) {
  if (!paginasDisponiveis.has(pagina)) return
  if (pagina === 'chat') {
    if (paginaAtiva.value !== 'chat') paginaAnteriorChat.value = paginaAtiva.value
    paginaAtiva.value = 'chat'
    if (window.location.hash !== '#chat') window.history.pushState({ pagina }, '', '#chat')
    chatRef.value?.abrirChat()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  paginaAtiva.value = pagina
  if (window.location.hash !== `#${pagina}`) window.history.pushState({ pagina }, '', `#${pagina}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function voltarAoPopupDoChat() {
  navegar(paginaAnteriorChat.value || 'principal')
}


// Área de desenho da Lua
const canvasRef = ref(null)
const resultadoDesenho = ref(null)

let desenhando = false

function prepararTela() {
  if (paginaAtiva.value === 'observacao') prepararLua()
}

function prepararLua() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const centro = canvas.width / 2
  const raio = 112

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Disco lunar escuro
  ctx.beginPath()
  ctx.arc(centro, centro, raio, 0, Math.PI * 2)
  ctx.fillStyle = '#303247'
  ctx.fill()

  ctx.strokeStyle = '#77758e'
  ctx.lineWidth = 2
  ctx.stroke()

  // Limita o desenho ao interior do disco lunar
  ctx.save()
  ctx.beginPath()
  ctx.arc(centro, centro, raio - 2, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = '#f4edcf'
  ctx.strokeStyle = '#f4edcf'
  ctx.lineWidth = 17
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.restore()
}

function iniciarDesenho(event) {
  desenhando = true
  canvasRef.value.setPointerCapture(event.pointerId)
  desenhar(event)
}

function desenhar(event) {
  if (!desenhando) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const retangulo = canvas.getBoundingClientRect()

  const x = (event.clientX - retangulo.left) * canvas.width / retangulo.width
  const y = (event.clientY - retangulo.top) * canvas.height / retangulo.height

  if (Math.hypot(x - 130, y - 130) > 110) return

  ctx.beginPath()
  ctx.arc(x, y, 11.88, 0, Math.PI * 2)
  ctx.fillStyle = '#f4edcf'
  ctx.fill()
}

function finalizarDesenho() {
  desenhando = false
}

function limparDesenho() {
  resultadoDesenho.value = null
  prepararLua()
}


function identificarFase() {
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data

  const centro = canvas.width / 2
  const raio = 108

  let total = 0
  let iluminados = 0
  let somaX = 0

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const distancia = Math.hypot(x - centro, y - centro)

      if (distancia > raio) continue

      total++

      const indice = (y * canvas.width + x) * 4
      const brilho =
        (pixels[indice] + pixels[indice + 1] + pixels[indice + 2]) / 3

      if (brilho > 170) {
        iluminados++
        somaX += x
      }
    }
  }

  const percentual = Math.round((iluminados / total) * 100)

  const centroIluminado =
    iluminados > 0 ? somaX / iluminados : centro

  const lado = centroIluminado < centro ? 'esquerdo' : 'direito'

  let fase = ''

  if (percentual < 5) {
    fase = 'Lua Nova'
  } else if (percentual > 95) {
    fase = 'Lua Cheia'
  } else if (percentual >= 45 && percentual <= 55) {
    fase = lado === 'esquerdo' ? 'Quarto Crescente' : 'Quarto Minguante'
  } else if (percentual < 45) {
    fase = lado === 'esquerdo' ? 'Lua Crescente' : 'Lua Minguante'
  } else {
    fase = lado === 'esquerdo' ? 'Lua Gibosa Crescente' : 'Lua Gibosa Minguante'
  }

  resultadoDesenho.value = {
    fase,
    percentual,
    orientacao: `lado ${lado} iluminado`
  }
}


onMounted(() => {
  paginaAtiva.value = lerPaginaDaUrl()
  if (paginaAtiva.value === 'chat') chatRef.value?.abrirChat()
  window.addEventListener('popstate', sincronizarPaginaComUrl)
  iniciarContagemVisitantes()
})

onUnmounted(() => {
  window.removeEventListener('popstate', sincronizarPaginaComUrl)
  if (canalVisitantes && supabase) void supabase.removeChannel(canalVisitantes)
})

</script>

<template>
  <div class="app">
    <header class="topbar">
      <a class="logo" href="#principal" @click.prevent="navegar('principal')">
        <span class="logo-icon">☾</span>
        <span>lua<span class="logo-destaque">hoje</span></span>
      </a>

      <nav class="menu" aria-label="Navegação principal">
        <a href="#principal" :class="{ ativo: paginaAtiva === 'principal' }" :aria-current="paginaAtiva === 'principal' ? 'page' : undefined" @click.prevent="navegar('principal')">Início</a>
        <a href="#fases" :class="{ ativo: paginaAtiva === 'fases' }" :aria-current="paginaAtiva === 'fases' ? 'page' : undefined" @click.prevent="navegar('fases')">Fases da Lua</a>
        <a href="#observacao" :class="{ ativo: paginaAtiva === 'observacao' }" :aria-current="paginaAtiva === 'observacao' ? 'page' : undefined" @click.prevent="navegar('observacao')">Desenhe a Lua</a>
        <a href="#agricultura" :class="{ ativo: paginaAtiva === 'agricultura' }" :aria-current="paginaAtiva === 'agricultura' ? 'page' : undefined" @click.prevent="navegar('agricultura')">Lua e agricultura</a>
        <a href="#chat" :class="{ ativo: paginaAtiva === 'chat' }" :aria-current="paginaAtiva === 'chat' ? 'page' : undefined" @click.prevent="navegar('chat')">Chat lunar</a>
        <a href="#opiniao" :class="{ ativo: paginaAtiva === 'opiniao' }" :aria-current="paginaAtiva === 'opiniao' ? 'page' : undefined" @click.prevent="navegar('opiniao')">Deixe sua opinião</a>
        <a href="#dedicatoria" :class="{ ativo: paginaAtiva === 'dedicatoria' }" :aria-current="paginaAtiva === 'dedicatoria' ? 'page' : undefined" @click.prevent="navegar('dedicatoria')">Dedicatória</a>
      </nav>
    </header>

    <main>
      <Transition name="screen" mode="out-in" @after-enter="prepararTela">
        <div id="principal" v-if="paginaAtiva === 'principal'" key="principal">
      <section id="inicio" class="hero" >
        <div class="hero-texto">
          <span class="etiqueta"><span class="ponto"></span> ASTRONOMIA AO SEU ALCANCE</span>
          <h1>Olhe para o céu.<br />Descubra a <span>Lua de hoje.</span></h1>
          <p>
            Acompanhe as fases lunares, entenda os ciclos da Lua
            e descubra a relação histórica entre o céu e a agricultura.
          </p>
          <button class="botao-principal" @click="navegar('fases')">
            Explorar fases da Lua <span>→</span>
          </button>
        </div>

        <div class="lua-destaque">
          <div class="orbita orbita-externa"></div>
          <div class="orbita orbita-interna"></div>
          <div class="lua-emoji">{{ faseAtual.emoji }}</div>
          <span class="estrela estrela-1">✦</span>
          <span class="estrela estrela-2">✧</span>
          <span class="estrela estrela-3">·</span>
          <span class="estrela estrela-4">✦</span>
        </div>
      </section>

      <section class="resumo-lunar" >
        <div class="resumo-titulo">
          <div>
            <span class="sobretitulo">ACOMPANHAMENTO LUNAR</span>
            <h2>A Lua agora</h2>
          </div>
          <span class="data-resumo">{{ hoje.toLocaleDateString('pt-BR') }}</span>
        </div>

        <div class="dados-grid">
          <article class="dado-card fase-card">
            <span class="dado-icone">{{ faseAtual.emoji }}</span>
            <div>
              <span class="dado-label">FASE ATUAL</span>
              <h3>{{ faseAtual.nome }}</h3>
              <p>Fase lunar estimada para hoje</p>
            </div>
          </article>

          <article class="dado-card">
            <span class="dado-label">ILUMINAÇÃO</span>
            <h3>{{ iluminacao }}<small>%</small></h3>
            <div class="barra-fundo">
              <div class="barra-progresso" :style="{ width: iluminacao + '%' }"></div>
            </div>
            <p>Parte iluminada da Lua</p>
          </article>

          <article class="dado-card">
            <span class="dado-label">IDADE LUNAR</span>
            <h3>{{ idadeLua.toFixed(1) }} <small>dias</small></h3>
            <p>De um ciclo de aproximadamente 29,5 dias</p>
          </article>
        </div>
        <p class="nota-dados">Dados calculados por aproximação astronômica. A fase e a iluminação podem variar conforme a localização e o horário de observação.</p>
      </section>


        </div>
              <section id="fases" v-else-if="paginaAtiva === 'fases'" class="secao-fases">
        <div class="titulo-secao">
          <span class="sobretitulo">O CICLO LUNAR</span>
          <h2>As fases da Lua</h2>
          <p>A Lua passa por diferentes fases durante seu ciclo ao redor da Terra.</p>
        </div>

        <div class="fases-grid">
          <article
            v-for="fase in fases"
            :key="fase.nome"
            class="fase-item"
          >
            <span class="fase-emoji">{{ fase.emoji }}</span>
            <h3>{{ fase.nome }}</h3>
            <p>{{ fase.texto }}</p>
          </article>
        </div>

      </section>
        <section id="observacao" v-else-if="paginaAtiva === 'observacao'" class="observacao">
  <div class="titulo-secao">
    <span class="sobretitulo">SUA OBSERVAÇÃO</span>
    <h2>Desenhe a Lua que você está vendo</h2>
    <p>
      Pinte com o mouse ou com o dedo a parte iluminada da Lua
      conforme você a observa no céu.
    </p>
  </div>

  <div class="desenho-container">
    <div class="area-desenho">
      <canvas
        ref="canvasRef"
        width="260"
        height="260"
        class="lua-canvas"
        @pointerdown="iniciarDesenho"
        @pointermove="desenhar"
        @pointerup="finalizarDesenho"
        @pointercancel="finalizarDesenho"
        @pointerleave="finalizarDesenho"
      ></canvas>

      <span class="instrucao-desenho">
        <span>✦</span> Área de desenho
      </span>
    </div>

    <div class="controles-desenho">
      <h3>Como está a Lua no céu?</h3>
      <p>
        Desenhe a parte que parece iluminada. Não precisa
        ficar perfeito: o sistema fará uma estimativa.
      </p>

      <button class="botao-principal" @click="identificarFase">
        Identificar fase →
      </button>

      <button class="botao-limpar" @click="limparDesenho">
        Limpar desenho
      </button>

      <div v-if="resultadoDesenho" class="resultado-desenho">
        <span class="sobretitulo">RESULTADO DA OBSERVAÇÃO</span>
        <h3>{{ resultadoDesenho.fase }}</h3>
        <p>Iluminação desenhada: {{ resultadoDesenho.percentual }}%</p>
        <p v-if="resultadoDesenho.orientacao">
          {{ resultadoDesenho.orientacao }}
        </p>
        <small>
          Resultado aproximado, baseado no desenho realizado.
        </small>
      </div>
    </div>
  </div>
</section>


      <section id="agricultura" v-else-if="paginaAtiva === 'agricultura'" class="agricultura">
        <div class="agricultura-cabecalho">
          <span class="sobretitulo">CÉU, ESTAÇÕES E CULTIVO</span>
          <h2>A Lua e a agricultura</h2>
          <p>O calendário do campo acompanha principalmente as chuvas, a temperatura e as características de cada região. As fases da Lua fazem parte de saberes tradicionais que atravessam gerações — e podem inspirar observação e conversa.</p>
        </div>

        <div class="agricultura-destaque">
          <div class="agricultura-ilustracao" aria-hidden="true"><span>🌱</span><span class="agricultura-lua">☾</span><i>✦</i></div>
          <div class="agricultura-texto">
            <span class="sobretitulo">UM CALENDÁRIO VIVO</span>
            <h3>Cultivos e estações pelo Brasil</h3>
            <p>As épocas de plantio variam entre regiões e também entre estados, municípios, tipos de solo e cultivares. Explore alguns exemplos sazonais das cinco regiões brasileiras.</p>
            <p class="aviso-agricola"><strong>E a Lua?</strong> Fases lunares podem inspirar observação de saberes tradicionais; clima, água e manejo continuam sendo fatores centrais no planejamento agrícola.</p>
          </div>
        </div>

        <aside class="ciclo-lunar-agricola">
          <div class="ciclo-lunar-texto">
            <span class="sobretitulo">TRADIÇÃO E OBSERVAÇÃO</span>
            <h3>O ciclo da Lua também pode entrar no diário de campo</h3>
            <p>O ciclo lunar dura cerca de 29,5 dias. Em calendários tradicionais, a Lua crescente costuma ser associada ao plantio de culturas de parte aérea, e a minguante, às raízes. Essa relação é um saber cultural para observar, não uma recomendação agronômica comprovada.</p>
            <p>Pesquisas sobre luz lunar e plantas continuam em andamento; os resultados ainda não justificam usar a fase da Lua para prever uma boa safra. Clima, solo e janela local seguem essenciais.</p>
            <div class="fontes-lunares"><a href="https://www.mdpi.com/2073-4395/10/7/955" target="_blank" rel="noopener noreferrer">Revisão científica sobre Lua e agricultura ↗</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11963477/" target="_blank" rel="noopener noreferrer">Estudo experimental sobre luz lunar ↗</a></div>
          </div>
          <div class="ciclo-lunar-fases" aria-label="Fases principais do ciclo lunar">
            <span><i>🌑</i><small>Nova</small></span><b aria-hidden="true">→</b><span><i>🌓</i><small>Crescente</small></span><b aria-hidden="true">→</b><span><i>🌕</i><small>Cheia</small></span><b aria-hidden="true">→</b><span><i>🌗</i><small>Minguante</small></span>
          </div>
        </aside>

        <div class="linha-tempo painel-regioes">
          <div class="linha-tempo-titulo"><div><span class="sobretitulo">BRASIL · CALENDÁRIO ZARC</span><h3>Janelas de plantio por região</h3></div><span class="contador-regiao">{{ String(regiaoAtiva + 1).padStart(2, '0') }} / {{ String(regioesAgricolas.length).padStart(2, '0') }}</span></div>
          <nav class="botoes-regiao" aria-label="Escolha uma região agrícola">
            <button v-for="(regiao, indice) in regioesAgricolas" :key="regiao.id" type="button" :class="{ ativo: regiaoAtiva === indice }" :aria-pressed="regiaoAtiva === indice" @click="selecionarRegiao(indice)">{{ regiao.nome }}</button>
          </nav>
          <div class="carrossel-regioes-controles">
            <button type="button" class="seta-regiao" aria-label="Região anterior" :disabled="regiaoAtiva === 0" @click="selecionarRegiao(regiaoAtiva - 1)">←</button>
            <div ref="carrosselRegioes" class="carrossel-regioes" aria-label="Calendários agrícolas por região" @scroll.passive="atualizarRegiaoVisivel">
              <article v-for="(regiao, indice) in regioesAgricolas" :id="`regiao-${regiao.id}`" :key="regiao.id" :data-regiao-indice="indice" class="cartao-regiao" :aria-label="`Região ${regiao.nome}`">
                <div class="cartao-regiao-topo"><div><span class="sobretitulo">REGIÃO {{ regiao.nome.toLocaleUpperCase('pt-BR') }}</span><h4>{{ regiao.nome }}</h4><p>{{ regiao.estados }}</p></div><span class="icone-regiao" aria-hidden="true">{{ ['☀️', '🌵', '🌱', '☕', '🌾'][indice] }}</span></div>
                <p class="resumo-regiao">{{ regiao.resumo }}</p>
                <div class="culturas-destaque"><strong>Principais cultivos da região</strong><span v-for="cultura in regiao.destaques" :key="cultura">{{ cultura }}</span></div>
                <p class="rotulo-calendario">Cultivos de destaque e janelas de semeadura/implantação</p>
                <div class="tempo-meses meses-regiao"><span v-for="(mes, indiceMes) in mesesAgricolas" :key="mes"><span class="mes-abreviado">{{ mes }}</span><span class="mes-numero">{{ String(indiceMes + 1).padStart(2, '0') }}</span></span></div>
                <div v-for="cultura in regiao.culturas" :key="cultura.nome" class="tempo-linha linha-regional">
                  <div class="tempo-cultura cultura-icone"><span role="img" :aria-label="cultura.detalhe || cultura.nome" :title="cultura.detalhe || cultura.nome">{{ cultura.icone }}</span></div>
                  <div class="tempo-trilho">
                    <span v-for="(intervalo, indiceFaixa) in intervalosDeMeses(cultura.meses)" :key="indiceFaixa" class="tempo-faixa" :class="cultura.cor" :style="{ gridColumn: `${intervalo.inicio} / ${intervalo.fim + 1}` }"></span>
                    <span v-if="cultura.semPeriodo" class="zarc-sem-periodo">sem janela localizada para este município</span>
                  </div>
                </div>
                <div class="legenda-culturas" aria-label="Legenda de culturas">
                  <span v-for="cultura in regiao.culturas" :key="cultura.nome"><i aria-hidden="true">{{ cultura.icone }}</i><b class="legenda-amostra" :class="cultura.cor" aria-hidden="true"></b><span><strong>{{ cultura.nome }}</strong><br>{{ cultura.detalhe }}<small>Município líder: {{ cultura.municipio }} · PAM 2024</small></span></span>
                </div>
                <p class="tempo-nota">A duração ou o ciclo aparece na legenda de cada cultivo quando há informação compatível. Algumas culturas variam conforme o grupo e a cultivar indicados no ZARC.</p>
              </article>
            </div>
            <button type="button" class="seta-regiao" aria-label="Próxima região" :disabled="regiaoAtiva === regioesAgricolas.length - 1" @click="selecionarRegiao(regiaoAtiva + 1)">→</button>
          </div>
          <div class="indicadores-regiao" aria-label="Posição no carrossel"><button v-for="(regiao, indice) in regioesAgricolas" :key="regiao.id" type="button" :class="{ ativo: regiaoAtiva === indice }" :aria-label="`Ir para região ${regiao.nome}`" :aria-current="regiaoAtiva === indice ? 'step' : undefined" @click="selecionarRegiao(indice)"></button></div>
          <p class="tempo-nota nota-zarc">As faixas do ZARC mostram os meses com ao menos uma combinação de solo e grupo de cultivar com risco de 20% no município líder. Café arábica usa a tabela perene do ZARC; o conilon mostra a época técnica de implantação no período chuvoso (Incaper). Para tabaco Virgínia em Canguçu, a faixa representa o calendário Foniagro de transplante de mudas no Centro-Sul do RS, não uma janela ZARC. Os municípios líderes foram definidos pela produção da PAM 2024; outros municípios e condições podem ter períodos diferentes.</p>
          <a class="link-zarc" href="https://dados.agricultura.gov.br/dataset/6d3d141c-885e-41a4-ab7f-dc8ff323b96f" target="_blank" rel="noopener noreferrer">Fonte: Tábua de Risco ZARC · dados abertos <span>↗</span></a>
          <a class="link-zarc" href="https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/painel-de-indicacao-de-riscos-1" target="_blank" rel="noopener noreferrer">Consultar as janelas oficiais no ZARC <span>↗</span></a>
          <a class="link-zarc" href="https://sidra.ibge.gov.br/tabela/5457" target="_blank" rel="noopener noreferrer">PAM 2024 · quantidade produzida por município · SIDRA 5457 <span>↗</span></a>
          <a class="link-zarc" href="https://biblioteca.incaper.es.gov.br/digital/bitstream/item/701/1/livro2007cafeconilon9.pdf" target="_blank" rel="noopener noreferrer">Incaper · Café Conilon: época de plantio no Espírito Santo <span>↗</span></a>
          <a class="link-zarc" href="https://revistacultivar.com/index.php/news/Southern-Brazil-begins-planting-tobacco-for-the-2026-crop." target="_blank" rel="noopener noreferrer">Calendário Foniagro 2026/27 · transplante de tabaco Virgínia <span>↗</span></a>
          <a class="link-zarc" href="https://agenciadenoticias.ibge.gov.br/media/com_mediaibge/arquivos/86bd2f37f9fffb7f3941e1c74351f469.pdf" target="_blank" rel="noopener noreferrer">Referência dos cultivos de destaque: IBGE · PAM 2024 <span>↗</span></a>
        </div>

        <div class="agricultura-final"><span>🌙</span><p><strong>Uma boa pergunta para observar:</strong> em qual fase estava a Lua quando começou o plantio na sua comunidade? Compartilhe suas experiências no chat e compare os saberes tradicionais com as informações científicas.</p><button class="botao-principal" @click="navegar('chat')">Conversar no chat <span>→</span></button></div>
      </section>
      <section id="dedicatoria" v-else-if="paginaAtiva === 'dedicatoria'" class="dedicatoria">
        <div class="dedicatoria-cosmos" aria-hidden="true"><span class="dedicatoria-orbita orbita-um"></span><span class="dedicatoria-orbita orbita-dois"></span><span class="dedicatoria-lua">☾</span><i class="dedicatoria-estrela estrela-a">✦</i><i class="dedicatoria-estrela estrela-b">✧</i><i class="dedicatoria-estrela estrela-c">✦</i><i class="dedicatoria-estrela estrela-d">·</i></div>
        <article class="dedicatoria-quadro">
          <span class="sobretitulo">UM OLHAR QUE VIROU PROJETO</span>
          <h2>Para minha mãe</h2>
          <span class="dedicatoria-divisor" aria-hidden="true">✦ · ☾ · ✦</span>
          <figure class="dedicatoria-retrato"><img src="/dedicatoria-constelacao-transparente.png" alt="Silhueta de uma mãe beijando o filho, formada por estrelas e linhas de constelação" /></figure>
          <p class="dedicatoria-citacao">“Filho, vem ver a Lua, como está linda!”</p>
          <p>Mãe, foi assim, no encanto simples de um chamado, que este projeto encontrou sua primeira inspiração. Em cada vez que você me convidou a olhar para o céu, ensinou que a beleza do universo fica ainda maior quando é compartilhada.</p>
          <p>Esta Lua, estas estrelas e cada descoberta sobre o nosso pequeno sistema solar guardam um pouco daquele instante: duas pessoas olhando para o mesmo céu e encontrando nele motivo para se aproximar, imaginar e aprender.</p>
          <p class="dedicatoria-assinatura">Com amor e gratidão,<br /><strong>seu filho, Wellington</strong></p>
          <span class="dedicatoria-rodape">Sob o mesmo céu, em todas as fases. ☾</span>
        </article>
        <p class="dedicatoria-nota">Uma homenagem a quem me ensinou a parar por um instante e olhar para cima.</p>
      </section>
      <section id="opiniao" v-else-if="paginaAtiva === 'opiniao'" class="opiniao">
        <div class="opiniao-intro">
          <span class="sobretitulo">SOBRE O PROJETO</span>
          <h2>LuaHoje</h2>
          <p>O LuaHoje é um projeto acadêmico desenvolvido no Projeto Integrador do curso de Tecnologia da Informação da UFMS. Ele reúne informações sobre as fases da Lua, incentiva a observação do céu e apresenta relações entre a Lua e a agricultura. O chat também promove a troca de ideias e observações, convidando a comunidade a participar de forma colaborativa na construção do conhecimento.</p>
          <span class="opiniao-criador">Criado por Wellington Sponchiado.</span>
        </div>

        <div class="opiniao-form-card">
          <span class="sobretitulo">SUA PARTICIPAÇÃO</span>
          <h2>Deixe sua opinião</h2>
          <p>Sua opinião ajuda a melhorar o LuaHoje e a fortalecer este espaço de aprendizado. Conte o que achou do projeto, o que foi útil e o que poderia ficar melhor.</p>
          <form class="opiniao-form" @submit.prevent="enviarOpiniao">
            <label for="nome-opiniao">Seu nome</label>
            <input id="nome-opiniao" v-model="nomeOpiniao" type="text" maxlength="80" autocomplete="name" placeholder="Digite seu nome" required />
            <label for="texto-opiniao">Sua opinião</label>
            <textarea id="texto-opiniao" v-model="textoOpiniao" maxlength="1500" rows="6" placeholder="Escreva aqui sua opinião" required></textarea>
            <label class="opiniao-consentimento"><input v-model="aceitaPublicarOpiniao" type="checkbox" required /><span>Concordo que meu nome e minha opinião apareçam no histórico público do LuaHoje.</span></label>
            <button class="botao-principal" type="submit" :disabled="enviandoOpiniao || !aceitaPublicarOpiniao || !nomeOpiniao.trim() || !textoOpiniao.trim()">
              {{ enviandoOpiniao ? 'Enviando…' : 'Enviar opinião' }} <span>→</span>
            </button>
          </form>
          <p v-if="retornoOpiniao" class="opiniao-sucesso" role="status">{{ retornoOpiniao }}</p>
          <p v-if="erroOpiniao" class="chat-erro" role="alert">{{ erroOpiniao }}</p>
        </div>
        <div class="opiniao-historico">
          <div class="opiniao-historico-topo">
            <div><span class="sobretitulo">VOZES DA COMUNIDADE</span><h3>Histórico de opiniões</h3><p>As contribuições ajudam a registrar como o projeto é recebido e o que pode melhorar.</p></div>
            <button class="botao-historico" type="button" :aria-expanded="historicoVisivel" @click="alternarHistorico">{{ historicoVisivel ? 'Ocultar histórico' : 'Consultar opiniões' }}</button>
          </div>
          <p v-if="historicoErro" class="chat-erro" role="alert">{{ historicoErro }}</p>
          <div v-if="historicoVisivel" class="opiniao-lista" aria-live="polite">
            <p v-if="carregandoHistorico && !opinioesAnteriores.length" class="opiniao-lista-vazia">Carregando opiniões…</p>
            <p v-else-if="!opinioesAnteriores.length" class="opiniao-lista-vazia">Ainda não há opiniões registradas.</p>
            <article v-for="item in opinioesAnteriores" :key="item.id" class="opiniao-item">
              <div><strong>{{ item.nome }}</strong><time :datetime="item.criado_em">{{ formatarDataOpiniao(item.criado_em) }}</time></div>
              <p>{{ item.opiniao }}</p>
            </article>
            <button v-if="historicoTemMais && opinioesAnteriores.length" class="botao-historico carregar-mais" type="button" :disabled="carregandoHistorico" @click="carregarHistorico()">{{ carregandoHistorico ? 'Carregando…' : 'Carregar mais opiniões' }}</button>
          </div>
        </div>
      </section>
      </Transition>
      <Chat ref="chatRef" :expandido="paginaAtiva === 'chat'" @voltar-ao-popup="voltarAoPopupDoChat" />
    </main>

    <footer>
      <a class="logo" href="#inicio"><span class="logo-icon">☾</span>
        <span>lua<span class="logo-destaque">hoje</span></span>
      </a>
      <p>Conhecimento, observação e conexão com a natureza.</p>
      <div class="visitas-online" role="status" aria-live="polite">
        <span class="visitas-ponto" :class="{ conectado: contagemVisitantesConectada }" aria-hidden="true"></span>
        <span>{{ contagemVisitantesConectada ? `${visitantesOnline} ${visitantesOnline === 1 ? 'pessoa' : 'pessoas'} online agora` : 'Contagem temporariamente indisponível' }}</span>
      </div>
      <span>Projeto Integrador - UFMS</span>
    </footer>
  </div>
</template>
