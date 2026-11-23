import Link from 'next/link'
import styles from '../Vitrine.module.css'
import arvore from './FiltroTipos.module.css'
import { EstruturaCatalogo, Params, montarUrlFiltro, urlDaMarca } from '../lib/catalogo'

interface Props {
  marca: string
  estrutura: EstruturaCatalogo
  params: Params // filtros ativos na URL (na página do produto vai só a marca)
  temFiltroAtivo: boolean
  className?: string
}

interface GrupoProps {
  titulo: string
  opcoes: string[]
  chave: string
  params: Params
  extra?: (valor: string, ativa: boolean) => Params
  manterCaixa?: boolean // mostra o texto como está (ex.: "Cardigãs e Kimonos")
}

function GrupoFiltro({ titulo, opcoes, chave, params, extra, manterCaixa }: GrupoProps) {
  if (opcoes.length === 0) return null
  return (
    <div className={styles.grupoFiltro}>
      <p className={styles.tituloGrupoFiltro}>{titulo}</p>
      <div className={styles.listaOpcoesFiltro}>
        {opcoes.map((valor) => {
          const ativa = params[chave] === valor
          const alteracoes = extra ? extra(valor, ativa) : { [chave]: ativa ? undefined : valor }
          return (
            <Link
              key={valor}
              href={montarUrlFiltro(params, alteracoes)}
              className={`${styles.opcaoFiltro} ${ativa ? styles.opcaoFiltroAtiva : ''}`}
            >
              <span style={manterCaixa ? { textTransform: 'none' } : undefined}>
                {manterCaixa ? valor : valor.toLowerCase()}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function FiltrosLaterais({ marca, estrutura, params, temFiltroAtivo, className }: Props) {
  const { mapaMenus, departamentos, colecoes, campanhas, tipos, categorias, tiposPorCategoria } = estrutura

  // Tipos de peça de cada categoria (ex.: Blusas -> blusa alça fina, blusa alça larga...)
  const tiposDe = (categoria: string) =>
    tipos.filter((t) => (tiposPorCategoria[categoria] || []).some((x) => x.trim() === t))

  const grupos = params.dep
    ? mapaMenus[params.dep] || []
    : Array.from(new Set(Object.values(mapaMenus).flat())).sort()

  return (
    <aside className={`${styles.sidebarFiltros} ${className || ''}`}>
      {/* No celular, os filtros ficam fechados atrás deste botão (no computador, sempre abertos) */}
      <input type="checkbox" id="abrir-filtros" className={styles.toggleFiltros} />
      <label htmlFor="abrir-filtros" className={styles.botaoFiltros}>
        <span>Filtros</span>
        {temFiltroAtivo && <span className={styles.avisoFiltrosAtivos}>filtros ativos</span>}
      </label>

      <div className={styles.corpoFiltros}>
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitulo}>
          {marca === 'TODOS' ? 'Filtros • Todos' : `Filtros • ${marca}`}
        </h2>
        {temFiltroAtivo && (
          <Link href={urlDaMarca(marca)} className={styles.limparFiltro}>
            Limpar
          </Link>
        )}
      </div>

      <div className={styles.grupoFiltro}>
        <p className={styles.tituloGrupoFiltro}>Disponibilidade</p>
        <div className={styles.listaOpcoesFiltro}>
          <Link
            href={montarUrlFiltro(params, { pe: params.pe === '1' ? undefined : '1' })}
            className={`${styles.opcaoFiltro} ${params.pe === '1' ? styles.opcaoFiltroAtiva : ''}`}
          >
            <span>Pronta Entrega</span>
          </Link>
          <Link
            href={montarUrlFiltro(params, { prog: params.prog === '1' ? undefined : '1' })}
            className={`${styles.opcaoFiltro} ${params.prog === '1' ? styles.opcaoFiltroAtiva : ''}`}
          >
            <span>Programação</span>
          </Link>
        </div>
      </div>

      <GrupoFiltro titulo="Campanha" opcoes={campanhas} chave="campanha" params={params} />
      <GrupoFiltro titulo="Coleção" opcoes={colecoes} chave="colecao" params={params} />
      <GrupoFiltro
        titulo="Departamento"
        opcoes={departamentos}
        chave="dep"
        params={params}
        extra={(valor, ativa) => ({
          dep: ativa ? undefined : valor,
          grupo: ativa ? undefined : params.grupo,
        })}
      />
      <GrupoFiltro titulo="Grupo" opcoes={grupos} chave="grupo" params={params} />
      {categorias.length > 0 && (
        <div className={styles.grupoFiltro}>
          <p className={styles.tituloGrupoFiltro}>Tipo de Peça</p>
          {/* Em árvore: o nome da categoria mostra todas as peças dela; a seta abre os tipos */}
          <div className={arvore.arvore}>
            {categorias.map((categoria) => {
              const ativa = params.cat === categoria
              const subtipos = tiposDe(categoria)
              const linkCategoria = (
                <Link
                  href={montarUrlFiltro(params, { cat: ativa ? undefined : categoria, tipo: undefined })}
                  className={`${styles.opcaoFiltro} ${arvore.opcao} ${ativa && !params.tipo ? styles.opcaoFiltroAtiva : ''}`}
                >
                  <span className={arvore.textoCategoria}>{categoria}</span>
                </Link>
              )
              if (subtipos.length <= 1) {
                return (
                  <div key={categoria} className={arvore.linhaSimples}>
                    {linkCategoria}
                  </div>
                )
              }
              return (
                <details key={categoria} className={arvore.categoria} open={ativa}>
                  <summary className={arvore.resumo}>
                    {linkCategoria}
                    <span className={arvore.seta} aria-label={`Ver tipos de ${categoria}`} />
                  </summary>
                  <div className={arvore.subtipos}>
                    {subtipos.map((tipo) => {
                      const tipoAtivo = ativa && params.tipo === tipo
                      return (
                        <Link
                          key={tipo}
                          href={montarUrlFiltro(params, { cat: categoria, tipo: tipoAtivo ? undefined : tipo })}
                          className={`${styles.opcaoFiltro} ${arvore.opcao} ${tipoAtivo ? styles.opcaoFiltroAtiva : ''}`}
                        >
                          <span>{tipo.toLowerCase()}</span>
                        </Link>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}
      </div>
    </aside>
  )
}
