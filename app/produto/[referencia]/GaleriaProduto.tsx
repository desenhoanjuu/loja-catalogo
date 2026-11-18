'use client'

import { useState } from 'react'
import styles from './GaleriaProduto.module.css'

// Uma peça do produto. Produto simples = 1 peça; conjunto = 2 ou mais.
export interface Peca {
  referencia: string
  descricao: string
  marca: string
  tipoPeca?: string | null
  grade?: string | null
  composicao?: string | null
  fotosPorCor: Record<string, string[]>
  caixasPorCor: Record<string, string>
  estoquePorCor: Record<string, number>
  corCapa?: string | null // cor escolhida no painel para a vitrine (abre a página nela)
  caixas?: Caixa[] | null // caixas reais do ERP (uma caixa pode ter mais de uma cor)
}

// Uma caixa do ERP, ex.: CX-22D com Print 416-1 + Print 416-2
export interface Caixa {
  caixa: string // letra: A, B, C...
  pecas: number // peças por caixa
  cores: string[]
  estoque: number
  esgotada: boolean
}

interface GaleriaProps {
  pecas: Peca[]
  r2BaseUrl: string
}

interface InfoPecaNaCor {
  caixa: string | null
  estoque: number
}

// Uma opção do seletor: uma caixa (modo novo) ou uma cor (dados antigos)
interface CorExibida {
  chave: string
  nome: string
  fotos: string[] // URLs completas
  capas: string[] // miniatura de cada cor da caixa (2 cores = miniatura dividida)
  cores: string[] // cores normalizadas, para achar a cor escolhida no painel
  pecasPorCaixa?: number
  porPeca: Record<string, InfoPecaNaCor> // vazio = sem dado da API (produto ainda não sincronizado)
}

// Pastas do R2 que são ângulos de foto, e não cores
const PASTAS_QUE_NAO_SAO_COR = ['costas', 'modelo', 'modelos', 'frente', 'detalhe', 'detalhes', 'padrao']

function normalizar(texto: string) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function ehPastaDeAngulo(nomePasta: string) {
  const n = normalizar(nomePasta)
  return PASTAS_QUE_NAO_SAO_COR.some((p) => n.includes(p))
}

// Caixas LO (sortidas) são ignoradas no site
function ehCaixaLO(caixa: string | null | undefined) {
  return !!caixa && /LO$/i.test(caixa.trim())
}

// 0 = frente, 1 = costas, 2 = outra foto com modelo, 3 = amostra de cor (vai por último)
const OUTROS_ANGULOS = ['detalhe', 'detalhes', 'lateral', 'lado', 'zoom', 'modelo', 'modelos']

function tipoDaFoto(arquivo: string): number {
  const tokens = arquivo
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[_\-\s]+/)
    .filter(Boolean)
  if (tokens.includes('frente')) return 0
  if (tokens.includes('costas') || tokens.includes('verso')) return 1
  if (tokens.some((t) => OUTROS_ANGULOS.includes(t) || /^\d+$/.test(t))) return 2
  return 3
}

function ordenarFotos(arquivos: string[]): string[] {
  return [...arquivos].sort((a, b) => tipoDaFoto(a) - tipoDaFoto(b) || (a < b ? -1 : a > b ? 1 : 0))
}

const CORES_NEUTRAS = ['preto', 'black', 'branco', 'white', 'offwhite']

function ehCorNeutra(nome: string) {
  const n = normalizar(nome)
  return CORES_NEUTRAS.some((c) => n.includes(c))
}

function formatarNome(texto: string | null | undefined) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function rotuloCurto(peca: Peca) {
  const tipo = String(peca.tipoPeca || '').trim().split(' ')[0]
  return `${formatarNome(tipo) || 'Peça'} ${peca.referencia}`
}

