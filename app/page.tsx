import Link from 'next/link'
import BannerVitrine, { BannerItem } from './BannerVitrine'
import CabecalhoLoja from './componentes/CabecalhoLoja'
import FiltrosLaterais from './componentes/FiltrosLaterais'
import CardProduto from './componentes/CardProduto'
import styles from './Vitrine.module.css'
import {
  Params,
  supabase,
  agruparConjuntos,
  carregarEstrutura,
  limparBusca,
  montarUrlFiltro,
  normalizarMarca,
  urlDaMarca,
} from './lib/catalogo'

export const revalidate = 0

export default async function Vitrine({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  const params = await searchParams
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const marca = normalizarMarca(params.marca)
  const ehTodos = marca === 'TODOS'
  const busca = params.q ? limparBusca(params.q) : ''

  // Consulta de produtos com os filtros da URL
  let query = supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('fotos', { ascending: false })
    .limit(1000)

  if (!ehTodos) query = query.eq('marca', marca)
  if (params.colecao) query = query.eq('colecao', params.colecao)
  if (params.campanha) query = query.eq('campanha', params.campanha)
  if (params.dep) query = query.eq('departamento', params.dep)
  if (params.grupo) query = query.eq('grupo', params.grupo)
  if (params.tipo) query = query.eq('tipo_peca', params.tipo)
  if (params.pe === '1') query = query.gt('estoque_pe', 0)
  if (busca) {
    query = query.or(
      `referencia.ilike.%${busca}%,descricao.ilike.%${busca}%,colecao.ilike.%${busca}%,campanha.ilike.%${busca}%`
    )
  }

  const [estrutura, { data: bannersRaw }, { data: produtos }] = await Promise.all([
    carregarEstrutura(marca),
    supabase
      .from('banners')
      .select('id, marca, tag_campanha, titulo, subtitulo, botao_texto, imagem_url, link_destino')
      .eq('ativo', true)
      .eq('marca', marca)
      .order('ordem', { ascending: true }),
    query,
  ])

  const banners = (bannersRaw || []) as BannerItem[]
  const itens = await agruparConjuntos(produtos || [])
  const configMarcaAtiva = !ehTodos ? estrutura.mapaLogos[marca] : null

  const filtrosAtivos: { chave: string; label: string; valor: string }[] = []
  if (params.colecao) filtrosAtivos.push({ chave: 'colecao', label: 'Coleção', valor: params.colecao })
  if (params.campanha) filtrosAtivos.push({ chave: 'campanha', label: 'Campanha', valor: params.campanha })
  if (params.dep) filtrosAtivos.push({ chave: 'dep', label: 'Depto', valor: params.dep })
  if (params.grupo) filtrosAtivos.push({ chave: 'grupo', label: 'Grupo', valor: params.grupo })
  if (params.tipo) filtrosAtivos.push({ chave: 'tipo', label: 'Tipo', valor: params.tipo })
  if (params.pe === '1') filtrosAtivos.push({ chave: 'pe', label: 'Estoque', valor: 'Pronta Entrega' })
  if (params.q) filtrosAtivos.push({ chave: 'q', label: 'Busca', valor: params.q })

  return (
    <div className={styles.pagina}>
      <CabecalhoLoja
        marca={marca}
        estrutura={estrutura}
        params={params}
        menuTodasAtivo={filtrosAtivos.length === 0}
      />

      {filtrosAtivos.length === 0 && <BannerVitrine banners={banners} />}

      {!ehTodos && (
        <div className={styles.headerMarcaAtiva}>
          <div className={styles.tituloMarcaBox}>
            {configMarcaAtiva?.logo_url ? (
              <img src={configMarcaAtiva.logo_url} alt={marca} className={styles.logoMarcaDestaque} />
            ) : (
              <h1 className={styles.tituloMarca}>{marca}</h1>
            )}
            {configMarcaAtiva?.subtitulo && (
              <p className={styles.subtituloMarca}>{configMarcaAtiva.subtitulo}</p>
            )}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.layoutComFiltros}>
          <FiltrosLaterais
            marca={marca}
            estrutura={estrutura}
            params={params}
            temFiltroAtivo={filtrosAtivos.length > 0}
          />

          <div>
            <div className={styles.barraFiltroAtivo}>
              <div className={styles.listaChips}>
                <span className={styles.contadorResultados}>
                  {itens.length === 1 ? '1 item' : `${itens.length} itens`}
                  {!ehTodos ? ` em ${marca}` : ''}
                </span>

                {filtrosAtivos.map((f) => (
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

              {filtrosAtivos.length > 0 && (
                <Link href={urlDaMarca(marca)} className={styles.limparFiltro}>
                  Limpar filtros ✕
                </Link>
              )}
            </div>

            {itens.length > 0 ? (
              <div className={styles.gridVitrine}>
                {itens.map((item) =>
                  item.tipo === 'conjunto' ? (
                    <CardProduto
                      key={`cj-${item.pecas[0].referencia}`}
                      produto={item.pecas[0]}
                      conjunto={item.pecas}
                      r2BaseUrl={r2BaseUrl}
                    />
                  ) : (
                    <CardProduto key={item.produto.referencia} produto={item.produto} r2BaseUrl={r2BaseUrl} />
                  )
                )}
              </div>
            ) : (
              <div className={styles.vazio}>
                Nenhuma peça encontrada {ehTodos ? '' : `na marca ${marca} `}para esta seleção.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
