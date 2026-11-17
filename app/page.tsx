import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import BannerVitrine, { BannerItem } from './BannerVitrine'
import styles from './Vitrine.module.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const revalidate = 0

const ABAS_MARCAS = ['TODOS', 'AISHTY', "WE'RE THE BASIC", 'VASPAC'] as const

// Adicione esta função de ordenação para priorizar frente e costas
function ordenarFotos(arquivos: string[]): string[] {
  const peso = (nome: string) => {
    const lower = nome.toLowerCase()
    if (lower.startsWith('frente_')) return 0
    if (lower.startsWith('costas_')) return 1
    if (lower.includes('_')) return 2
    return 3 // Amostra de cor pura fica por último
  }
  return [...arquivos].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b))
}

function obterFotosCard(
  fotos: Record<string, string[]> | null,
  referencia: string,
  r2BaseUrl: string
) {
  if (!fotos) return { capa: null, hover: null }
  const cores = Object.keys(fotos)
  if (cores.length === 0) return { capa: null, hover: null }

  const primeiraCor = cores[0]
  
  // AQUI: Aplicamos a ordenação antes de pegar a foto de capa e hover
  const listaFotos = ordenarFotos(fotos[primeiraCor])
  
  if (!listaFotos || listaFotos.length === 0) return { capa: null, hover: null }

  const capa = `${r2BaseUrl}/${referencia}/${encodeURIComponent(listaFotos[0])}`
  const hover =
    listaFotos.length > 1
      ? `${r2BaseUrl}/${referencia}/${encodeURIComponent(listaFotos[1])}`
      : null

  return { capa, hover }
}

function montarUrlFiltro(
  atual: Record<string, string | undefined>,
  alteracoes: Record<string, string | undefined>
) {
  const combinado = { ...atual, ...alteracoes }
  const qs = new URLSearchParams()
  Object.entries(combinado).forEach(([k, v]) => {
    if (v && v.trim() !== '') {
      qs.set(k, v)
    }
  })
  const str = qs.toString()
  return str ? `/?${str}` : '/'
}

