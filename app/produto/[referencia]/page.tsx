import Link from 'next/link'
import GaleriaProduto from './GaleriaProduto'
import CabecalhoLoja from '../../componentes/CabecalhoLoja'
import FiltrosLaterais from '../../componentes/FiltrosLaterais'
import CardProduto from '../../componentes/CardProduto'
import vitrine from '../../Vitrine.module.css'
import styles from './GaleriaProduto.module.css'
import {
  Conjunto,
  Params,
  Produto,
  supabase,
  buscarConjuntosDaReferencia,
  pecasDoConjunto,
  buscarSimilares,
  coresEmComum,
  ehVisivelNoSite,
  carregarEstrutura,
  montarUrlFiltro,
  normalizarMarca,
} from '../../lib/catalogo'
import { produtoParaPeca } from '../../lib/pecas'

export const revalidate = 0

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ referencia: string }>
}) {
  const { referencia } = await params
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const { data: encontrado } = await supabase
    .from('produtos')
    .select('*')
    .eq('referencia', referencia)
    .maybeSingle()

  // Referência não autorizada no painel (ou esgotada no ERP) não abre, nem pelo link direto
  const produto = ehVisivelNoSite(encontrado) ? encontrado : null

  // A página da peça mostra só a peça. Os conjuntos de que ela faz parte aparecem abaixo.
  const conjuntos: { conjunto: Conjunto; pecas: Produto[] }[] = []
  if (produto) {
    for (const conjunto of await buscarConjuntosDaReferencia(produto.referencia)) {
      const pecas = await pecasDoConjunto(conjunto)
      if (pecas.length > 1 && coresEmComum(pecas)) conjuntos.push({ conjunto, pecas })
    }
  }
  const refsDosConjuntos = Array.from(new Set(conjuntos.flatMap((c) => c.pecas.map((p) => p.referencia))))

  // A aba ativa no cabeçalho é a marca do produto
  const marca = normalizarMarca(produto?.marca)
  const baseParams: Params = marca === 'TODOS' ? {} : { marca }

  const [estrutura, similares] = await Promise.all([
    carregarEstrutura(marca),
    produto ? buscarSimilares(produto, 8, refsDosConjuntos) : Promise.resolve([]),
  ])

  return (
    <div className={vitrine.pagina}>
      <CabecalhoLoja marca={marca} estrutura={estrutura} params={{}} menuTodasAtivo={false} />

      <main className={vitrine.main}>
        <div className={vitrine.layoutComFiltros}>
          <FiltrosLaterais
            marca={marca}
            estrutura={estrutura}
            params={baseParams}
            temFiltroAtivo={false}
            className={styles.esconderNoMobile}
          />

          <div className={styles.conteudoProduto}>
            {!produto ? (
              <div className={vitrine.vazio}>
                Referência {referencia} não está disponível no catálogo.{' '}
                <Link href="/" className={vitrine.limparFiltro}>
                  Voltar ao catálogo
                </Link>
              </div>
            ) : (
              <>
                <nav className={styles.breadcrumb} aria-label="Caminho">
                  <Link href="/">Home</Link>
                  {produto.departamento && (
                    <>
                      <span>/</span>
                      <Link href={montarUrlFiltro(baseParams, { dep: produto.departamento })}>
                        {produto.departamento.toLowerCase()}
                      </Link>
                    </>
                  )}
                  {produto.grupo && (
                    <>
                      <span>/</span>
                      <Link
                        href={montarUrlFiltro(baseParams, {
                          dep: produto.departamento || undefined,
                          grupo: produto.grupo,
                        })}
                      >
                        {produto.grupo.toLowerCase()}
                      </Link>
                    </>
                  )}
                  <span>/</span>
                  <span className={styles.breadcrumbAtual}>Ref. {produto.referencia}</span>
                </nav>

                <GaleriaProduto pecas={[produtoParaPeca(produto)]} r2BaseUrl={r2BaseUrl} />

                {conjuntos.length > 0 && (
                  <section className={styles.similares}>
                    <h2 className={styles.tituloSimilares}>
                      {conjuntos.length > 1 ? 'Também vendido nestes conjuntos' : 'Também vendido em conjunto'}
                    </h2>
                    <div className={styles.gridSimilares}>
                      {conjuntos.map(({ conjunto, pecas }) => (
                        <CardProduto
                          key={conjunto.id}
                          produto={pecas[0]}
                          conjunto={pecas}
                          conjuntoInfo={conjunto}
                          r2BaseUrl={r2BaseUrl}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {similares.length > 0 && (
                  <section className={styles.similares}>
                    <h2 className={styles.tituloSimilares}>Peças semelhantes</h2>
                    <div className={styles.gridSimilares}>
                      {similares.map(({ produto: p, meta }) => (
                        <CardProduto key={p.referencia} produto={p} r2BaseUrl={r2BaseUrl} meta={meta} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
