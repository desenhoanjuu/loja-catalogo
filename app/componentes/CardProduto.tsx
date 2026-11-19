import Link from 'next/link'
import styles from '../Vitrine.module.css'
import local from './CardProduto.module.css'
import ImagemAjustavel from './ImagemAjustavel'
import { Conjunto, Produto, capaDoItem, normalizarTexto, pastasDeCor, rotuloPeca } from '../lib/catalogo'

interface Props {
  produto: Produto
  r2BaseUrl: string
  meta?: string // texto acima do título; padrão é "MARCA • Ref: 123"
  conjunto?: Produto[] // quando o card representa um conjunto (todas as peças, na ordem)
  conjuntoInfo?: Conjunto // cadastro do conjunto (fotos próprias e link da página do conjunto)
}

export default function CardProduto({ produto, r2BaseUrl, meta, conjunto, conjuntoInfo }: Props) {
  const ehConjunto = !!conjunto && conjunto.length > 1

  // Capa: cor escolhida no painel ou escolha automática (frente, evitando preto/branco)
  const { capa, hover, qualidade, peca: pecaComFoto } = capaDoItem(ehConjunto ? conjunto! : [produto], r2BaseUrl, ehConjunto ? conjuntoInfo : null)
  const totalCores = pastasDeCor(pecaComFoto.fotos).length
  const titulo = produto.descricao || `Referência ${produto.referencia}`
  const novidade = ehConjunto ? conjunto!.some((p) => p.novidade) : produto.novidade
  const colecao = ehConjunto ? conjunto![0].colecao : produto.colecao

  // Etiqueta da foto: campanha promocional tem prioridade sobre a coleção.
  // O campo campanha pode ter várias ("VERAO 2027, PROMOCIONAL"): mostra só a promocional.
  const campanhaPromocional = (ehConjunto ? conjunto! : [produto])
    .flatMap((p) => String(p.campanha || '').split(','))
    .map((c) => c.trim())
    .find((c) => normalizarTexto(c).includes('promo'))
  const etiqueta = campanhaPromocional || colecao

  return (
    <Link
      href={ehConjunto && conjuntoInfo ? `/conjunto/${conjuntoInfo.id}` : `/produto/${produto.referencia}`}
      className={styles.card}
    >
      {/* 4:5, a mesma proporção do recorte das fotos: a foto preenche o card sem cortar */}
      <div className={styles.cardImagemWrapper} style={{ aspectRatio: '4 / 5' }}>
        {capa ? (
          <>
            <ImagemAjustavel
              src={capa}
              alt={ehConjunto ? `Conjunto ${conjunto!.map(rotuloPeca).join(' e ')}` : titulo}
              className={`${styles.cardImagem} ${!hover ? styles.cardImagemUnica : ''}`}
              // Só amostra de cor: preenche o card em vez de ficar um quadrado com sobra
              style={qualidade === 3 ? { objectFit: 'cover', objectPosition: 'center' } : undefined}
            />
            {hover && <img src={hover} alt="" className={styles.cardImagemHover} />}
          </>
        ) : (
          <span className={styles.semFoto}>Sem imagem</span>
        )}

        {novidade && <span className={styles.badgeNovidade}>Novidade</span>}
        {etiqueta && <span className={styles.badgeColecao}>{etiqueta}</span>}
        {totalCores > 1 && <span className={styles.badgeCores}>{totalCores} cores</span>}
      </div>

      {ehConjunto ? (
        <>
          <p className={styles.cardMeta}>{meta ?? `Conjunto${produto.marca ? ` • ${produto.marca}` : ''}`}</p>
          <ul className={local.listaPecas}>
            {conjunto!.map((p) => {
              const temPE = (p.estoque_pe ?? 0) > 0
              return (
                <li key={p.referencia} className={local.linhaPeca}>
                  <span
                    className={`${local.ponto} ${temPE ? local.pontoPE : ''}`}
                    title={temPE ? 'Pronta entrega' : 'Sem estoque'}
                  />
                  {rotuloPeca(p)}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <p className={styles.cardMeta}>
            {meta ?? `${produto.marca ? `${produto.marca} • ` : ''}Ref: ${produto.referencia}`}
          </p>
          <h2 className={styles.cardTitulo}>{titulo}</h2>
        </>
      )}
    </Link>
  )
}
