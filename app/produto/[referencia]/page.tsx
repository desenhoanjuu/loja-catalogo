import Link from 'next/link'
import GaleriaProduto from './GaleriaProduto'
import CabecalhoLoja from '../../componentes/CabecalhoLoja'
import FiltrosLaterais from '../../componentes/FiltrosLaterais'
import CardProduto from '../../componentes/CardProduto'
import vitrine from '../../Vitrine.module.css'
import styles from './GaleriaProduto.module.css'
import {
  Params,
  supabase,
  buscarSimilares,
  carregarEstrutura,
  montarUrlFiltro,
  normalizarMarca,
} from '../../lib/catalogo'

export const revalidate = 0

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ referencia: string }>
}) {
  const { referencia } = await params
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const { data: produto } = await supabase
    .from('produtos')
    .select('*')
    .eq('referencia', referencia)
    .single()

  // A aba ativa no cabeçalho é a marca do produto
  const marca = normalizarMarca(produto?.marca)
  const baseParams: Params = marca === 'TODOS' ? {} : { marca }

  const [estrutura, similares] = await Promise.all([
    carregarEstrutura(marca),
    produto ? buscarSimilares(produto) : Promise.resolve([]),
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
                Referência {referencia} não encontrada.{' '}
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

                <GaleriaProduto
                  referencia={produto.referencia}
                  descricao={produto.descricao || `Referência ${produto.referencia}`}
                  marca={produto.marca}
                  tipoPeca={produto.tipo_peca}
                  grade={produto.grade}
                  composicao={produto.composicao}
                  fotosPorCor={produto.fotos || {}}
                  caixasPorCor={produto.caixas_por_cor || {}}
                  estoquePorCor={produto.estoque_por_cor || {}}
                  r2BaseUrl={r2BaseUrl}
                />

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
