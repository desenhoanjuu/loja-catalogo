import Link from 'next/link'
import styles from './Rodape.module.css'
import { supabase, urlDaMarca } from '../lib/catalogo'

const MARCAS = ['AISHTY', "WE'RE THE BASIC", 'VASPAC']
const ENDERECO_MAPA =
  'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('R. Mendes Gonçalves, 97 - Brás, São Paulo - SP, 03027-010')

// Rodapé de todas as páginas. As logos vêm do painel (aba Logos & Marcas);
// sem logo cadastrada, aparece o nome da marca.
export default async function Rodape() {
  const { data } = await supabase.from('marcas_config').select('chave, logo_url')
  const logos: Record<string, string | null> = {}
  data?.forEach((m) => {
    logos[String(m.chave).toUpperCase()] = m.logo_url
  })

  return (
    <footer className={styles.rodape}>
      <div className={styles.conteudo}>
        <nav className={styles.marcas} aria-label="Marcas">
          {MARCAS.map((marca, i) => (
            <span key={marca} className={styles.itemMarca}>
              {i > 0 && <span className={styles.separador} aria-hidden="true" />}
              <Link href={urlDaMarca(marca)} className={styles.linkMarca}>
                {logos[marca] ? (
                  <img src={logos[marca]!} alt={marca} className={styles.logoMarca} />
                ) : (
                  <span className={styles.nomeMarca}>{marca}</span>
                )}
              </Link>
            </span>
          ))}
        </nav>

        <div className={styles.colunas}>
          <address className={styles.showroom}>
            <span className={styles.tituloBloco}>Showroom</span>
            <span>R. Mendes Gonçalves, 97</span>
            <span>CEP 03.027-010</span>
            <span>Bairro Brás</span>
            <span>São Paulo - Brasil</span>
            <a href={ENDERECO_MAPA} target="_blank" rel="noopener noreferrer" className={styles.linkMapa}>
              Ver no mapa →
            </a>
          </address>

          <p className={styles.registro}>
            AISHTY® é uma marca registrada da ETHEREAL.
            <br />
            A ETHEREAL possui o registro de certificado da marca AISHTY junto ao INPI.
          </p>
        </div>
      </div>
    </footer>
  )
}
