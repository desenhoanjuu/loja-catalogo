import Link from 'next/link'
import styles from '../Vitrine.module.css'
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
}

function GrupoFiltro({ titulo, opcoes, chave, params, extra }: GrupoProps) {
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
              <span>{valor.toLowerCase()}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function FiltrosLaterais({ marca, estrutura, params, temFiltroAtivo, className }: Props) {
  const { mapaMenus, departamentos, colecoes, campanhas, tipos } = estrutura

  const grupos = params.dep
    ? mapaMenus[params.dep] || []
    : Array.from(new Set(Object.values(mapaMenus).flat())).sort()

  return (
    <aside className={`${styles.sidebarFiltros} ${className || ''}`}>
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
      <GrupoFiltro titulo="Tipo de Peça" opcoes={tipos} chave="tipo" params={params} />
    </aside>
  )
}
