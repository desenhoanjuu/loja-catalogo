import { createClient } from '@supabase/supabase-js'
import { cache } from 'react'

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
  arvoreTipos: RamoTipos[] // Blusa > [Blusa de alça, Blusa manga curta...] (filtro lateral)
  categoriasPorDep: Record<string, string[]> // categorias de cada departamento (menu do topo)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Produto = Record<string, any>

// ==========================================
// VISIBILIDADE
// Quem aparece no site é calculado pelo próprio banco, na coluna "no_site":
//   - não esgotada no ERP e com pelo menos uma foto, E
//   - autorizada no painel, OU com estoque de pronta entrega e não ocultada manualmente.
// Todas as consultas de produtos usam .eq('no_site', true).
// ==========================================
export function ehVisivelNoSite(p: Produto | null | undefined): boolean {
  return !!p && p.no_site === true
}

// ==========================================
// ARQUIVOS DO PAINEL NO CLOUDFLARE (banners e logos)
// O painel salva só o caminho ("banners/banner_123.webp"). Registros antigos podem ter um
// endereço completo com o domínio errado: nesses casos, o caminho é reaproveitado com o
// endereço certo (NEXT_PUBLIC_R2_URL). Links de outros sites continuam como estão.
// ==========================================
export function urlArquivoPainel(valor: string | null | undefined): string | null {
  if (!valor) return null
  const base = (process.env.NEXT_PUBLIC_R2_URL || '').replace(/\/+$/, '')
  const texto = String(valor).trim()
  if (!/^https?:\/\//i.test(texto)) return base ? `${base}/${texto.replace(/^\/+/, '')}` : null
  const caminho = texto.match(/^https?:\/\/[^/]+\/((?:banners|logos)\/.+)$/i)
  if (caminho && base) return `${base}/${caminho[1]}`
  return texto
}

// ==========================================
// CONFIGURAÇÕES DO SITE (aba ⚙️ Site do painel)
// ==========================================
export interface ConfigSite {
  etiquetaColecao: boolean // VERÃO, INVERNO... no canto da foto
  etiquetaPromocional: boolean // campanha promocional no canto da foto
  etiquetaNovidade: boolean
}

const CONFIG_PADRAO: ConfigSite = { etiquetaColecao: false, etiquetaPromocional: true, etiquetaNovidade: true }

// Lida uma vez por página (cache do React), mesmo com centenas de cards
export const carregarConfigSite = cache(async (): Promise<ConfigSite> => {
  const { data, error } = await supabase.from('site_config').select('chave, valor')
  if (error || !data) return CONFIG_PADRAO
  const config = { ...CONFIG_PADRAO }
  data.forEach((linha) => {
    if (linha.chave in config && typeof linha.valor === 'boolean') {
      config[linha.chave as keyof ConfigSite] = linha.valor
    }
  })
  return config
})

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
  if (tokens.some((t) => OUTROS_ANGULOS.includes(t))) return 2
  // Foto numerada (ex.: "VERDE_1"): número curto separado por "_". Números do nome da cor
  // ("print-373-1") e o código da referência ("430672_...") não contam.
  const partes = arquivo.replace(/\.[^.]+$/, '').split('_')
  if (partes.some((p) => /^\d{1,3}$/.test(p.trim()))) return 2
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
// Mesma regra de comparação de nomes que a página do produto usa para achar a pasta da cor
export function combinaCor(a: string, b: string) {
  if (!a || !b) return false
  return a === b || a.startsWith(b) || b.startsWith(a) || (Math.min(a.length, b.length) >= 3 && (a.endsWith(b) || b.endsWith(a)))
}

// Cores com caixa disponível (com estoque ou em programação). Num conjunto, só as cores que
// TODAS as peças têm. null = sem dados de caixas ainda (não restringe nada).
export function coresDisponiveis(pecas: Produto[]): string[] | null {
  const chavesPorPeca = pecas
    .map((p) => {
      const caixas = Array.isArray(p.caixas) ? p.caixas : []
      if (caixas.length === 0) return null
      return caixas
        .filter((cx: Produto) => /^[A-Za-z]+$/.test(String(cx.caixa || '').trim()))
        .filter((cx: Produto) => !cx.esgotada || cx.estoque > 0 || cx.programacao)
        .map((cx: Produto) => (cx.cores || []).map((c: string) => normalizarTexto(c)).sort().join('+'))
        .filter(Boolean) as string[]
    })
    .filter((c): c is string[] => c !== null)
  if (chavesPorPeca.length === 0) return null
  const comuns = chavesPorPeca[0].filter((k) => chavesPorPeca.every((lista) => lista.includes(k)))
  return Array.from(new Set(comuns.flatMap((k) => k.split('+'))))
}

export function escolherCapa(
  fotos: Record<string, string[]> | null | undefined,
  referencia: string,
  r2BaseUrl: string,
  corCapa?: string | null,
  permitidas?: string[] | null // cores com caixa disponível; a capa só sai delas
): CapaCard {
  const vazio: CapaCard = { capa: null, hover: null, qualidade: 4, manual: false }
  if (!fotos) return vazio

  let candidatas = pastasDeCor(fotos)
  if (candidatas.length === 0) candidatas = Object.keys(fotos).filter((k) => (fotos[k]?.length ?? 0) > 0)
  if (candidatas.length === 0) return vazio

  // Só cores que estão à venda (se nenhuma pasta bater, usa as que houver)
  if (permitidas && permitidas.length > 0) {
    const daVenda = candidatas.filter((p) => permitidas.some((c) => combinaCor(normalizarTexto(p), c)))
    if (daVenda.length > 0) candidatas = daVenda
  }

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

export function urlFotoConjunto(r2BaseUrl: string, conjuntoId: string, arquivo: string) {
  return `${r2BaseUrl}/conjuntos/${conjuntoId}/${encodeURIComponent(arquivo)}`
}

// Capa do card. Conjunto com fotos próprias usa essas fotos; senão, a peça com a cor escolhida
// no painel ou a peça com a melhor foto.
export function capaDoItem(
  pecas: Produto[],
  r2BaseUrl: string,
  conjunto?: Conjunto | null
): CapaCard & { peca: Produto } {
  const permitidas = coresDisponiveis(pecas)

  // Fotos do conjunto: só as das cores à venda (ou enviadas no painel como "todas as cores")
  const fotosConjunto = (conjunto?.fotos || []).filter((f) =>
    f.cor
      ? !permitidas || permitidas.some((c) => combinaCor(normalizarTexto(f.cor!), c))
      : f.arquivo.includes('_conjunto_')
  )
  if (conjunto && fotosConjunto.length > 0) {
    // Mesma hierarquia das peças: cor com frente, evitando preto/branco, preferindo a que tem costas.
    // Frente e costas (hover) saem sempre da mesma cor.
    const grupos = new Map<string, FotoConjunto[]>()
    fotosConjunto.forEach((f) => {
      const chave = f.cor ? normalizarTexto(f.cor) : ''
      grupos.set(chave, [...(grupos.get(chave) || []), f])
    })
    const corDoPainel = pecas.map((p) => (p.cor_capa ? normalizarTexto(p.cor_capa) : '')).find(Boolean) || ''
    const info = Array.from(grupos.entries()).map(([cor, lista], indice) => {
      const ordenada = [...lista].sort((a, b) => tipoDaFoto(a.arquivo) - tipoDaFoto(b.arquivo))
      return {
        indice,
        manual: !!corDoPainel && !!cor && combinaCor(cor, corDoPainel),
        frente: ordenada.find((f) => tipoDaFoto(f.arquivo) === 0),
        costas: ordenada.find((f) => tipoDaFoto(f.arquivo) === 1),
        outra: ordenada.find((f) => tipoDaFoto(f.arquivo) !== 1),
        neutra: !!cor && ehCorNeutra(cor),
        semCor: !cor,
      }
    })
    const escolhida =
      info.find((g) => g.manual) ||
      [...info].sort(
        (a, b) =>
          Number(!!b.frente) - Number(!!a.frente) ||
          Number(a.semCor) - Number(b.semCor) ||
          Number(a.neutra) - Number(b.neutra) ||
          Number(!!b.costas) - Number(!!a.costas) ||
          a.indice - b.indice
      )[0]
    const capa = escolhida.frente || escolhida.outra || escolhida.costas!
    const hover = escolhida.costas && escolhida.costas !== capa ? escolhida.costas : null
    return {
      peca: pecas[0],
      capa: urlFotoConjunto(r2BaseUrl, conjunto.id, capa.arquivo),
      hover: hover ? urlFotoConjunto(r2BaseUrl, conjunto.id, hover.arquivo) : null,
      qualidade: hover ? 0 : escolhida.frente ? 1 : 2,
      manual: escolhida.manual,
    }
  }
  const opcoes = pecas.map((p) => ({ peca: p, ...escolherCapa(p.fotos, p.referencia, r2BaseUrl, p.cor_capa, permitidas) }))
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
    mapaLogos[String(m.chave).toUpperCase()] = { ...m, logo_url: urlArquivoPainel(m.logo_url) }
  })

  // Lê em páginas de 1000 (limite do Supabase) para não perder filtros
  const meta: Produto[] = []
  const passo = 1000
  for (let inicio = 0; ; inicio += passo) {
    let q = supabase
      .from('produtos')
      .select('departamento, grupo, colecao, campanha, tipo_peca, descricao')
      .eq('no_site', true)
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
  const categoriasDep: Record<string, Set<string>> = {}
  const subtiposCategoria: Record<string, Set<string>> = {}

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
    if (tipo) {
      tipos.add(tipo)
      const { categoria, subtipo } = classificarPeca(item)
      if (!subtiposCategoria[categoria]) subtiposCategoria[categoria] = new Set()
      subtiposCategoria[categoria].add(subtipo)
      if (dep) {
        if (!categoriasDep[dep]) categoriasDep[dep] = new Set()
        categoriasDep[dep].add(categoria)
      }
    }
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
    arvoreTipos: Object.keys(subtiposCategoria)
      .sort((a, b) => ordemCategoria(a) - ordemCategoria(b))
      .map((categoria) => ({
        categoria,
        subtipos: Array.from(subtiposCategoria[categoria]).sort(
          (a, b) => ordemSubtipo(categoria, a) - ordemSubtipo(categoria, b) || a.localeCompare(b)
        ),
      })),
    categoriasPorDep: Object.fromEntries(
      Object.entries(categoriasDep).map(([dep, set]) => [
        dep,
        Array.from(set).sort((a, b) => ordemCategoria(a) - ordemCategoria(b)),
      ])
    ),
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
      .eq('no_site', true)
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
export interface FotoConjunto {
  arquivo: string // arquivo em conjuntos/<id>/ no Cloudflare
  cor?: string | null // cor das peças na foto (vazio = vale para todas)
}

export interface Conjunto {
  id: string
  referencias: string[]
  fotos: FotoConjunto[]
  ordem: number | null // posição manual na seção Conjuntos
}

function lerConjunto(c: Produto): Conjunto {
  return {
    id: String(c.id),
    referencias: (c.referencias || []).map(String),
    fotos: Array.isArray(c.fotos) ? c.fotos.filter((f: FotoConjunto) => f && f.arquivo) : [],
    ordem: typeof c.ordem === 'number' ? c.ordem : null,
  }
}

// Lê os conjuntos cadastrados no painel. Se a tabela ainda não existir, o site segue normal.
export async function carregarConjuntos(): Promise<Conjunto[]> {
  // Mesma ordem do painel (data de criação), para desempates iguais nos dois
  const { data, error } = await supabase.from('conjuntos').select('*').order('criado_em')
  if (error) {
    console.error('Erro ao ler conjuntos:', error.message)
    return []
  }
  return (data || []).map(lerConjunto)
}

export async function buscarConjunto(id: string): Promise<Conjunto | null> {
  const { data, error } = await supabase.from('conjuntos').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return lerConjunto(data)
}

// Todos os conjuntos de que a peça faz parte (uma calça pode combinar com várias blusas)
export async function buscarConjuntosDaReferencia(referencia: string): Promise<Conjunto[]> {
  const { data, error } = await supabase
    .from('conjuntos')
    .select('*')
    .contains('referencias', [referencia])
    .order('criado_em')
  if (error) {
    console.error('Erro ao ler conjuntos:', error.message)
    return []
  }
  return (data || []).map(lerConjunto)
}

// Conjunto só vale quando as peças têm caixa disponível na MESMA cor (ex.: blusa e calça pretas).
// Peça sem dados de caixas ainda (não sincronizada) não bloqueia.
export function coresEmComum(pecas: Produto[]): boolean {
  const chavesPorPeca = pecas.map((p) => {
    const caixas = Array.isArray(p.caixas) ? p.caixas : []
    if (caixas.length === 0) return null
    return new Set(
      caixas
        .filter((cx: Produto) => /^[A-Za-z]+$/.test(String(cx.caixa || '').trim()))
        .filter((cx: Produto) => !cx.esgotada || cx.estoque > 0 || cx.programacao)
        .map((cx: Produto) => (cx.cores || []).map((c: string) => normalizarTexto(c)).sort().join('+'))
        .filter(Boolean)
    )
  })
  const comDados = chavesPorPeca.filter((c): c is Set<string> => c !== null)
  if (comDados.length < 2) return true
  return Array.from(comDados[0]).some((chave) => comDados.every((c) => c.has(chave)))
}

// Peças visíveis do conjunto, na ordem do cadastro
export async function pecasDoConjunto(conjunto: Conjunto): Promise<Produto[]> {
  const { data } = await supabase
    .from('produtos')
    .select('*')
    .eq('no_site', true)
    .in('referencia', conjunto.referencias)
  const porRef = new Map((data || []).map((p) => [p.referencia, p]))
  return conjunto.referencias.map((r) => porRef.get(r)).filter(Boolean) as Produto[]
}

// "Blusa 830697" — primeira palavra do tipo da peça + referência
export function rotuloPeca(p: Produto) {
  const tipo = String(p.tipo_peca || '').trim().split(' ')[0]
  return `${formatarNome(tipo) || 'Peça'} ${p.referencia}`
}

export type ItemVitrine =
  | { tipo: 'produto'; produto: Produto }
  | { tipo: 'conjunto'; pecas: Produto[]; conjunto: Conjunto }

// Conjuntos que têm pelo menos uma peça no resultado da vitrine (e 2+ peças visíveis).
// As peças continuam aparecendo sozinhas nas seções delas.
export async function conjuntosDaVitrine(produtos: Produto[]): Promise<ItemVitrine[]> {
  const conjuntos = await carregarConjuntos()
  if (conjuntos.length === 0) return []

  const noResultado = new Set(produtos.map((p) => p.referencia))
  const usados = conjuntos.filter((c) => c.referencias.some((r) => noResultado.has(r)))
  if (usados.length === 0) return []

  const porRef = new Map<string, Produto>()
  produtos.forEach((p) => porRef.set(p.referencia, p))
  const faltando = Array.from(new Set(usados.flatMap((c) => c.referencias))).filter((r) => !porRef.has(r))
  if (faltando.length > 0) {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('no_site', true)
      .in('referencia', faltando)
    data?.forEach((p) => porRef.set(p.referencia, p))
  }

  const itens: ItemVitrine[] = []
  usados.forEach((conjunto) => {
    const pecas = conjunto.referencias.map((r) => porRef.get(r)).filter(Boolean) as Produto[]
    if (pecas.length > 1 && coresEmComum(pecas)) itens.push({ tipo: 'conjunto', pecas, conjunto })
  })
  return itens
}

// ==========================================
// PRODUTOS DA VITRINE (lê tudo, em páginas de 1000)
// ==========================================
export async function buscarProdutosVitrine(marca: string, params: Params): Promise<Produto[]> {
  const busca = params.q ? limparBusca(params.q) : ''

  const montar = () => {
    let q = supabase.from('produtos').select('*').eq('no_site', true).order('referencia', { ascending: false })
    if (marca !== 'TODOS') q = q.eq('marca', marca)
    if (params.colecao) q = q.eq('colecao', params.colecao)
    if (params.campanha) q = q.eq('campanha', params.campanha)
    if (params.dep) q = q.eq('departamento', params.dep)
    if (params.grupo) q = q.eq('grupo', params.grupo)
    if (params.tipo) q = q.eq('tipo_peca', params.tipo)
    if (params.pe === '1') q = q.gt('estoque_pe', 0)
    if (params.prog === '1') q = q.eq('programacao', true)
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
  // Filtro "Tipo de Peça" (categoria e subtipo): calculado a partir do tipo e da descrição
  if (params.cat || params.sub) {
    return produtos.filter((p) => {
      const c = classificarPeca(p)
      return (!params.cat || c.categoria === params.cat) && (!params.sub || c.subtipo === params.sub)
    })
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
// Dentro de cada seção: idade (Baby → Infantil → Juvenil), menina antes de menino,
// tipo de peça (vestidos → macacões → conjuntos → blusas → regatas → croppeds → tops → bodies →
// batas → camisas → camisetas → casacos → saias → shorts → calças) e, dentro do tipo, o mesmo tecido junto.
// Ordem dos tipos de peça. A busca é feita na ordem da lista (a primeira que bater vale),
// por isso "camiseta" vem antes de "camisa" e "cropped" antes de "blusa".
// Categorias de peça: a busca é feita na ordem da lista (a primeira que bater vale), por isso
// "camiseta" vem antes de "camisa" e "cropped" antes de "blusa". O número é a ordem na vitrine.
const CATEGORIAS_PECA: { re: RegExp; ordem: number; nome: string }[] = [
  { re: /vestid/, ordem: 0, nome: 'Vestidos' },
  { re: /macac|macaq|jardineira/, ordem: 1, nome: 'Macacões' },
  { re: /conjunt/, ordem: 2, nome: 'Conjuntos' },
  { re: /camiset|tshirt/, ordem: 10, nome: 'Camisetas' },
  { re: /cropp/, ordem: 5, nome: 'Croppeds' },
  { re: /regat/, ordem: 4, nome: 'Regatas' },
  { re: /body/, ordem: 7, nome: 'Bodies' },
  { re: /bata/, ordem: 8, nome: 'Batas' },
  { re: /blus/, ordem: 3, nome: 'Blusas' },
  { re: /camis/, ordem: 9, nome: 'Camisas' },
  { re: /top/, ordem: 6, nome: 'Tops' },
  { re: /casac/, ordem: 11, nome: 'Casacos' },
  { re: /jaquet/, ordem: 12, nome: 'Jaquetas' },
  { re: /blaz/, ordem: 13, nome: 'Blazers' },
  { re: /colet/, ordem: 14, nome: 'Coletes' },
  { re: /cardig|kimon/, ordem: 15, nome: 'Cardigãs e Kimonos' },
  { re: /moletom|sueter/, ordem: 16, nome: 'Moletons e Suéteres' },
  { re: /saia/, ordem: 17, nome: 'Saias' },
  { re: /short|bermud/, ordem: 18, nome: 'Shorts e Bermudas' },
  { re: /calc|legging|pantalon|jogger/, ordem: 19, nome: 'Calças' },
]
const OUTRAS_PECAS = { ordem: 20, nome: 'Outras peças' }

function acharCategoria(tipo: string | null | undefined) {
  const n = normalizarTexto(tipo || '')
  return CATEGORIAS_PECA.find((c) => c.re.test(n)) || OUTRAS_PECAS
}

export function categoriaDaPeca(tipo: string | null | undefined): number {
  return acharCategoria(tipo).ordem
}

// "VESTIDO LONGO" -> "Vestidos"; "CALÇA SOCIAL" -> "Calças"
export function nomeCategoria(tipo: string | null | undefined): string {
  return acharCategoria(tipo).nome
}

// ==========================================
// ÁRVORE DE TIPOS DE PEÇA (menu do topo e filtro "Tipo de Peça")
// Categoria e subtipo saem do tipo da peça e da descrição do ERP. O comprimento (curto/midi/longo)
// vem do tipo; manga, alça etc. vêm do tipo + descrição.
// ==========================================
interface DefSubtipo {
  nome: string
  teste: (tipo: string, texto: string, descricaoBruta: string) => boolean
}
interface DefCategoria {
  nome: string
  subtipos: DefSubtipo[]
  padrao: string | null // subtipo de quem não se encaixa em nenhum (null = usa o nome do tipo)
}

// Comprimento: primeiro no tipo; se não tiver, logo depois do nome da peça na descrição
const comprimento = (alvo: RegExp, peca: string) => (tipo: string, _t: string, descricao: string) =>
  alvo.test(tipo) || new RegExp(`${peca}\\s+${alvo.source}`, 'i').test(descricao)
const contem = (re: RegExp) => (_tipo: string, texto: string) => re.test(texto)

const MANGA_CURTA = /mangacurta/
const MANGA_LONGA = /mangalonga|manga78/
const MANGA_34 = /manga34|tresquartos/
const SEM_MANGA = /semmanga|regata/
const ALCA = /alca/
const AMARRACAO = /amarra/

export const TAXONOMIA_PECAS: DefCategoria[] = [
  {
    nome: 'Blusa',
    padrao: 'Outras blusas',
    subtipos: [
      { nome: 'Blusa tomara que caia', teste: contem(/tomaraquecaia/) },
      { nome: 'Blusa de alça', teste: contem(ALCA) },
      { nome: 'Blusa sem manga', teste: contem(SEM_MANGA) },
      { nome: 'Blusa manga 3/4', teste: contem(MANGA_34) },
      { nome: 'Blusa manga longa', teste: contem(MANGA_LONGA) },
      { nome: 'Blusa manga curta', teste: (tipo, texto) => MANGA_CURTA.test(texto) || /camiset|tshirt/.test(tipo) },
      { nome: 'Blusa com amarração', teste: contem(AMARRACAO) },
    ],
  },
  {
    nome: 'Vestido',
    padrao: 'Outros vestidos',
    subtipos: [
      { nome: 'Vestido curto', teste: comprimento(/curt/, 'vestido') },
      { nome: 'Vestido midi', teste: comprimento(/midi/, 'vestido') },
      { nome: 'Vestido longo', teste: comprimento(/long/, 'vestido') },
    ],
  },
  {
    nome: 'Camisa',
    padrao: 'Outras camisas',
    subtipos: [
      { nome: 'Camisa baby (ajustada)', teste: contem(/babylook|ajustad/) },
      { nome: 'Camisa sem manga', teste: contem(SEM_MANGA) },
      { nome: 'Camisa manga longa', teste: contem(MANGA_LONGA) },
      { nome: 'Camisa manga curta', teste: contem(MANGA_CURTA) },
    ],
  },
  {
    nome: 'Short e Bermuda',
    padrao: 'Short',
    subtipos: [
      { nome: 'Bermuda', teste: (tipo) => /bermud/.test(tipo) },
      { nome: 'Short saia', teste: contem(/shortsaia/) },
      { nome: 'Short médio', teste: comprimento(/medio/, 'short') },
      { nome: 'Short curto', teste: comprimento(/curt/, 'short') },
    ],
  },
  {
    nome: 'Calça',
    padrao: 'Calça longa / tradicional',
    subtipos: [
      { nome: 'Calça cargo', teste: contem(/cargo/) },
      { nome: 'Calça jogger', teste: contem(/jogger/) },
      { nome: 'Calça pantacourt', teste: contem(/pantacourt/) },
      { nome: 'Calça envelope', teste: contem(/envelope/) },
      { nome: 'Calça midi', teste: comprimento(/midi/, 'cal[cç]a') },
    ],
  },
  {
    nome: 'Cropped',
    padrao: 'Outros croppeds',
    subtipos: [
      { nome: 'Cropped de alça', teste: contem(ALCA) },
      { nome: 'Cropped sem manga', teste: contem(SEM_MANGA) },
      { nome: 'Cropped manga longa', teste: contem(MANGA_LONGA) },
      { nome: 'Cropped manga curta', teste: contem(MANGA_CURTA) },
      { nome: 'Cropped com amarração', teste: contem(AMARRACAO) },
    ],
  },
  {
    nome: 'Macacão',
    padrao: 'Outros macacões',
    subtipos: [
      { nome: 'Macacão curto', teste: (tipo, t, d) => /macaquinho/.test(tipo) || comprimento(/curt/, 'maca[cq]\\w*')(tipo, t, d) },
      { nome: 'Macacão midi', teste: comprimento(/midi/, 'maca[cq]\\w*') },
      { nome: 'Macacão longo', teste: comprimento(/long/, 'maca[cq]\\w*') },
    ],
  },
  {
    nome: 'Saia',
    padrao: 'Outras saias',
    subtipos: [
      { nome: 'Saia curta', teste: comprimento(/curt/, 'saia') },
      { nome: 'Saia midi', teste: comprimento(/midi/, 'saia') },
      { nome: 'Saia longa', teste: comprimento(/long/, 'saia') },
    ],
  },
  {
    nome: 'Jaquetas, Casacos e Tricôs',
    padrao: null,
    subtipos: [
      { nome: 'Jaqueta', teste: (tipo) => /jaquet/.test(tipo) },
      { nome: 'Casaco', teste: (tipo) => /casac/.test(tipo) },
      { nome: 'Blazer', teste: (tipo) => /blaz/.test(tipo) },
      { nome: 'Sweater', teste: (tipo) => /sueter|sweater|trico/.test(tipo) },
      { nome: 'Cardigan', teste: (tipo) => /cardig/.test(tipo) },
      { nome: 'Blusão', teste: (tipo) => /blusao|moletom/.test(tipo) },
    ],
  },
  {
    nome: 'Outros Itens',
    padrao: null,
    subtipos: [
      { nome: 'Bata', teste: (tipo) => /bata/.test(tipo) },
      { nome: 'Kimono', teste: (tipo) => /kimon/.test(tipo) },
      { nome: 'Colete', teste: (tipo) => /colet/.test(tipo) },
    ],
  },
]

// Em que categoria a peça entra (a ordem importa: "short saia" é short; "blusão" é agasalho)
const DETECCAO_CATEGORIA: [RegExp, string][] = [
  [/short|bermud/, 'Short e Bermuda'],
  [/macac|macaq|jardineira/, 'Macacão'],
  [/vestid/, 'Vestido'],
  [/blusao|jaquet|casac|blaz|sueter|sweater|trico|cardig|moletom/, 'Jaquetas, Casacos e Tricôs'],
  [/cropp|top/, 'Cropped'],
  [/camiset|tshirt|regat|body|blus/, 'Blusa'],
  [/camis/, 'Camisa'],
  [/saia/, 'Saia'],
  [/calc|legging|pantalon|jogger|pantacourt/, 'Calça'],
]

export interface ClassePeca {
  categoria: string
  subtipo: string
}

export function classificarPeca(p: { tipo_peca?: string | null; descricao?: string | null }): ClassePeca {
  const tipo = normalizarTexto(p.tipo_peca || '')
  const descricaoBruta = String(p.descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const texto = normalizarTexto(`${p.tipo_peca || ''} ${p.descricao || ''}`)
  const nomeCat = (DETECCAO_CATEGORIA.find(([re]) => re.test(tipo)) || [null, 'Outros Itens'])[1]
  const def = TAXONOMIA_PECAS.find((c) => c.nome === nomeCat)!
  const sub = def.subtipos.find((s) => s.teste(tipo, texto, descricaoBruta))
  return {
    categoria: def.nome,
    subtipo: sub ? sub.nome : def.padrao || formatarNome(p.tipo_peca) || 'Outros',
  }
}

// Ordem de exibição: categorias e subtipos na ordem da lista acima ("outros" no fim)
function ordemCategoria(nome: string) {
  const i = TAXONOMIA_PECAS.findIndex((c) => c.nome === nome)
  return i < 0 ? 99 : i
}
function ordemSubtipo(categoria: string, nome: string) {
  const def = TAXONOMIA_PECAS.find((c) => c.nome === categoria)
  const i = def ? def.subtipos.findIndex((s) => s.nome === nome) : -1
  return i < 0 ? 98 : i
}

export interface RamoTipos {
  categoria: string
  subtipos: string[]
}

// Ordena nomes de categoria na ordem da vitrine (vestidos, macacões, conjuntos, blusas...)
export function ordenarCategorias(nomes: string[]): string[] {
  const ordem = (nome: string) =>
    (CATEGORIAS_PECA.find((c) => c.nome === nome) || OUTRAS_PECAS).ordem
  return [...nomes].sort((a, b) => ordem(a) - ordem(b))
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
  // Se o departamento não diz menina/menino, usa a descrição (ex.: "VESTIDO ... FEM INFANTIL")
  let genero = generoDep(dep)
  if (genero === 2) genero = generoDep(normalizarTexto(`${p.descricao || ''} ${p.tipo_peca || ''}`))
  const secao = SECOES_VITRINE.findIndex((x) => x.chave === secaoDoDepartamento(p.departamento))
  return [
    secao, // só faz diferença em Novidades, que reúne todas as seções (Feminino primeiro, Kids por último)
    qualidade >= 3 ? 1 : 0, // sem foto de modelo vai para o fim
    faixaEtaria(dep),
    dep.includes('plus') ? 1 : 0,
    genero,
    dep,
    ehConjunto ? 2 : categoriaDaPeca(p.tipo_peca), // todos os vestidos, depois todas as blusas...
    normalizarTexto(p.tipo_peca || ''), // dentro do tipo: "vestido curto" juntos, "vestido longo" juntos
    normalizarTexto(p.grupo || ''), // e, dentro disso, o mesmo tecido junto
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

export function organizarVitrine(
  itens: ItemVitrine[],
  conjuntos: ItemVitrine[],
  incluirNovidades: boolean
): SecaoVitrine[] {
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
      natural: chaveNatural(pecas, qualidade, false),
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

  // Seção Conjuntos: ordem do painel; o resto na ordem natural da primeira peça
  if (conjuntos.length) {
    const dadosConj = conjuntos.map((item, indice) => {
      const pecas = pecasDoItem(item)
      const ordem = item.tipo === 'conjunto' && item.conjunto.ordem !== null ? item.conjunto.ordem : SEM_ORDEM
      const qualidade = capaDoItem(pecas, '', item.tipo === 'conjunto' ? item.conjunto : null).qualidade
      return { item, indice, ordem, natural: chaveNatural(pecas, qualidade, true) }
    })
    dadosConj.sort((a, b) => a.ordem - b.ordem || compararChaves(a.natural, b.natural) || a.indice - b.indice)
    secoes.push({ chave: 'conjuntos', titulo: 'Conjuntos', itens: dadosConj.map((d) => d.item) })
  }

  SECOES_VITRINE.forEach(({ chave, titulo }) => {
    const daSecao = dados.filter((d) => d.secao === chave)
    if (daSecao.length) secoes.push({ chave, titulo, itens: ordenar(daSecao, 'ordemVitrine') })
  })
  return secoes
}
