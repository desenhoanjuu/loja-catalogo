import Link from 'next/link'
import GaleriaProduto, { Peca } from './GaleriaProduto'
import CabecalhoLoja from '../../componentes/CabecalhoLoja'
import FiltrosLaterais from '../../componentes/FiltrosLaterais'
import CardProduto from '../../componentes/CardProduto'
import vitrine from '../../Vitrine.module.css'
import styles from './GaleriaProduto.module.css'
import {
  Params,
  Produto,
  supabase,
  buscarConjuntoDaReferencia,
  buscarSimilares,
  ehVisivelNoSite,
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

  const { data: encontrado } = await supabase
    .from('produtos')
    .select('*')
    .eq('referencia', referencia)
    .maybeSingle()

  // Referência não autorizada no painel (ou esgotada no ERP) não abre, nem pelo link direto
  const produto = ehVisivelNoSite(encontrado) ? encontrado : null

  // Se a referência faz parte de um conjunto, carrega as outras peças (na ordem do cadastro)
  let pecasProduto: Produto[] = produto ? [produto] : []
  if (produto) {
    const refsConjunto = await buscarConjuntoDaReferencia(produto.referencia)
    if (refsConjunto) {
      const { data: membros } = await supabase.from('produtos').select('*').in('referencia', refsConjunto)
      const porRef = new Map((membros || []).map((m) => [m.referencia, m]))
      const ordenadas = refsConjunto
        .map((r) => porRef.get(r))
        .filter((m): m is Produto => ehVisivelNoSite(m))
      if (ordenadas.length > 1) pecasProduto = ordenadas
    }
  }

  const pecas: Peca[] = pecasProduto.map((p) => ({
    referencia: p.referencia,
    descricao: p.descricao || `Referência ${p.referencia}`,
    marca: p.marca,
    tipoPeca: p.tipo_peca,
    grade: p.grade,
    composicao: p.composicao,
    fotosPorCor: p.fotos || {},
    caixasPorCor: p.caixas_por_cor || {},
    estoquePorCor: p.estoque_por_cor || {},
    corCapa: p.cor_capa || null,
    caixas: Array.isArray(p.caixas) ? p.caixas : null,
  }))

  // A aba ativa no cabeçalho é a marca do produto
  const marca = normalizarMarca(produto?.marca)
  const baseParams: Params = marca === 'TODOS' ? {} : { marca }

  const [estrutura, similares] = await Promise.all([
    carregarEstrutura(marca),
    produto ? buscarSimilares(produto, 8, pecasProduto.map((p) => p.referencia)) : Promise.resolve([]),
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

                <GaleriaProduto pecas={pecas} r2BaseUrl={r2BaseUrl} />

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
