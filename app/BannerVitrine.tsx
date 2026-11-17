'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './Vitrine.module.css'

export interface BannerItem {
  id: string
  marca?: string | null
  tag_campanha?: string | null
  titulo: string | null
  subtitulo: string | null
  botao_texto?: string | null
  imagem_url: string
  link_destino: string | null
}

export default function BannerVitrine({ banners }: { banners: BannerItem[] }) {
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    setIndice(0)
  }, [banners])

  useEffect(() => {
    if (banners.length <= 1 || pausado) return
    const timer = setInterval(() => {
      setIndice((prev) => (prev >= banners.length - 1 ? 0 : prev + 1))
    }, 5500)
    return () => clearInterval(timer)
  }, [banners.length, pausado])

  if (!banners || banners.length === 0) return null

  const indiceSeguro = indice >= banners.length ? 0 : indice
  const atual = banners[indiceSeguro]

  const anterior = () => {
    setIndice((prev) => (prev <= 0 ? banners.length - 1 : prev - 1))
  }

  const proximo = () => {
    setIndice((prev) => (prev >= banners.length - 1 ? 0 : prev + 1))
  }

  const temTexto = Boolean(atual.tag_campanha || atual.titulo || atual.subtitulo)

  const slideVisual = (
    <div className={styles.bannerSlide}>
      <img
        src={atual.imagem_url}
        alt={atual.titulo || atual.tag_campanha || 'Campanha'}
        className={styles.bannerImg}
      />

      {temTexto && (
        <div className={styles.bannerOverlay}>
          <div className={styles.bannerConteudo}>
            {atual.tag_campanha && (
              <span className={styles.bannerTag}>{atual.tag_campanha}</span>
            )}
            {atual.titulo && <h2 className={styles.bannerTitulo}>{atual.titulo}</h2>}
            {atual.subtitulo && <p className={styles.bannerSubtitulo}>{atual.subtitulo}</p>}
            {atual.link_destino && (
              <span className={styles.bannerBotao}>
                {atual.botao_texto || 'Explorar Coleção'} →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <section
      className={styles.bannerContainer}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className={styles.bannerFrame}>
        {atual.link_destino ? (
          <Link href={atual.link_destino} className={styles.bannerLink}>
            {slideVisual}
          </Link>
        ) : (
          slideVisual
        )}

        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              className={`${styles.bannerSeta} ${styles.bannerSetaEsq}`}
              aria-label="Slide anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={proximo}
              className={`${styles.bannerSeta} ${styles.bannerSetaDir}`}
              aria-label="Próximo slide"
            >
              ›
            </button>

            <div className={styles.bannerDots}>
              {banners.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setIndice(idx)}
                  className={`${styles.bannerDot} ${idx === indiceSeguro ? styles.bannerDotAtivo : ''}`}
                  aria-label={`Ir para campanha ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}