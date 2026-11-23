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

  // Com uma categoria escolhida, o "Tipo de Peça" mostra só os tipos dela (ex.: vestido longo, midi, curto)
  const tiposVisiveis = params.cat
    ? tipos.filter((t) => (tiposPorCategoria[params.cat!] || []).some((x) => x.trim() === t))
    : tipos

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
      <GrupoFiltro
        titulo="Categoria"
        opcoes={categorias}
        chave="cat"
        params={params}
        manterCaixa
        extra={(valor, ativa) => ({ cat: ativa ? undefined : valor, tipo: undefined })}
      />
      <GrupoFiltro titulo="Tipo de Peça" opcoes={tiposVisiveis} chave="tipo" params={params} />
      </div>
    </aside>
  )
}
