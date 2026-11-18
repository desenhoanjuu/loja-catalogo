import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const ABAS_MARCAS = ['TODOS', 'AISHTY', "WE'RE THE BASIC", 'VASPAC'] as const

export type Params = Record<string, string | undefined>

export interface ConfigMarca {
  nome_exibicao: string
  logo_url: string | null
  subtitulo: string | null
}

export interface EstruturaCatalogo {
  mapaLogos: Record<string, ConfigMarca>
  mapaMenus: Record<string, string[]>
  departamentos: string[]
  colecoes: string[]
  campanhas: string[]
  tipos: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Produto = Record<string, any>

// ==========================================
// MARCAS
// ==========================================
export function normalizarMarca(marca?: string | null): string {
  const up = (marca || '').toUpperCase().trim()
  return (ABAS_MARCAS as readonly string[]).includes(up) ? up : 'TODOS'
}

export function urlDaMarca(marca: string) {
  return marca === 'TODOS' ? '/' : `/?marca=${encodeURIComponent(marca)}`
}

// ==========================================
// FOTOS
// ==========================================
// Pastas do R2 que são ângulos de foto, e não cores
const PASTAS_QUE_NAO_SAO_COR = ['costas', 'modelo', 'modelos', 'frente', 'detalhe', 'detalhes', 'padrao']

export function normalizarTexto(texto: string) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function ehPastaDeAngulo(nomePasta: string) {
  const n = normalizarTexto(nomePasta)
  return PASTAS_QUE_NAO_SAO_COR.some((p) => n.includes(p))
}

// Tipo de cada foto pelo nome do arquivo:
// 0 = frente, 1 = costas, 2 = outra foto com modelo, 3 = amostra de cor (tecido liso)
const OUTROS_ANGULOS = ['detalhe', 'detalhes', 'lateral', 'lado', 'zoom', 'modelo', 'modelos']

export function tipoDaFoto(arquivo: string): number {
  const tokens = arquivo
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[_\-\s]+/)
    .filter(Boolean)
  if (tokens.includes('frente')) return 0
  if (tokens.includes('costas') || tokens.includes('verso')) return 1
  if (tokens.some((t) => OUTROS_ANGULOS.includes(t) || /^\d+$/.test(t))) return 2
  return 3
}

