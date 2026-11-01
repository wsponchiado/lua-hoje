const mesesAgricolas = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function intervalosDeMeses(meses = []) {
  const ordenados = [...new Set(meses)].sort((a, b) => a - b)
  const intervalos = []
  for (const mes of ordenados) {
    const atual = intervalos.at(-1)
    if (atual && mes === atual.fim + 1) atual.fim = mes
    else intervalos.push({ inicio: mes, fim: mes })
  }
  return intervalos
}
const todosMeses = Array.from({ length: 12 }, (_, indice) => indice + 1)
const regioesAgricolas = [
  { id: 'norte', nome: 'Norte', estados: 'AC · AP · AM · PA · RO · RR · TO', resumo: 'Cada calendário usa o principal município produtor de cada cultivo na região.', destaques: ['Soja', 'Cacau', 'Açaí', 'Mandioca', 'Milho'], culturas: [
    { nome: 'Soja', icone: '🌿', municipio: 'Paragominas · PA', meses: [1, 2, 11, 12], detalhe: '100–140 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-verde' },
    { nome: 'Cacau · implantação', icone: '🍫', municipio: 'Medicilândia · PA', meses: todosMeses, detalhe: 'Cultura perene; entrada em produção varia por sistema · ZARC perene', cor: 'faixa-cafe' },
    { nome: 'Açaí · implantação', icone: '🫐', municipio: 'Igarapé-Miri · PA', meses: todosMeses, detalhe: 'Cultura perene; primeira frutificação pode ocorrer por volta do 3º ano · ZARC perene', cor: 'faixa-azul' },
    { nome: 'Mandioca', icone: '🌱', municipio: 'Acará · PA', meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12], detalhe: 'Ciclo de 6 a 36 meses, conforme cultivar e uso · ZARC perene', cor: 'faixa-dourada' },
    { nome: 'Milho · 1ª safra', icone: '🌽', municipio: 'Campos Lindos · TO', meses: [11, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 2ª safra', icone: '🌽', municipio: 'Campos Lindos · TO', meses: [1, 2, 3, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-lilas' }
  ] },
  { id: 'nordeste', nome: 'Nordeste', estados: 'AL · BA · CE · MA · PB · PE · PI · RN · SE', resumo: 'As janelas refletem municípios de maior produção para cada cultura.', destaques: ['Soja', 'Cana-de-açúcar', 'Milho', 'Algodão', 'Cacau'], culturas: [
    { nome: 'Soja', icone: '🌿', municipio: 'São Desidério · BA', meses: [11, 12], detalhe: '100–140 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-verde' },
    { nome: 'Cana-de-açúcar', icone: '🎋', municipio: 'Coruripe · AL', meses: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12], detalhe: 'Cana de ano: 12 meses; cana de ano e meio: 18 meses · ZARC não separa os sistemas', cor: 'faixa-cafe' },
    { nome: 'Milho · 1ª safra', icone: '🌽', municipio: 'Balsas · MA', meses: [1, 2, 11, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 2ª safra', icone: '🌽', municipio: 'Balsas · MA', meses: [1, 2], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-lilas' },
    { nome: 'Algodão', icone: '☁️', municipio: 'São Desidério · BA', meses: [1, 11, 12], detalhe: 'Ciclo anual; duração depende da cultivar e do manejo · ZARC 2026/27', cor: 'faixa-azul' },
    { nome: 'Cacau · implantação', icone: '🍫', municipio: 'Ilhéus · BA', meses: todosMeses, detalhe: 'Cultura perene; entrada em produção varia por sistema · ZARC perene', cor: 'faixa-verde' }
  ] },
  { id: 'centro-oeste', nome: 'Centro-Oeste', estados: 'DF · GO · MS · MT', resumo: 'Polos de produção e janelas ZARC de cada cultura, com as safras separadas.', destaques: ['Soja', 'Milho', 'Algodão', 'Cana-de-açúcar', 'Feijão'], culturas: [
    { nome: 'Soja', icone: '🌿', municipio: 'Sorriso · MT', meses: [1, 10, 11, 12], detalhe: '100–140 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-verde' },
    { nome: 'Milho · 1ª safra', icone: '🌽', municipio: 'Sorriso · MT', meses: [10, 11, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 2ª safra', icone: '🌽', municipio: 'Sorriso · MT', meses: [1, 2], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-lilas' },
    { nome: 'Algodão', icone: '☁️', municipio: 'Sapezal · MT', meses: [1, 2, 12], detalhe: 'Ciclo anual; duração depende da cultivar e do manejo · ZARC 2026/27', cor: 'faixa-azul' },
    { nome: 'Cana-de-açúcar', icone: '🎋', municipio: 'Nova Alvorada do Sul · MS', meses: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12], detalhe: 'Cana de ano: 12 meses; cana de ano e meio: 18 meses · ZARC não separa os sistemas', cor: 'faixa-cafe' },
    { nome: 'Feijão · 1ª safra', icone: '🫘', municipio: 'Nova Ubiratã · MT', meses: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12], detalhe: '65–95 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Feijão · 2ª safra', icone: '🫘', municipio: 'Nova Ubiratã · MT', meses: [1, 2], detalhe: '65–95 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-lilas' }
  ] },
  { id: 'sudeste', nome: 'Sudeste', estados: 'ES · MG · RJ · SP', resumo: 'O município de maior produção foi selecionado separadamente para cada cultivo.', destaques: ['Cana-de-açúcar', 'Café', 'Laranja', 'Soja', 'Milho'], culturas: [
    { nome: 'Cana-de-açúcar', icone: '🎋', municipio: 'Uberaba · MG', meses: [2, 3, 4, 5, 6, 9, 10, 11, 12], detalhe: 'Cana de ano: 12 meses; cana de ano e meio: 18 meses · ZARC não separa os sistemas', cor: 'faixa-verde' },
    { nome: 'Café arábica · implantação', icone: '☕', municipio: 'Patrocínio · MG', meses: [8, 9, 10, 11, 12], detalhe: 'Implantação perene · ZARC (risco 20%, solos e grupos agregados)', cor: 'faixa-cafe' },
    { nome: 'Café canéfora (conilon) · implantação', icone: '☕', municipio: 'Rio Bananal · ES', meses: [10, 11, 12, 1, 2, 3], detalhe: 'Implantação no período chuvoso, outubro a março · referência técnica do Incaper', cor: 'faixa-lilas' },
    { nome: 'Laranja · implantação', icone: '🍊', municipio: 'Casa Branca · SP', meses: [1, 2, 3, 10, 11, 12], detalhe: 'Cultura perene; implantação do pomar · ZARC perene', cor: 'faixa-azul' },
    { nome: 'Soja', icone: '🌿', municipio: 'Unaí · MG', meses: [1, 10, 11, 12], detalhe: '100–140 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 1ª safra', icone: '🌽', municipio: 'Unaí · MG', meses: [11, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 2ª safra', icone: '🌽', municipio: 'Unaí · MG', meses: [1, 2, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-lilas' }
  ] },
  { id: 'sul', nome: 'Sul', estados: 'PR · RS · SC', resumo: 'Municípios líderes por produção e calendários ZARC por safra.', destaques: ['Soja', 'Milho', 'Arroz', 'Tabaco', 'Trigo'], culturas: [
    { nome: 'Soja', icone: '🌿', municipio: 'Tupanciretã · RS', meses: [1, 10, 11, 12], detalhe: '100–140 dias, conforme cultivar · ZARC 2026/27', cor: 'faixa-verde' },
    { nome: 'Milho · 1ª safra', icone: '🌽', municipio: 'Toledo · PR', meses: [8, 9, 10, 11, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-dourada' },
    { nome: 'Milho · 2ª safra', icone: '🌽', municipio: 'Toledo · PR', meses: [1, 2, 3, 12], detalhe: '100–145 dias, conforme grupo de maturidade · ZARC 2026/27', cor: 'faixa-lilas' },
    { nome: 'Arroz', icone: '🍚', municipio: 'Uruguaiana · RS', meses: [9, 10, 11, 12], detalhe: '100–150 dias, conforme cultivar e região · ZARC 2026/27', cor: 'faixa-azul' },
    { nome: 'Tabaco Virgínia · transplante', icone: '🍃', municipio: 'Canguçu · RS', meses: [5, 6, 7, 8, 9, 10], detalhe: 'Calendário Foniagro 2026/27 para o Centro-Sul do RS: 1º de maio a 15 de outubro', cor: 'faixa-cafe' },
    { nome: 'Trigo', icone: '🌾', municipio: 'São Luiz Gonzaga · RS', meses: [5, 6, 7], detalhe: 'Cerca de 110–123 dias, conforme cultivar · ZARC 2025/26', cor: 'faixa-lilas' },
    { nome: 'Trigo · duplo propósito', icone: '🌾', municipio: 'São Luiz Gonzaga · RS', meses: [4, 5], detalhe: 'Duplo propósito; duração varia por cultivar · ZARC 2025/26', cor: 'faixa-verde' }
  ] }
]

export { mesesAgricolas, intervalosDeMeses, regioesAgricolas }

