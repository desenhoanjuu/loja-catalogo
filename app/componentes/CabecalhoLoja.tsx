import Link from 'next/link'
import styles from '../Vitrine.module.css'
import RolarMenuAtivo from './RolarMenuAtivo'
import {
  ABAS_MARCAS,
  EstruturaCatalogo,
  Params,
  montarUrlFiltro,
  urlDaMarca,
} from '../lib/catalogo'

interface Props {
  marca: string
  estrutura: EstruturaCatalogo
  params: Params
  menuTodasAtivo: boolean
}

export default function CabecalhoLoja({ marca, estrutura, params, menuTodasAtivo }: Props) {
  const ehTodos = marca === 'TODOS'
  const baseParamsAba: Params = ehTodos ? {} : { marca }
  const { mapaLogos, mapaMenus, departamentos, colecoes, campanhas } = estrutura

  return (
    <header className={styles.header}>
      <div className={styles.barraMarcas}>
        <div className={styles.containerMarcas}>
          <div className={styles.abasMarcas} id="abas-marcas">
            {ABAS_MARCAS.map((aba) => {
              const ativa = marca === aba
              const infoAba = mapaLogos[aba]
              return (
                <Link
                  key={aba}
                  href={urlDaMarca(aba)}
                  data-ativo={ativa ? 'true' : undefined}
                  className={`${styles.abaMarca} ${ativa ? styles.abaMarcaAtiva : ''}`}
                >
                  {aba !== 'TODOS' && infoAba?.logo_url ? (
                    <img src={infoAba.logo_url} alt={aba} className={styles.abaMarcaLogo} />
                  ) : (
                    <span>{aba}</span>
                  )}
                </Link>
              )
            })}
          </div>

          <form action="/" className={styles.formBusca}>
            {!ehTodos && <input type="hidden" name="marca" value={marca} />}
            <input
              type="text"
              name="q"
              defaultValue={params.q || ''}
              placeholder={ehTodos ? 'Buscar referência, peça ou coleção...' : `Buscar em ${marca}...`}
              className={styles.inputBusca}
            />
          </form>
        </div>
      </div>

      <nav className={styles.navBar}>
        <div className={styles.navContainer} id="menu-departamentos">
          <div className={styles.menuItem}>
            <Link
              href={urlDaMarca(marca)}
              data-ativo={menuTodasAtivo ? 'true' : undefined}
              className={`${styles.menuLink} ${menuTodasAtivo ? styles.menuLinkAtivo : ''}`}
            >
              {ehTodos ? 'Todas as Peças' : `Tudo de ${marca}`}
            </Link>
          </div>

          {(colecoes.length > 0 || campanhas.length > 0) && (
            <div className={styles.menuItem}>
              <span
                className={`${styles.menuLink} ${styles.menuLinkDestaque} ${
                  params.colecao || params.campanha ? styles.menuLinkAtivo : ''
                }`}
                style={{ cursor: 'pointer' }}
                data-ativo={params.colecao || params.campanha ? 'true' : undefined}
                tabIndex={0}
              >
                Coleções & Campanhas ▾
              </span>

              <div className={styles.submenuDropdown}>
                {campanhas.length > 0 && (
                  <>
                    <div className={styles.submenuHeader}>Campanhas</div>
                    {campanhas.map((camp) => (
                      <Link
                        key={camp}
                        href={montarUrlFiltro(baseParamsAba, { campanha: camp })}
                        className={styles.submenuLink}
                      >
                        {camp.toLowerCase()}
                      </Link>
                    ))}
                  </>
                )}

                {colecoes.length > 0 && (
                  <>
                    <div className={styles.submenuHeader}>Coleções</div>
                    {colecoes.map((col) => (
                      <Link
                        key={col}
                        href={montarUrlFiltro(baseParamsAba, { colecao: col })}
                        className={styles.submenuLink}
                      >
                        {col.toLowerCase()}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {departamentos.map((dep) => {
            const submenus = mapaMenus[dep] || []
            const ativo = params.dep === dep
            return (
              <div key={dep} className={styles.menuItem}>
                <Link
                  href={montarUrlFiltro(baseParamsAba, { dep })}
                  data-ativo={ativo ? 'true' : undefined}
                  className={`${styles.menuLink} ${ativo ? styles.menuLinkAtivo : ''}`}
                >
                  {dep.toLowerCase()}
                </Link>

                {submenus.length > 0 && (
                  <div className={styles.submenuDropdown}>
                    {submenus.map((grp) => (
                      <Link
                        key={grp}
                        href={montarUrlFiltro(baseParamsAba, { dep, grupo: grp })}
                        className={styles.submenuLink}
                      >
                        {grp.toLowerCase()}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>
      <RolarMenuAtivo ids={['menu-departamentos', 'abas-marcas']} />
    </header>
  )
}
