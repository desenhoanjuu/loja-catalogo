import Link from 'next/link'
import GaleriaProduto from '../../produto/[referencia]/GaleriaProduto'
import CabecalhoLoja from '../../componentes/CabecalhoLoja'
import FiltrosLaterais from '../../componentes/FiltrosLaterais'
import CardProduto from '../../componentes/CardProduto'
import vitrine from '../../Vitrine.module.css'
import styles from '../../produto/[referencia]/GaleriaProduto.module.css'
import {
  Params,
  buscarConjunto,
  buscarSimilares,
  coresEmComum,
  carregarEstrutura,
  normalizarMarca,
  pecasDoConjunto,
  rotuloPeca,
  urlFotoConjunto,
} from '../../lib/catalogo'
import { produtoParaPeca } from '../../lib/pecas'
import { contextoPreco } from '../../lib/precos'

export const revalidate = 0

// Página do conjunto: fotos das peças juntas, descrição de cada peça e caixas/estoque de cada uma
export default async function PaginaConjunto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const conjunto = await buscarConjunto(id)
  const pecas = conjunto ? await pecasDoConjunto(conjunto) : []
  const ctxPreco = await contextoPreco()
  const disponivel = !!conjunto && pecas.length > 1 && coresEmComum(pecas)

  const marca = normalizarMarca(pecas[0]?.marca)
  const baseParams: Params = marca === 'TODOS' ? {} : { marca }

  const [estrutura, similares] = await Promise.all([
    carregarEstrutura(marca),
    disponivel ? buscarSimilares(pecas[0], 8, pecas.map((p) => p.referencia)) : Promise.resolve([]),
  ])

  const fotosConjunto = disponivel
    ? conjunto!.fotos.map((f) => ({ url: urlFotoConjunto(r2BaseUrl, conjunto!.id, f.arquivo), cor: f.cor || null }))
    : []

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
            {!disponivel ? (
              <div className={vitrine.vazio}>
                Este conjunto não está disponível no catálogo.{' '}
                <Link href="/" className={vitrine.limparFiltro}>
                  Voltar ao catálogo
                </Link>
              </div>
            ) : (
              <>
                <nav className={styles.breadcrumb} aria-label="Caminho">
                  <Link href="/">Home</Link>
                  <span>/</span>
                  <Link href="/#conjuntos">Conjuntos</Link>
                  <span>/</span>
                  <span className={styles.breadcrumbAtual}>{pecas.map(rotuloPeca).join(' + ')}</span>
                </nav>

                <GaleriaProduto
                  pecas={pecas.map((p) => produtoParaPeca(p, ctxPreco))}
                  r2BaseUrl={r2BaseUrl}
                  fotosConjunto={fotosConjunto}
                />

                <section className={styles.similares}>
                  <h2 className={styles.tituloSimilares}>Peças do conjunto</h2>
                  <div className={styles.gridSimilares}>
                    {pecas.map((p) => (
                      <CardProduto key={p.referencia} produto={p} r2BaseUrl={r2BaseUrl} />
                    ))}
                  </div>
                </section>

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