// 1º igualdade exata ("BEGE CLARO" = "Bege Claro"), depois prefixo ("PRETO" ~ "Preto-black")
function acharPastaDaCor(corApi: string, pastas: string[]): string | null {
  const alvo = normalizar(corApi)
  if (!alvo) return null
  const exata = pastas.find((p) => normalizar(p) === alvo)
  if (exata) return exata
  const parecida = pastas.find((p) => {
    const n = normalizar(p)
    return n.startsWith(alvo) || alvo.startsWith(n)
  })
  if (parecida) return parecida
  // Ex.: pasta "416-1" para a cor "PRINT:416-1"
  const final = pastas.find((p) => {
    const n = normalizar(p)
    return n.length >= 3 && (alvo.endsWith(n) || n.endsWith(alvo))
  })
  return final || null
}

function montarCores(pecas: Peca[], r2BaseUrl: string): CorExibida[] {
  const url = (ref: string, arquivo: string) => `${r2BaseUrl}/${ref}/${encodeURIComponent(arquivo)}`

  const pastasPorPeca = pecas.map((p) => {
    const fotos = p.fotosPorCor || {}
    return {
      ref: p.referencia,
      fotos,
      pastas: Object.keys(fotos).filter((k) => !ehPastaDeAngulo(k) && (fotos[k]?.length ?? 0) > 0),
    }
  })

  // Procura as fotos da cor em cada peça, na ordem (no conjunto a foto costuma estar numa só)
  const fotosDaCor = (nomeCor: string): string[] => {
    for (const pp of pastasPorPeca) {
      const pasta = acharPastaDaCor(nomeCor, pp.pastas)
      if (pasta) return ordenarFotos(pp.fotos[pasta]).map((a) => url(pp.ref, a))
    }
    return []
  }

  const mapa = new Map<string, CorExibida>()

  pecas.forEach((p) => {
    const caixas = p.caixasPorCor || {}
    const estoques = p.estoquePorCor || {}
    const coresApi = Array.from(new Set([...Object.keys(caixas), ...Object.keys(estoques)])).filter(
      (cor) => !ehCaixaLO(caixas[cor])
    )

    coresApi.forEach((cor) => {
      const chave = normalizar(cor)
      if (!chave) return
      let item = mapa.get(chave)
      if (!item) {
        const fotosCor = fotosDaCor(cor)
        item = { chave, nome: formatarNome(cor), fotos: fotosCor, capas: fotosCor.slice(0, 1), cores: [chave], porPeca: {} }
        mapa.set(chave, item)
      }
      item.porPeca[p.referencia] = { caixa: caixas[cor] ?? null, estoque: estoques[cor] ?? 0 }
    })
  })

  if (mapa.size > 0) {
    const temEstoque = (c: CorExibida) => Object.values(c.porPeca).some((i) => i.estoque > 0)
    return Array.from(mapa.values()).sort((a, b) => Number(temEstoque(b)) - Number(temEstoque(a)))
  }

  // Ainda sem dados da API: usa as pastas de fotos (sem ângulos)
  const porPasta = new Map<string, CorExibida>()
  pastasPorPeca.forEach((pp) =>
    pp.pastas.forEach((pasta) => {
      const chave = normalizar(pasta)
      if (porPasta.has(chave)) return
      const fotosPasta = ordenarFotos(pp.fotos[pasta]).map((a) => url(pp.ref, a))
      porPasta.set(chave, {
        chave,
        nome: formatarNome(pasta),
        fotos: fotosPasta,
        capas: fotosPasta.slice(0, 1),
        cores: [chave],
        porPeca: {},
      })
    })
  )
  return Array.from(porPasta.values())
}

