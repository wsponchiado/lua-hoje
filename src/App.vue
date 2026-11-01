<script setup>
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import Chat from './components/Chat.vue'
import { supabase, supabaseConfigured } from './lib/supabase'

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

const mesesAgricolas = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const calendarioAgricola = [
  { nome: 'Arroz irrigado', detalhe: 'MS · implantação no período indicado para o sistema', icone: '🌾', inicio: 8, fim: 11, cor: 'faixa-verde' },
  { nome: 'Milho · 1ª safra', detalhe: 'MS · início das chuvas', icone: '🌽', inicio: 9, fim: 11, cor: 'faixa-dourada' },
  { nome: 'Milho · safrinha', detalhe: 'Centro-Oeste · após a cultura principal', icone: '🌽', inicio: 1, fim: 3, cor: 'faixa-lilas' },
  { nome: 'Café · mudas', detalhe: 'Plantio com o começo das chuvas', icone: '☕', inicio: 11, fim: 12, cor: 'faixa-cafe' },
  { nome: 'Arroz de terras altas', detalhe: 'Centro-Oeste · janela varia por município', icone: '🌾', inicio: 10, fim: 12, cor: 'faixa-azul' }
]
const paginaAtiva = ref('principal')
const chatRef = ref(null)
const nomeOpiniao = ref('')
const textoOpiniao = ref('')
const enviandoOpiniao = ref(false)
const retornoOpiniao = ref('')
const erroOpiniao = ref('')

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
  const { error } = await supabase.from('opinioes').insert({ nome, opiniao })
  if (error) {
    erroOpiniao.value = ['42P01', 'PGRST205'].includes(error.code)
      ? 'A tabela de opiniões ainda precisa ser criada no Supabase. Execute o SQL indicado no arquivo de migração.'
      : error.code === '42501'
        ? 'O Supabase bloqueou o envio. Verifique a política de inserção da tabela de opiniões.'
        : 'Não foi possível registrar sua opinião agora. Tente novamente.'
  } else {
    retornoOpiniao.value = `Obrigado, ${nome}! Sua opinião foi registrada.`
    nomeOpiniao.value = ''
    textoOpiniao.value = ''
  }
  enviandoOpiniao.value = false
}
function navegar(pagina) {
  if (pagina === 'chat') {
    chatRef.value?.abrirChat()
    return
  }
  paginaAtiva.value = pagina
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  ctx.arc(x, y, 9.9, 0, Math.PI * 2)
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


watch(paginaAtiva, async pagina => {
  if (pagina === 'observacao') {
    await nextTick()
    prepararLua()
  }
})

onMounted(() => {
  prepararLua()
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
        <a href="#opiniao" :class="{ ativo: paginaAtiva === 'opiniao' }" :aria-current="paginaAtiva === 'opiniao' ? 'page' : undefined" @click.prevent="navegar('opiniao')">Deixe sua opinião</a>
        <a href="#chat" @click.prevent="navegar('chat')">Chat lunar</a>
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
            <h3>O tempo de plantar começa no solo</h3>
            <p>Na região de Mato Grosso do Sul e do Centro-Oeste, a chegada das chuvas costuma orientar o início de várias culturas. Mesmo assim, a janela adequada muda conforme município, tipo de solo, cultivar e sistema de produção.</p>
            <p class="aviso-agricola"><strong>E a Lua?</strong> Plantar em determinada fase lunar é uma prática cultural interessante para investigar. Ela não substitui recomendações agronômicas: clima, água e manejo são os fatores centrais para planejar a lavoura.</p>
          </div>
        </div>

        <div class="linha-tempo">
          <div class="linha-tempo-titulo"><div><span class="sobretitulo">REFERÊNCIA SAZONAL</span><h3>Um ano no campo</h3></div><p>Janelas gerais e educativas para o Centro-Oeste</p></div>
          <div class="tempo-meses"><span v-for="mes in mesesAgricolas" :key="mes">{{ mes }}</span></div>
          <div v-for="cultura in calendarioAgricola" :key="cultura.nome" class="tempo-linha">
            <div class="tempo-cultura"><span>{{ cultura.icone }}</span><div><strong>{{ cultura.nome }}</strong><small>{{ cultura.detalhe }}</small></div></div>
            <div class="tempo-trilho"><span class="tempo-faixa" :class="cultura.cor" :style="{ gridColumn: `${cultura.inicio} / ${cultura.fim + 1}` }"></span></div>
          </div>
          <p class="tempo-nota">As faixas mostram períodos sazonais aproximados, não datas de recomendação para uma propriedade. Para decidir o plantio, consulte o ZARC vigente para o município, cultura, solo e cultivar.</p>
          <a class="link-zarc" href="https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/painel-de-indicacao-de-riscos-1" target="_blank" rel="noopener noreferrer">Consultar as janelas oficiais no ZARC <span>↗</span></a>
        </div>

        <div class="agricultura-final"><span>🌙</span><p><strong>Uma boa pergunta para observar:</strong> em qual fase estava a Lua quando começou o plantio na sua comunidade? Compartilhe suas experiências no chat e compare os saberes tradicionais com as informações científicas.</p><button class="botao-principal" @click="navegar('chat')">Conversar no chat <span>→</span></button></div>
      </section>
      <section id="opiniao" v-else class="opiniao">
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
            <small class="opiniao-privacidade">Seu nome e sua opinião serão registrados para contribuir com o projeto.</small>
            <button class="botao-principal" type="submit" :disabled="enviandoOpiniao || !nomeOpiniao.trim() || !textoOpiniao.trim()">
              {{ enviandoOpiniao ? 'Enviando…' : 'Enviar opinião' }} <span>→</span>
            </button>
          </form>
          <p v-if="retornoOpiniao" class="opiniao-sucesso" role="status">{{ retornoOpiniao }}</p>
          <p v-if="erroOpiniao" class="chat-erro" role="alert">{{ erroOpiniao }}</p>
        </div>
      </section>
      </Transition>
    </main>

    <Chat ref="chatRef" />

    <footer>
      <a class="logo" href="#inicio"><span class="logo-icon">☾</span>
        <span>lua<span class="logo-destaque">hoje</span></span>
      </a>
      <p>Conhecimento, observação e conexão com a natureza.</p>
      <span>Projeto acadêmico · UFMS Digital</span>
    </footer>
  </div>
</template>