function compararTexto(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

export function ordenarFotos(arquivos: string[]): string[] {
  return [...arquivos].sort((a, b) => tipoDaFoto(a) - tipoDaFoto(b) || compararTexto(a, b))
}

// Pastas de fotos que são cores de verdade (sem "Costas", "Modelo" etc.)
export function pastasDeCor(fotos: Record<string, string[]> | null | undefined): string[] {
  if (!fotos) return []
  return Object.keys(fotos).filter((k) => !ehPastaDeAngulo(k) && (fotos[k]?.length ?? 0) > 0)
}

// Preto e branco só aparecem na vitrine se a referência não tiver outra cor
const CORES_NEUTRAS = ['preto', 'black', 'branco', 'white', 'offwhite']

export function ehCorNeutra(nomeCor: string) {
  const n = normalizarTexto(nomeCor)
  return CORES_NEUTRAS.some((c) => n.includes(c))
}

export interface CapaCard {
  capa: string | null
  hover: string | null
  // 0 = frente + costas, 1 = só frente, 2 = outra foto, 3 = só amostra de cor, 4 = sem foto
  qualidade: number
  manual: boolean // cor escolhida no painel
}

// Escolhe a foto do card: cor escolhida no painel ou, no automático,
// a cor com foto de frente, evitando preto/branco e preferindo a que tem costas.
// O hover só mostra as costas; se não houver costas, a imagem não troca.
export function escolherCapa(
  fotos: Record<string, string[]> | null | undefined,
  referencia: string,
  r2BaseUrl: string,
  corCapa?: string | null
): CapaCard {
  const vazio: CapaCard = { capa: null, hover: null, qualidade: 4, manual: false }
  if (!fotos) return vazio

  let candidatas = pastasDeCor(fotos)
  if (candidatas.length === 0) candidatas = Object.keys(fotos).filter((k) => (fotos[k]?.length ?? 0) > 0)
  if (candidatas.length === 0) return vazio

  const info = candidatas.map((pasta, indice) => {
    const lista = ordenarFotos(fotos[pasta])
    return {
      pasta,
      indice,
      lista,
      frente: lista.find((a) => tipoDaFoto(a) === 0),
      costas: lista.find((a) => tipoDaFoto(a) === 1),
      outra: lista.find((a) => tipoDaFoto(a) === 2),
      neutra: ehCorNeutra(pasta),
    }
  })

  const alvoManual = corCapa ? normalizarTexto(corCapa) : ''
  const manual = alvoManual ? info.find((x) => normalizarTexto(x.pasta) === alvoManual) : undefined

  const escolhida =
    manual ||
    [...info].sort(
      (a, b) =>
        Number(!!b.frente) - Number(!!a.frente) ||
        Number(a.neutra) - Number(b.neutra) ||
        Number(!!b.costas) - Number(!!a.costas) ||
        a.indice - b.indice
    )[0]

  const url = (arquivo: string) => `${r2BaseUrl}/${referencia}/${encodeURIComponent(arquivo)}`
  const ehManual = !!manual

  if (escolhida.frente) {
    return {
      capa: url(escolhida.frente),
      hover: escolhida.costas ? url(escolhida.costas) : null,
      qualidade: escolhida.costas ? 0 : 1,
      manual: ehManual,
    }
  }
  if (escolhida.outra) return { capa: url(escolhida.outra), hover: null, qualidade: 2, manual: ehManual }
  return { capa: url(escolhida.lista[0]), hover: null, qualidade: 3, manual: ehManual }
}

// Num conjunto, a capa vem da peça com a cor escolhida no painel ou da peça com a melhor foto
export function capaDoItem(pecas: Produto[], r2BaseUrl: string): CapaCard & { peca: Produto } {
  const opcoes = pecas.map((p) => ({ peca: p, ...escolherCapa(p.fotos, p.referencia, r2BaseUrl, p.cor_capa) }))
  return opcoes.find((o) => o.manual) || [...opcoes].sort((a, b) => a.qualidade - b.qualidade)[0]
}

export function formatarNome(texto: string | null | undefined) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ==========================================
// FILTROS
// ==========================================
export function montarUrlFiltro(atual: Params, alteracoes: Params) {
  const combinado = { ...atual, ...alteracoes }
  const qs = new URLSearchParams()
  Object.entries(combinado).forEach(([k, v]) => {
    if (v && v.trim() !== '') qs.set(k, v)
  })
  const str = qs.toString()
  return str ? `/?${str}` : '/'
}

// Remove caracteres que quebram a consulta do Supabase (vírgula, parênteses etc.)
export function limparBusca(q: string) {
  return q.replace(/[,()*%\\"]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ==========================================
// ESTRUTURA DE MENUS E FILTROS (usada na vitrine e na página do produto)
// ==========================================
export async function carregarEstrutura(marca: string): Promise<EstruturaCatalogo> {
  const ehTodos = marca === 'TODOS'

  const { data: marcasRaw } = await supabase
    .from('marcas_config')
    .select('chave, nome_exibicao, logo_url, subtitulo')

  const mapaLogos: Record<string, ConfigMarca> = {}
  marcasRaw?.forEach((m) => {
    mapaLogos[String(m.chave).toUpperCase()] = m
  })

  // Lê em páginas de 1000 (limite do Supabase) para não perder filtros
  const meta: Produto[] = []
  const passo = 1000
  for (let inicio = 0; ; inicio += passo) {
    let q = supabase
      .from('produtos')
      .select('departamento, grupo, colecao, campanha, tipo_peca')
      .eq('ativo', true)
      .order('referencia')
      .range(inicio, inicio + passo - 1)
    if (!ehTodos) q = q.eq('marca', marca)
    const { data } = await q
    if (!data || data.length === 0) break
    meta.push(...data)
    if (data.length < passo) break
  }

  const menus: Record<string, Set<string>> = {}
  const colecoes = new Set<string>()
  const campanhas = new Set<string>()
  const tipos = new Set<string>()

  meta.forEach((item) => {
    const dep = item.departamento?.trim()
    const grp = item.grupo?.trim()
    const col = item.colecao?.trim()
    const camp = item.campanha?.trim()
    const tipo = item.tipo_peca?.trim()

    if (dep) {
      if (!menus[dep]) menus[dep] = new Set()
      if (grp) menus[dep].add(grp)
    }
    if (col) colecoes.add(col)
    if (camp) campanhas.add(camp)
    if (tipo) tipos.add(tipo)
  })

  const mapaMenus: Record<string, string[]> = {}
  Object.entries(menus).forEach(([dep, set]) => {
    mapaMenus[dep] = Array.from(set).sort()
  })

  return {
    mapaLogos,
    mapaMenus,
    departamentos: Object.keys(mapaMenus).sort(),
    colecoes: Array.from(colecoes).sort(),
    campanhas: Array.from(campanhas).sort(),
    tipos: Array.from(tipos).sort(),
  }
}

// ==========================================
// PRODUTOS SEMELHANTES
// ==========================================
export interface ProdutoSimilar {
  produto: Produto
  meta: string
}

export async function buscarSimilares(
  produto: Produto,
  limite = 8,
  excluir: string[] = [] // ex.: as outras peças do mesmo conjunto
): Promise<ProdutoSimilar[]> {
  // Uma consulta simples por critério (mais robusta que um único .or com textos com espaço)
  const base = () =>
    supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .neq('referencia', produto.referencia)
      .limit(120)

  const consultas = []
  if (produto.grupo) consultas.push(base().eq('grupo', produto.grupo))
  if (produto.tipo_peca) consultas.push(base().eq('tipo_peca', produto.tipo_peca))
  if (produto.id_semelhante) consultas.push(base().eq('id_semelhante', produto.id_semelhante))

  const resultados = await Promise.all(consultas)

  const candidatos = new Map<string, Produto>()
  resultados.forEach(({ data, error }) => {
    if (error) console.error('Erro ao buscar semelhantes:', error.message)
    data?.forEach((p) => candidatos.set(p.referencia, p))
  })

  // Se ainda faltar sugestão, completa com peças do mesmo departamento
  const comFoto = () => Array.from(candidatos.values()).filter((p) => pastasDeCor(p.fotos).length > 0)
  if (comFoto().length < limite && produto.departamento) {
    const { data, error } = await base().eq('departamento', produto.departamento)
    if (error) console.error('Erro ao completar semelhantes:', error.message)
    data?.forEach((p) => {
      if (!candidatos.has(p.referencia)) candidatos.set(p.referencia, p)
    })
  }

  excluir.forEach((ref) => candidatos.delete(ref))
  const data = Array.from(candidatos.values())

  const pontuados = data
    .filter((p) => pastasDeCor(p.fotos).length > 0) // só sugere peças com foto
    .map((p) => {
      const mesmaFamilia = !!produto.id_semelhante && p.id_semelhante === produto.id_semelhante
      const mesmoGrupo = !!produto.grupo && p.grupo === produto.grupo
      const mesmoTipo = !!produto.tipo_peca && p.tipo_peca === produto.tipo_peca

      let pontos = 0
      if (mesmaFamilia) pontos += 5
      if (mesmoGrupo) pontos += 3
      if (mesmoTipo) pontos += 3
      if (p.departamento && p.departamento === produto.departamento) pontos += 2
      if (p.marca && p.marca === produto.marca) pontos += 1
      if ((p.estoque_pe ?? 0) > 0) pontos += 1
      if (p.novidade) pontos += 0.5

      // Texto curto que explica a ligação com a peça aberta
      const ligacao = mesmoGrupo
        ? formatarNome(p.grupo)
        : mesmoTipo
          ? formatarNome(p.tipo_peca)
          : formatarNome(p.grupo || p.tipo_peca)

      return { produto: p, pontos, meta: `${ligacao} • Ref: ${p.referencia}` }
    })

  return pontuados
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map(({ produto: p, meta }) => ({ produto: p, meta }))
}

// ==========================================
// CONJUNTOS (ex.: Blusa 830697 + Calça 830699)
// ==========================================
export interface Conjunto {
  id: string
  referencias: string[]
}

// Lê os conjuntos cadastrados no painel. Se a tabela ainda não existir, o site segue normal.
export async function carregarConjuntos(): Promise<Conjunto[]> {
  const { data, error } = await supabase.from('conjuntos').select('id, referencias')
  if (error) {
    console.error('Erro ao ler conjuntos:', error.message)
    return []
  }
  return (data || []).map((c) => ({ id: String(c.id), referencias: (c.referencias || []).map(String) }))
}

export async function buscarConjuntoDaReferencia(referencia: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('conjuntos')
    .select('referencias')
    .contains('referencias', [referencia])
    .limit(1)
  if (error) {
    console.error('Erro ao ler conjunto:', error.message)
    return null
  }
  const refs = (data?.[0]?.referencias || []).map(String)
  return refs.length > 1 ? refs : null
}

// "Blusa 830697" — primeira palavra do tipo da peça + referência
export function rotuloPeca(p: Produto) {
  const tipo = String(p.tipo_peca || '').trim().split(' ')[0]
  return `${formatarNome(tipo) || 'Peça'} ${p.referencia}`
}

export type ItemVitrine =
  | { tipo: 'produto'; produto: Produto }
  | { tipo: 'conjunto'; pecas: Produto[] }

// Junta as peças de um mesmo conjunto num único card, na posição da primeira que aparecer
export async function agruparConjuntos(produtos: Produto[]): Promise<ItemVitrine[]> {
  const conjuntos = await carregarConjuntos()
  if (conjuntos.length === 0) return produtos.map((produto) => ({ tipo: 'produto', produto }))

  const conjuntoDaRef = new Map<string, Conjunto>()
  conjuntos.forEach((c) => c.referencias.forEach((r) => conjuntoDaRef.set(r, c)))

  const porRef = new Map<string, Produto>()
  produtos.forEach((p) => porRef.set(p.referencia, p))

  // Peças do conjunto que não vieram no resultado (ex.: filtro só de calças): busca as ativas
  const faltando = new Set<string>()
  produtos.forEach((p) => {
    conjuntoDaRef.get(p.referencia)?.referencias.forEach((r) => {
      if (!porRef.has(r)) faltando.add(r)
    })
  })
  if (faltando.size > 0) {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .in('referencia', Array.from(faltando))
    data?.forEach((p) => porRef.set(p.referencia, p))
  }

  const itens: ItemVitrine[] = []
  const conjuntosUsados = new Set<string>()

  produtos.forEach((produto) => {
    const conjunto = conjuntoDaRef.get(produto.referencia)
    if (!conjunto) {
      itens.push({ tipo: 'produto', produto })
      return
    }
    if (conjuntosUsados.has(conjunto.id)) return
    conjuntosUsados.add(conjunto.id)

    const pecas = conjunto.referencias.map((r) => porRef.get(r)).filter(Boolean) as Produto[]
    if (pecas.length > 1) itens.push({ tipo: 'conjunto', pecas })
    else itens.push({ tipo: 'produto', produto })
  })

  return itens
}

// ==========================================
// PRODUTOS DA VITRINE (lê tudo, em páginas de 1000)
// ==========================================
export async function buscarProdutosVitrine(marca: string, params: Params): Promise<Produto[]> {
  const busca = params.q ? limparBusca(params.q) : ''

  const montar = () => {
    let q = supabase.from('produtos').select('*').eq('ativo', true).order('referencia', { ascending: false })
    if (marca !== 'TODOS') q = q.eq('marca', marca)
    if (params.colecao) q = q.eq('colecao', params.colecao)
    if (params.campanha) q = q.eq('campanha', params.campanha)
    if (params.dep) q = q.eq('departamento', params.dep)
    if (params.grupo) q = q.eq('grupo', params.grupo)
    if (params.tipo) q = q.eq('tipo_peca', params.tipo)
    if (params.pe === '1') q = q.gt('estoque_pe', 0)
    if (busca) {
      q = q.or(
        `referencia.ilike.%${busca}%,descricao.ilike.%${busca}%,colecao.ilike.%${busca}%,campanha.ilike.%${busca}%`
      )
    }
    return q
  }

  const produtos: Produto[] = []
  const passo = 1000
  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await montar().range(inicio, inicio + passo - 1)
    if (error) {
      console.error('Erro ao buscar produtos:', error.message)
      break
    }
    if (!data || data.length === 0) break
    produtos.push(...data)
    if (data.length < passo) break
  }
  return produtos
}

// ==========================================
// SEÇÕES DA VITRINE E ORDEM MANUAL
// (a mesma regra está no painel, na aba "Organizar Vitrine")
// ==========================================
export const SECOES_VITRINE: { chave: string; titulo: string }[] = [
  { chave: 'feminino', titulo: 'Feminino' },
  { chave: 'plusfem', titulo: 'Plus Size Feminino' },
  { chave: 'masculino', titulo: 'Masculino' },
  { chave: 'kids', titulo: 'Juvenil, Infantil e Baby' },
  { chave: 'outros', titulo: 'Outros' },
]

export function secaoDoDepartamento(departamento: string | null | undefined): string {
  const n = normalizarTexto(departamento || '')
  if (/(infantil|juvenil|baby|bebe|kids)/.test(n)) return 'kids'
  if (n.includes('plus') && n.includes('fem')) return 'plusfem'
  if (n.includes('mascul')) return 'masculino'
  if (n.includes('fem')) return 'feminino'
  return 'outros'
}

export interface SecaoVitrine {
  chave: string
  titulo: string
  itens: ItemVitrine[]
}

export function pecasDoItem(item: ItemVitrine): Produto[] {
  return item.tipo === 'conjunto' ? item.pecas : [item.produto]
}

const SEM_ORDEM = 1e9

// ---------- Ordem automática "natural" ----------
// Dentro de cada seção: idade (Baby → Infantil → Juvenil → Adulto), depois menina/feminino antes
// de menino/masculino, depois tipo de peça (vestidos → macacões → conjuntos → blusas → casacos →
// saias → shorts → calças) e, dentro do mesmo tipo, peças do mesmo tecido (grupo) juntas.
const CATEGORIAS_PECA: [RegExp, number][] = [
  [/vestid/, 0],
  [/macac|jardineira/, 1],
  [/conjunt/, 2],
  [/blus|camis|regat|top|cropp|body|bata|tshirt/, 3],
  [/casac|jaquet|blaz|colet|cardig|kimon|moletom|sueter/, 4],
  [/saia/, 5],
  [/short|bermud/, 6],
  [/calc|legging|pantalon|jogger/, 7],
]

export function categoriaDaPeca(tipo: string | null | undefined): number {
  const n = normalizarTexto(tipo || '')
  const achada = CATEGORIAS_PECA.find(([re]) => re.test(n))
  return achada ? achada[1] : 8
}

function faixaEtaria(n: string) {
  if (/(baby|bebe)/.test(n)) return 0
  if (/(infantil|mirim|kids)/.test(n)) return 1
  if (/(juvenil|teen)/.test(n)) return 2
  return 3
}

function generoDep(n: string) {
  if (/(fem|menina)/.test(n)) return 0
  if (/(mascul|menino)/.test(n)) return 1
  return 2
}

type Chave = (number | string)[]

export function chaveNatural(pecas: Produto[], qualidade: number, ehConjunto: boolean): Chave {
  const p = pecas[0]
  const dep = normalizarTexto(p.departamento || '')
  const secao = SECOES_VITRINE.findIndex((x) => x.chave === secaoDoDepartamento(p.departamento))
  return [
    secao, // só faz diferença em Novidades, que reúne todas as seções (Feminino primeiro, Kids por último)
    qualidade >= 3 ? 1 : 0, // sem foto de modelo vai para o fim
    faixaEtaria(dep),
    dep.includes('plus') ? 1 : 0,
    generoDep(dep),
    dep,
    ehConjunto ? 2 : categoriaDaPeca(p.tipo_peca),
    normalizarTexto(p.grupo || ''),
    normalizarTexto(p.tipo_peca || ''),
    qualidade,
  ]
}

function compararChaves(a: Chave, b: Chave) {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x - y
    return String(x) < String(y) ? -1 : 1
  }
  return 0
}

export function organizarVitrine(itens: ItemVitrine[], incluirNovidades: boolean): SecaoVitrine[] {
  const dados = itens.map((item, indice) => {
    const pecas = pecasDoItem(item)
    const menor = (campo: string) => {
      const valores = pecas.map((p) => p[campo]).filter((v) => typeof v === 'number') as number[]
      return valores.length ? Math.min(...valores) : SEM_ORDEM
    }
    const qualidade = capaDoItem(pecas, '').qualidade
    return {
      item,
      indice,
      ordemVitrine: menor('ordem_vitrine'),
      ordemNovidades: menor('ordem_novidades'),
      qualidade,
      natural: chaveNatural(pecas, qualidade, item.tipo === 'conjunto'),
      novidade: pecas.some((p) => p.novidade),
      secao: secaoDoDepartamento(pecas[0].departamento),
    }
  })

  type Dado = (typeof dados)[number]
  // Ordem manual primeiro; o resto segue a ordem natural (idade, gênero, tipo de peça, tecido)
  const ordenar = (lista: Dado[], campo: 'ordemVitrine' | 'ordemNovidades') =>
    [...lista]
      .sort((a, b) => a[campo] - b[campo] || compararChaves(a.natural, b.natural) || a.indice - b.indice)
      .map((d) => d.item)

  const secoes: SecaoVitrine[] = []
  if (incluirNovidades) {
    const novidades = dados.filter((d) => d.novidade)
    if (novidades.length) secoes.push({ chave: 'novidades', titulo: 'Novidades', itens: ordenar(novidades, 'ordemNovidades') })
  }
  SECOES_VITRINE.forEach(({ chave, titulo }) => {
    const daSecao = dados.filter((d) => d.secao === chave)
    if (daSecao.length) secoes.push({ chave, titulo, itens: ordenar(daSecao, 'ordemVitrine') })
  })
  return secoes
}