// Modo caixas: cada opção é uma caixa do ERP. No conjunto, caixas com a mesma letra se juntam
// (ex.: Caixa A da blusa + Caixa A da calça).
function montarCaixas(pecas: Peca[], r2BaseUrl: string): CorExibida[] {
  const url = (ref: string, arquivo: string) => `${r2BaseUrl}/${ref}/${encodeURIComponent(arquivo)}`
  const ehConjunto = pecas.length > 1

  const pastasPorPeca = pecas.map((p) => {
    const fotos = p.fotosPorCor || {}
    return {
      ref: p.referencia,
      fotos,
      pastas: Object.keys(fotos).filter((k) => !ehPastaDeAngulo(k) && (fotos[k]?.length ?? 0) > 0),
    }
  })
  const fotosDaCor = (nomeCor: string): string[] => {
    for (const pp of pastasPorPeca) {
      const pasta = acharPastaDaCor(nomeCor, pp.pastas)
      if (pasta) return ordenarFotos(pp.fotos[pasta]).map((a) => url(pp.ref, a))
    }
    return []
  }

  const montar = (incluirEsgotadas: boolean) => {
    const mapa = new Map<string, CorExibida>()
    pecas.forEach((p) =>
      (p.caixas || [])
        .filter((cx) => incluirEsgotadas || !cx.esgotada || cx.estoque > 0)
        .forEach((cx) => {
          const id = `${cx.pecas}${cx.caixa}`
          const chave = ehConjunto ? normalizar(cx.caixa) : normalizar(id)
          let item = mapa.get(chave)
          if (!item) {
            const fotosPorCor = cx.cores.map((c) => fotosDaCor(c))
            item = {
              chave,
              nome: cx.cores.map((c) => formatarNome(c)).join(' + ') || `Caixa ${cx.caixa}`,
              fotos: Array.from(new Set(fotosPorCor.flat())),
              capas: fotosPorCor.map((f) => f[0]).filter(Boolean),
              cores: cx.cores.map((c) => normalizar(c)),
              pecasPorCaixa: cx.pecas,
              porPeca: {},
            }
            mapa.set(chave, item)
          }
          item.porPeca[p.referencia] = { caixa: id, estoque: cx.estoque }
        })
    )
    return Array.from(mapa.values())
  }

  // Caixas esgotadas no ERP ficam de fora; se todas estiverem esgotadas, mostra todas como "Esgotado"
  const disponiveis = montar(false)
  return disponiveis.length > 0 ? disponiveis : montar(true)
}

