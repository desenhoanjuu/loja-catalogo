import Link from 'next/link'
import BannerVitrine, { BannerItem } from './BannerVitrine'
import CabecalhoLoja from './componentes/CabecalhoLoja'
import FiltrosLaterais from './componentes/FiltrosLaterais'
import CardProduto from './componentes/CardProduto'
import styles from './Vitrine.module.css'
import { contextoPreco, formatarReal, precoUnitario } from './lib/precos'
import secoesCss from './Secoes.module.css'
import {
  ItemVitrine,
  Params,
  supabase,
  conjuntosDaVitrine,
  buscarProdutosVitrine,
  carregarEstrutura,
  montarUrlFiltro,
  organizarVitrine,
  type Produto,
  urlArquivoPainel,
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
  const [estrutura, { data: bannersRaw }, produtosEncontrados] = await Promise.all([
    carregarEstrutura(marca),
    supabase
      .from('banners')
      .select('id, marca, tag_campanha, titulo, subtitulo, botao_texto, imagem_url, link_destino')
      .eq('ativo', true)
      .eq('marca', marca)
      .order('ordem', { ascending: true }),
    buscarProdutosVitrine(marca, params),
  ])

  // Preço: só quando liberado para quem está vendo. O filtro "Preço" usa o mesmo valor mostrado no card
  // (em centavos na URL: ?preco=4400_5990).
  const ctxPreco = await contextoPreco()
  const centavos = (p: Produto) => {
    const v = precoUnitario(p.referencia, p.preco_peca, ctxPreco)
    return v ? Math.round(v * 100) : 0
  }
  const contagemPrecos = new Map<number, number>()
  if (ctxPreco.regra) {
    produtosEncontrados.forEach((p) => {
      const c = centavos(p)
      if (c) contagemPrecos.set(c, (contagemPrecos.get(c) || 0) + 1)
    })
  }
  const opcoesPreco = Array.from(contagemPrecos.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([valor, quantidade]) => ({ centavos: valor, quantidade }))
  const precosEscolhidos = ctxPreco.regra
    ? String(params.preco || '').split('_').map(Number).filter((n) => n > 0)
    : []
  const produtos = precosEscolhidos.length
    ? produtosEncontrados.filter((p) => precosEscolhidos.includes(centavos(p)))
    : produtosEncontrados

  const banners = ((bannersRaw || []) as BannerItem[])
    .map((b) => ({ ...b, imagem_url: urlArquivoPainel(b.imagem_url) || '' }))
    .filter((b) => b.imagem_url)
  // Peças sempre sozinhas nas seções delas; os conjuntos ganham uma seção própria
  const itens: ItemVitrine[] = produtos.map((produto) => ({ tipo: 'produto', produto }))
  const conjuntos = await conjuntosDaVitrine(produtos)
  const configMarcaAtiva = !ehTodos ? estrutura.mapaLogos[marca] : null

  const filtrosAtivos: { chave: string; label: string; valor: string }[] = []
  if (params.colecao) filtrosAtivos.push({ chave: 'colecao', label: 'Coleção', valor: params.colecao })
  if (params.campanha) filtrosAtivos.push({ chave: 'campanha', label: 'Campanha', valor: params.campanha })
  if (params.dep) filtrosAtivos.push({ chave: 'dep', label: 'Depto', valor: params.dep })
  if (params.grupo) filtrosAtivos.push({ chave: 'grupo', label: 'Grupo', valor: params.grupo })
  if (params.cat) filtrosAtivos.push({ chave: 'cat', label: 'Peça', valor: params.cat })
  if (params.sub) filtrosAtivos.push({ chave: 'sub', label: 'Tipo', valor: params.sub })
  if (params.tipo) filtrosAtivos.push({ chave: 'tipo', label: 'Tipo', valor: params.tipo })
  if (params.pe === '1') filtrosAtivos.push({ chave: 'pe', label: 'Estoque', valor: 'Pronta Entrega' })
  if (params.prog === '1') filtrosAtivos.push({ chave: 'prog', label: 'Estoque', valor: 'Programação' })
  if (params.q) filtrosAtivos.push({ chave: 'q', label: 'Busca', valor: params.q })
  if (precosEscolhidos.length)
    filtrosAtivos.push({ chave: 'preco', label: 'Preço', valor: precosEscolhidos.map((c) => formatarReal(c / 100)).join(', ') })

  // Novidades no topo só na vitrine sem filtros; depois, as seções por departamento
  const secoes = organizarVitrine(itens, conjuntos, filtrosAtivos.length === 0)
  const mostrarTitulos = secoes.length > 1

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
            opcoesPreco={opcoesPreco}
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
              <div className={secoesCss.listaSecoes}>
                {secoes.map((secao) => (
                  <section key={secao.chave} id={secao.chave} className={secoesCss.secao}>
                    {mostrarTitulos && (
                      <div className={secoesCss.cabecalhoSecao}>
                        <h2 className={secoesCss.tituloSecao}>{secao.titulo}</h2>
                        <span className={secoesCss.contagemSecao}>
                          {secao.itens.length} {secao.itens.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    )}
                    <div className={styles.gridVitrine}>
                      {secao.itens.map((item) =>
                        item.tipo === 'conjunto' ? (
                          <CardProduto
                            key={`cj-${item.conjunto.id}`}
                            produto={item.pecas[0]}
                            conjunto={item.pecas}
                            conjuntoInfo={item.conjunto}
                            r2BaseUrl={r2BaseUrl}
                          />
                        ) : (
                          <CardProduto key={item.produto.referencia} produto={item.produto} r2BaseUrl={r2BaseUrl} />
                        )
                      )}
                    </div>
                  </section>
                ))}
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