export default async function Vitrine({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const marcaSelecionada =
    params.marca && ABAS_MARCAS.includes(params.marca.toUpperCase() as (typeof ABAS_MARCAS)[number])
      ? params.marca.toUpperCase()
      : 'TODOS'

  const ehAbaGaleria = marcaSelecionada === 'TODOS'

  // 1. Busca configuração de logos das marcas
  const { data: marcasRaw } = await supabase
    .from('marcas_config')
    .select('chave, nome_exibicao, logo_url, subtitulo')

  const mapaLogos: Record<string, { nome_exibicao: string; logo_url: string | null; subtitulo: string | null }> = {}
  marcasRaw?.forEach((m) => {
    mapaLogos[m.chave.toUpperCase()] = m
  })

  const configMarcaAtiva = !ehAbaGaleria ? mapaLogos[marcaSelecionada] : null

  // 2. Busca banners ativos exclusivos da aba selecionada
  const { data: bannersRaw } = await supabase
    .from('banners')
    .select('id, marca, tag_campanha, titulo, subtitulo, botao_texto, imagem_url, link_destino')
    .eq('ativo', true)
    .eq('marca', marcaSelecionada)
    .order('ordem', { ascending: true })

  const banners = (bannersRaw || []) as BannerItem[]

  // 3. Busca metadados apenas dos produtos ATIVOS da marca atual para montar filtros dinâmicos exclusivos
  let metaQuery = supabase
    .from('produtos')
    .select('departamento, grupo, colecao, campanha, tipo_peca')
    .eq('ativo', true)

  if (!ehAbaGaleria) {
    metaQuery = metaQuery.eq('marca', marcaSelecionada)
  }

  const { data: metaRaw } = await metaQuery

  const mapaMenus: Record<string, Set<string>> = {}
  const setColecoes = new Set<string>()
  const setCampanhas = new Set<string>()
  const setTipos = new Set<string>()

  metaRaw?.forEach((item) => {
    const dep = item.departamento?.trim()
    const grp = item.grupo?.trim()
    const col = item.colecao?.trim()
    const camp = item.campanha?.trim()
    const tipo = item.tipo_peca?.trim()

    if (dep) {
      if (!mapaMenus[dep]) mapaMenus[dep] = new Set()
      if (grp) mapaMenus[dep].add(grp)
    }
    if (col) setColecoes.add(col)
    if (camp) setCampanhas.add(camp)
    if (tipo) setTipos.add(tipo)
  })

  const departamentosOrdenados = Object.keys(mapaMenus).sort()
  const colecoesOrdenadas = Array.from(setColecoes).sort()
  const campanhasOrdenadas = Array.from(setCampanhas).sort()
  const tiposOrdenados = Array.from(setTipos).sort()

  const gruposDisponiveis = params.dep
    ? Array.from(mapaMenus[params.dep] || []).sort()
    : Array.from(new Set(Object.values(mapaMenus).flatMap((s) => Array.from(s)))).sort()

  // 4. Consulta os produtos filtrados estritamente dentro da aba ativa
  let query = supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('fotos', { ascending: false })
    .limit(1000)

  if (!ehAbaGaleria) {
    query = query.eq('marca', marcaSelecionada)
  }
  if (params.colecao) query = query.eq('colecao', params.colecao)
  if (params.campanha) query = query.eq('campanha', params.campanha)
  if (params.dep) query = query.eq('departamento', params.dep)
  if (params.grupo) query = query.eq('grupo', params.grupo)
  if (params.tipo) query = query.eq('tipo_peca', params.tipo)
  if (params.pe === '1') query = query.gt('estoque_pe', 0)

  if (params.q) {
    query = query.or(
      `referencia.ilike.%${params.q}%,descricao.ilike.%${params.q}%,colecao.ilike.%${params.q}%,campanha.ilike.%${params.q}%`
    )
  }

  const { data: produtos } = await query

  const baseParamsAba = ehAbaGaleria ? {} : { marca: marcaSelecionada }

  const filtrosAtivosLista: { chave: string; label: string; valor: string }[] = []
  if (params.colecao) filtrosAtivosLista.push({ chave: 'colecao', label: 'Coleção', valor: params.colecao })
  if (params.campanha) filtrosAtivosLista.push({ chave: 'campanha', label: 'Campanha', valor: params.campanha })
  if (params.dep) filtrosAtivosLista.push({ chave: 'dep', label: 'Depto', valor: params.dep })
  if (params.grupo) filtrosAtivosLista.push({ chave: 'grupo', label: 'Grupo', valor: params.grupo })
  if (params.tipo) filtrosAtivosLista.push({ chave: 'tipo', label: 'Tipo', valor: params.tipo })
  if (params.pe === '1') filtrosAtivosLista.push({ chave: 'pe', label: 'Estoque', valor: 'Pronta Entrega' })
  if (params.q) filtrosAtivosLista.push({ chave: 'q', label: 'Busca', valor: params.q })

  return (
    <div className={styles.pagina}>
      <header className={styles.header}>
        {/* Barra de Abas (Com a busca incluída na mesma linha) */}
        <div className={styles.barraMarcas}>
          <div className={styles.containerMarcas}>
            <div className={styles.abasMarcas}>
              {ABAS_MARCAS.map((aba) => {
                const ativa = marcaSelecionada === aba
                const infoAba = mapaLogos[aba]
                const hrefAba = aba === 'TODOS' ? '/' : `/?marca=${encodeURIComponent(aba)}`

                return (
                  <Link
                    key={aba}
                    href={hrefAba}
                    className={`${styles.abaMarca} ${ativa ? styles.abaMarcaAtiva : ''}`}
                  >
                    {aba !== 'TODOS' && infoAba?.logo_url ? (
                      <img src={infoAba.logo_url} alt={aba} className={styles.abaMarcaLogo} />
                    ) : (
                      <span>{aba}</span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Busca movida para a mesma linha das abas */}
            <form action="/" className={styles.formBusca}>
              {!ehAbaGaleria && <input type="hidden" name="marca" value={marcaSelecionada} />}
              <input
                type="text"
                name="q"
                defaultValue={params.q || ''}
                placeholder={
                  ehAbaGaleria
                    ? 'Buscar referência, peça ou coleção...'
                    : `Buscar em ${marcaSelecionada}...`
                }
                className={styles.inputBusca}
              />
            </form>
          </div>
        </div>

        {/* Sub-menus dinâmicos exclusivos da aba selecionada */}
        <nav className={styles.navBar}>
          <div className={styles.navContainer}>
            <div className={styles.menuItem}>
              <Link
                href={ehAbaGaleria ? '/' : `/?marca=${encodeURIComponent(marcaSelecionada)}`}
                className={`${styles.menuLink} ${filtrosAtivosLista.length === 0 ? styles.menuLinkAtivo : ''}`}
              >
                {ehAbaGaleria ? 'Todas as Peças' : `Tudo de ${marcaSelecionada}`}
              </Link>
            </div>

            {(colecoesOrdenadas.length > 0 || campanhasOrdenadas.length > 0) && (
              <div className={styles.menuItem}>
                <span
                  className={`${styles.menuLink} ${styles.menuLinkDestaque} ${
                    params.colecao || params.campanha ? styles.menuLinkAtivo : ''
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  Coleções & Campanhas ▾
                </span>

                <div className={styles.submenuDropdown}>
                  {campanhasOrdenadas.length > 0 && (
                    <>
                      <div className={styles.submenuHeader}>Campanhas</div>
                      {campanhasOrdenadas.map((camp) => (
                        <Link
                          key={camp}
                          href={montarUrlFiltro(baseParamsAba, { campanha: camp })}
                          className={styles.submenuLink}
                        >
                          {camp.toLowerCase()}
                        </Link>
                      ))}
                    </>
                  )}

                  {colecoesOrdenadas.length > 0 && (
                    <>
                      <div className={styles.submenuHeader}>Coleções</div>
                      {colecoesOrdenadas.map((col) => (
                        <Link
                          key={col}
                          href={montarUrlFiltro(baseParamsAba, { colecao: col })}
                          className={styles.submenuLink}
                        >
                          {col.toLowerCase()}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {departamentosOrdenados.map((dep) => {
              const submenus = Array.from(mapaMenus[dep]).sort()
              const ativo = params.dep === dep

              return (
                <div key={dep} className={styles.menuItem}>
                  <Link
                    href={montarUrlFiltro(baseParamsAba, { dep })}
                    className={`${styles.menuLink} ${ativo ? styles.menuLinkAtivo : ''}`}
                  >
                    {dep.toLowerCase()}
                  </Link>

                  {submenus.length > 0 && (
                    <div className={styles.submenuDropdown}>
                      {submenus.map((grp) => (
                        <Link
                          key={grp}
                          href={montarUrlFiltro(baseParamsAba, { dep, grupo: grp })}
                          className={styles.submenuLink}
                        >
                          {grp.toLowerCase()}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Carrossel de Campanhas da Aba Ativa */}
      {filtrosAtivosLista.length === 0 && <BannerVitrine banners={banners} />}

      {/* Identidade Visual da Marca quando uma aba específica está selecionada */}
      {!ehAbaGaleria && (
        <div className={styles.headerMarcaAtiva}>
          <div className={styles.tituloMarcaBox}>
            {configMarcaAtiva?.logo_url ? (
              <img
                src={configMarcaAtiva.logo_url}
                alt={marcaSelecionada}
                className={styles.logoMarcaDestaque}
              />
            ) : (
              <h1 className={styles.tituloMarca}>{marcaSelecionada}</h1>
            )}
            {configMarcaAtiva?.subtitulo && (
              <p className={styles.subtituloMarca}>{configMarcaAtiva.subtitulo}</p>
            )}
          </div>
        </div>
      )}

      {/* Vitrine + Filtros Dinâmicos exclusivos da aba */}
      <main className={styles.main}>
        <div className={styles.layoutComFiltros}>
          <aside className={styles.sidebarFiltros}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitulo}>
                {ehAbaGaleria ? 'Filtros • Todos' : `Filtros • ${marcaSelecionada}`}
              </h2>
              {filtrosAtivosLista.length > 0 && (
                <Link
                  href={ehAbaGaleria ? '/' : `/?marca=${encodeURIComponent(marcaSelecionada)}`}
                  className={styles.limparFiltro}
                >
                  Limpar
                </Link>
              )}
            </div>

            <div className={styles.grupoFiltro}>
              <p className={styles.tituloGrupoFiltro}>Disponibilidade</p>
              <div className={styles.listaOpcoesFiltro}>
                <Link
                  href={montarUrlFiltro(params, { pe: params.pe === '1' ? undefined : '1' })}
                  className={`${styles.opcaoFiltro} ${params.pe === '1' ? styles.opcaoFiltroAtiva : ''}`}
                >
                  <span>Pronta Entrega</span>
                  <span>{params.pe === '1' ? '✓' : ''}</span>
                </Link>
              </div>
            </div>

            {campanhasOrdenadas.length > 0 && (
              <div className={styles.grupoFiltro}>
                <p className={styles.tituloGrupoFiltro}>Campanha</p>
                <div className={styles.listaOpcoesFiltro}>
                  {campanhasOrdenadas.map((camp) => {
                    const ativa = params.campanha === camp
                    return (
                      <Link
                        key={camp}
                        href={montarUrlFiltro(params, { campanha: ativa ? undefined : camp })}
                        className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
                      >
                        <span>{camp.toLowerCase()}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {colecoesOrdenadas.length > 0 && (
              <div className={styles.grupoFiltro}>
                <p className={styles.tituloGrupoFiltro}>Coleção</p>
                <div className={styles.listaOpcoesFiltro}>
                  {colecoesOrdenadas.map((col) => {
                    const ativa = params.colecao === col
                    return (
                      <Link
                        key={col}
                        href={montarUrlFiltro(params, { colecao: ativa ? undefined : col })}
                        className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
                      >
                        <span>{col.toLowerCase()}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {departamentosOrdenados.length > 0 && (
              <div className={styles.grupoFiltro}>
                <p className={styles.tituloGrupoFiltro}>Departamento</p>
                <div className={styles.listaOpcoesFiltro}>
                  {departamentosOrdenados.map((dep) => {
                    const ativa = params.dep === dep
                    return (
                      <Link
                        key={dep}
                        href={montarUrlFiltro(params, {
                          dep: ativa ? undefined : dep,
                          grupo: ativa ? undefined : params.grupo,
                        })}
                        className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
                      >
                        <span>{dep.toLowerCase()}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {gruposDisponiveis.length > 0 && (
              <div className={styles.grupoFiltro}>
                <p className={styles.tituloGrupoFiltro}>Grupo</p>
                <div className={styles.listaOpcoesFiltro}>
                  {gruposDisponiveis.map((grp) => {
                    const ativa = params.grupo === grp
                    return (
                      <Link
                        key={grp}
                        href={montarUrlFiltro(params, { grupo: ativa ? undefined : grp })}
                        className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
                      >
                        <span>{grp.toLowerCase()}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {tiposOrdenados.length > 0 && (
              <div className={styles.grupoFiltro}>
                <p className={styles.tituloGrupoFiltro}>Tipo de Peça</p>
                <div className={styles.listaOpcoesFiltro}>
                  {tiposOrdenados.map((tipo) => {
                    const ativa = params.tipo === tipo
                    return (
                      <Link
                        key={tipo}
                        href={montarUrlFiltro(params, { tipo: ativa ? undefined : tipo })}
                        className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
                      >
                        <span>{tipo.toLowerCase()}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>

          <div>
            <div className={styles.barraFiltroAtivo}>
              <div className={styles.listaChips}>
                <span className={styles.contadorResultados}>
                  {produtos ? `${produtos.length} peça(s)` : '0 peças'}
                  {!ehAbaGaleria ? ` em ${marcaSelecionada}` : ''}
                </span>

                {filtrosAtivosLista.map((f) => (
                  <Link
                    key={f.chave}
                    href={montarUrlFiltro(params, { [f.chave]: undefined })}
                    className={styles.chipFiltro}
                  >
                    <span>
                      {f.label}: {f.valor.toLowerCase()}
                    </span>
                    <span>✕</span>
                  </Link>
                ))}
              </div>

              {filtrosAtivosLista.length > 0 && (
                <Link
                  href={ehAbaGaleria ? '/' : `/?marca=${encodeURIComponent(marcaSelecionada)}`}
                  className={styles.limparFiltro}
                >
                  Limpar filtros ✕
                </Link>
              )}
            </div>

            {produtos && produtos.length > 0 ? (
              <div className={styles.gridVitrine}>
                {produtos.map((produto) => {
                  const { capa, hover } = obterFotosCard(produto.fotos, produto.referencia, r2BaseUrl)
                  const totalCores = produto.fotos ? Object.keys(produto.fotos).length : 0

                  return (
                    <Link
                      key={produto.referencia}
                      href={`/produto/${produto.referencia}`}
                      className={styles.card}
                    >
                      <div className={styles.cardImagemWrapper}>
                        {capa ? (
                          <>
                            <img
                              src={capa}
                              alt={produto.descricao || `Referência ${produto.referencia}`}
                              className={`${styles.cardImagem} ${!hover ? styles.cardImagemUnica : ''}`}
                            />
                            {hover && (
                              <img
                                src={hover}
                                alt={`${produto.descricao || produto.referencia} - costas`}
                                className={styles.cardImagemHover}
                              />
                            )}
                          </>
                        ) : (
                          <span className={styles.semFoto}>Sem imagem</span>
                        )}

                        {/* Aqui está a badge de novidade renderizada dinamicamente */}
                        {produto.novidade && (
                          <span className={styles.badgeNovidade}>Novidade</span>
                        )}

                        {produto.colecao && (
                          <span className={styles.badgeColecao}>{produto.colecao}</span>
                        )}

                        {totalCores > 1 && (
                          <span className={styles.badgeCores}>{totalCores} cores</span>
                        )}
                      </div>

                      <p className={styles.cardMeta}>
                        {produto.marca ? `${produto.marca} • ` : ''}Ref: {produto.referencia}
                      </p>
                      <h2 className={styles.cardTitulo}>
                        {produto.descricao || `Referência ${produto.referencia}`}
                      </h2>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className={styles.vazio}>
                Nenhuma peça encontrada {ehAbaGaleria ? '' : `na marca ${marcaSelecionada} `}para esta seleção.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}