export default function GaleriaProduto({ pecas, r2BaseUrl }: GaleriaProps) {
  const principal = pecas[0]
  const ehConjunto = pecas.length > 1
  const modoCaixas = pecas.some((p) => Array.isArray(p.caixas) && p.caixas.length > 0)
  const cores = modoCaixas ? montarCaixas(pecas, r2BaseUrl) : montarCores(pecas, r2BaseUrl)

  const temEstoque = (c: CorExibida) => Object.values(c.porPeca).some((i) => i.estoque > 0)
  const temCorNeutra = (c: CorExibida) => c.cores.length > 0 && c.cores.every((x) => ehCorNeutra(x))
  const combina = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)

  // Abre na cor escolhida no painel; senão, numa opção com foto e estoque, evitando preto/branco
  const corDoPainel = pecas.map((p) => (p.corCapa ? normalizar(p.corCapa) : '')).find(Boolean) || ''
  const corInicial =
    (corDoPainel && cores.find((c) => temEstoque(c) && c.cores.some((x) => combina(x, corDoPainel)))) ||
    (corDoPainel && cores.find((c) => c.cores.some((x) => combina(x, corDoPainel)))) ||
    cores.find((c) => c.fotos.length > 0 && temEstoque(c) && !temCorNeutra(c)) ||
    cores.find((c) => c.fotos.length > 0 && temEstoque(c)) ||
    cores.find((c) => c.fotos.length > 0 && !temCorNeutra(c)) ||
    cores.find((c) => c.fotos.length > 0) ||
    cores[0]

  const [chaveSelecionada, setChaveSelecionada] = useState<string | null>(corInicial?.chave ?? null)
  const [indiceFoto, setIndiceFoto] = useState(0)

  const corAtual = cores.find((c) => c.chave === chaveSelecionada) || null
  const fotos = corAtual?.fotos ?? []
  const fotoPrincipal = fotos.length > 0 ? fotos[indiceFoto] || fotos[0] : null
  // Amostra de cor (foto quadrada do tecido): preenche o quadro inteiro em vez de ficar com sobra
  const nomeArquivo = (url: string) => decodeURIComponent(url.split('/').pop() || '')
  const ehAmostra = !!fotoPrincipal && tipoDaFoto(nomeArquivo(fotoPrincipal)) === 3

  const tituloExibicao = ehConjunto
    ? `Conjunto ${pecas.map((p) => formatarNome(String(p.tipoPeca || '').split(' ')[0]) || 'Peça').join(' + ')}`
    : principal.descricao

  const trocarCor = (chave: string) => {
    setChaveSelecionada(chave)
    setIndiceFoto(0)
  }

  const fotoAnterior = () => {
    if (fotos.length <= 1) return
    setIndiceFoto((prev) => (prev === 0 ? fotos.length - 1 : prev - 1))
  }

  const proximaFoto = () => {
    if (fotos.length <= 1) return
    setIndiceFoto((prev) => (prev === fotos.length - 1 ? 0 : prev + 1))
  }

  const temDadosApi = !!corAtual && Object.keys(corAtual.porPeca).length > 0

  return (
    <div className={styles.gridProduto}>
      {/* COLUNA 1: Miniaturas da cor selecionada */}
      <div className={styles.colunaMiniaturas}>
        {fotos.length > 1 && (
          <button type="button" onClick={fotoAnterior} className={styles.setaVertical} aria-label="Foto anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
        )}
        <div className={styles.listaMiniaturas}>
          {fotos.map((foto, idx) => (
            <button
              key={foto}
              type="button"
              onClick={() => setIndiceFoto(idx)}
              className={`${styles.btnMiniatura} ${idx === indiceFoto ? styles.btnMiniaturaAtiva : ''}`}
              aria-label={`Ver foto ${idx + 1}`}
            >
              <img src={foto} alt="" className={styles.imgMiniatura} />
            </button>
          ))}
        </div>
        {fotos.length > 1 && (
          <button type="button" onClick={proximaFoto} className={styles.setaVertical} aria-label="Próxima foto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
      </div>

      {/* COLUNA 2: Foto principal */}
      <div className={styles.colunaPrincipal}>
        <div className={styles.wrapperFotoPrincipal}>
          {fotos.length > 1 && (
            <button type="button" onClick={fotoAnterior} className={`${styles.setaLateral} ${styles.setaEsquerda}`} aria-label="Foto anterior">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          {fotoPrincipal ? (
            <img src={fotoPrincipal} alt={`${tituloExibicao} - ${corAtual?.nome ?? ''}`} className={`${styles.imgPrincipal} ${ehAmostra ? styles.imgAmostra : ''}`} />
          ) : (
            <span style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>Sem foto para esta cor</span>
          )}

          {fotos.length > 1 && (
            <button type="button" onClick={proximaFoto} className={`${styles.setaLateral} ${styles.setaDireita}`} aria-label="Próxima foto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          {fotos.length > 1 && (
            <div className={styles.indicadoresBase}>
              {fotos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIndiceFoto(idx)}
                  className={`${styles.indicadorPonto} ${idx === indiceFoto ? styles.indicadorPontoAtivo : ''}`}
                  aria-label={`Ir para foto ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COLUNA 3: Informações */}
      <div className={styles.colunaInfo}>
        <div className={styles.linhaTags}>
          {principal.marca && <span className={styles.tagMarca}>{principal.marca}</span>}
          {ehConjunto && <span className={styles.tagConjunto}>Conjunto</span>}
        </div>

        <h1 className={styles.tituloProduto}>{tituloExibicao}</h1>
        <p className={styles.codigoRef}>
          {ehConjunto ? `Códigos: ${pecas.map((p) => p.referencia).join(' e ')}` : `Código: ${principal.referencia}`}
        </p>

        {ehConjunto ? (
          <div className={styles.listaPecasConjunto}>
            {pecas.map((p) => (
              <div key={p.referencia} className={styles.blocoPeca}>
                <p className={styles.linhaResumoPeca}>{rotuloCurto(p)}</p>
                <p className={styles.linhaDetalhe}>{p.descricao}</p>
                <p className={styles.linhaDetalhe}>
                  <strong>Grade:</strong> {p.grade || 'Não informada'}
                </p>
                <p className={styles.linhaDetalhe}>
                  <strong>Composição:</strong> {p.composicao || 'Não informada'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.boxDescricao}>
            <p className={styles.linhaResumoPeca}>
              {principal.referencia} - {principal.tipoPeca ? formatarNome(principal.tipoPeca) : 'Produto'}
            </p>
            <p className={styles.linhaDetalhe}>
              <strong>Grade:</strong> {principal.grade || 'Não informada'}
            </p>
            <p className={styles.linhaDetalhe}>
              <strong>Composição:</strong> {principal.composicao || 'Não informada'}
            </p>
          </div>
        )}

        <hr className={styles.divisor} />

        {cores.length > 0 && (
          <div>
            <p className={styles.labelCor}>
              {modoCaixas ? 'Caixa' : 'Cor'}: <strong>{corAtual?.nome}</strong>
              {modoCaixas && corAtual?.pecasPorCaixa ? ` · ${corAtual.pecasPorCaixa} peças por caixa` : ''}
            </p>

            <div className={styles.gridCores}>
              {cores.map((cor) => {
                const selecionada = cor.chave === chaveSelecionada
                const capas = cor.capas.length > 0 ? cor.capas.slice(0, 2) : cor.fotos.slice(0, 1)
                const caixa = Object.values(cor.porPeca).find((i) => i.caixa)?.caixa ?? null

                return (
                  <button key={cor.chave} type="button" onClick={() => trocarCor(cor.chave)} className={styles.itemCorBox}>
                    <div className={styles.selosCaixaTopo}>
                      {temEstoque(cor) ? <span className={styles.seloPE}>P.E.</span> : <span className={styles.seloVazio}></span>}
                    </div>

                    <span className={styles.nomeCaixaTopo}>{caixa ? `CX-${caixa}` : '\u00A0'}</span>

                    <div className={`${styles.thumbCor} ${selecionada ? styles.thumbCorAtiva : ''}`}>
                      {capas.length > 1 ? (
                        // Caixa com 2 cores: miniatura dividida ao meio
                        <div className={styles.thumbDividida}>
                          {capas.map((c) => (
                            <img key={c} src={c} alt="" className={styles.imgCor} />
                          ))}
                        </div>
                      ) : capas.length === 1 ? (
                        <img src={capas[0]} alt={cor.nome} className={styles.imgCor} />
                      ) : (
                        <span className={styles.semFotoCor}>Sem foto</span>
                      )}
                    </div>

                    <span className={`${styles.nomeCor} ${selecionada ? styles.nomeCorAtiva : ''}`}>{cor.nome}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {corAtual && temDadosApi && (
          <div className={styles.listaDisponibilidade}>
            {pecas.map((p) => {
              const info = corAtual.porPeca[p.referencia]
              const rotulo = ehConjunto ? `${rotuloCurto(p)} — ${corAtual.nome}` : corAtual.nome
              return (
                <div key={p.referencia} className={styles.boxDisponibilidade}>
                  <span>
                    Disponibilidade: <strong>{rotulo} {info?.caixa ? `(CX-${info.caixa})` : ''}</strong>
                  </span>
                  {!info ? (
                    <span className={styles.badgeEsgotado}>{modoCaixas ? 'Não tem esta caixa' : 'Não tem nesta cor'}</span>
                  ) : (
                    <span className={info.estoque > 0 ? styles.badgeEstoque : styles.badgeEsgotado}>
                      {info.estoque > 0 ? `${info.estoque} cxs.` : 'Esgotado'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
