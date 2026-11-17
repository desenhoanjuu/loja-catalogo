import Link from 'next/link'
import styles from '../Vitrine.module.css'
import { Produto, obterFotosCard, pastasDeCor } from '../lib/catalogo'

interface Props {
  produto: Produto
  r2BaseUrl: string
  meta?: string // texto acima do título; padrão é "MARCA • Ref: 123"
}

export default function CardProduto({ produto, r2BaseUrl, meta }: Props) {
  const { capa, hover } = obterFotosCard(produto.fotos, produto.referencia, r2BaseUrl)
  const totalCores = pastasDeCor(produto.fotos).length
  const titulo = produto.descricao || `Referência ${produto.referencia}`

  return (
    <Link href={`/produto/${produto.referencia}`} className={styles.card}>
      <div className={styles.cardImagemWrapper}>
        {capa ? (
          <>
            <img
              src={capa}
              alt={titulo}
              className={`${styles.cardImagem} ${!hover ? styles.cardImagemUnica : ''}`}
            />
            {hover && <img src={hover} alt="" className={styles.cardImagemHover} />}
          </>
        ) : (
          <span className={styles.semFoto}>Sem imagem</span>
        )}

        {produto.novidade && <span className={styles.badgeNovidade}>Novidade</span>}
        {produto.colecao && <span className={styles.badgeColecao}>{produto.colecao}</span>}
        {totalCores > 1 && <span className={styles.badgeCores}>{totalCores} cores</span>}
      </div>

      <p className={styles.cardMeta}>
        {meta ?? `${produto.marca ? `${produto.marca} • ` : ''}Ref: ${produto.referencia}`}
      </p>
      <h2 className={styles.cardTitulo}>{titulo}</h2>
    </Link>
  )
}
