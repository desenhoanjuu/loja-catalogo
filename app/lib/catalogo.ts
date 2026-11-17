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

export function ordenarFotos(arquivos: string[]): string[] {
  const peso = (nome: string) => {
    const lower = nome.toLowerCase()
    if (lower.startsWith('frente_')) return 0
    if (lower.startsWith('costas_')) return 1
    if (lower.includes('_')) return 2
    return 3 // Amostra de cor pura fica por último
  }
  return [...arquivos].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b))
}

// Pastas de fotos que são cores de verdade (sem "Costas", "Modelo" etc.)
export function pastasDeCor(fotos: Record<string, string[]> | null | undefined): string[] {
  if (!fotos) return []
  return Object.keys(fotos).filter((k) => !ehPastaDeAngulo(k) && (fotos[k]?.length ?? 0) > 0)
}

// Capa = frente da primeira cor real; hover = costas da mesma cor
export function obterFotosCard(
  fotos: Record<string, string[]> | null | undefined,
  referencia: string,
  r2BaseUrl: string
) {
  if (!fotos) return { capa: null, hover: null }
  const pasta =
    pastasDeCor(fotos)[0] ?? Object.keys(fotos).find((k) => (fotos[k]?.length ?? 0) > 0)
  if (!pasta) return { capa: null, hover: null }

  const lista = ordenarFotos(fotos[pasta])
  const url = (arquivo: string) => `${r2BaseUrl}/${referencia}/${encodeURIComponent(arquivo)}`

  return {
    capa: lista[0] ? url(lista[0]) : null,
    hover: lista.length > 1 ? url(lista[1]) : null,
  }
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
