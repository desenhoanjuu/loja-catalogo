'use client'

import { useState } from 'react'
import styles from './GaleriaProduto.module.css'

interface GaleriaProps {
  referencia: string
  descricao: string
  marca: string
  tipoPeca?: string | null
  grade?: string | null
  composicao?: string | null
  fotosPorCor: Record<string, string[]>
  caixasPorCor: Record<string, string>
  estoquePorCor: Record<string, number>
  r2BaseUrl: string
}

interface CorExibida {
  chave: string
  nome: string
  caixa: string | null
  estoque: number | null // null = sem dado da API (produto ainda não sincronizado)
  fotos: string[]
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

function ordenarFotos(arquivos: string[]): string[] {
  const peso = (nome: string) => {
    const lower = nome.toLowerCase()
    if (lower.startsWith('frente_')) return 0
    if (lower.startsWith('costas_')) return 1
    if (lower.includes('_')) return 2
    return 3
  }
  return [...arquivos].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b))
}

function formatarNome(texto: string) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Encontra a pasta de fotos que corresponde à cor da API
// 1º tenta igualdade exata ("BEGE CLARO" = "Bege Claro"), depois prefixo ("PRETO" ~ "Preto-black")
function acharPastaDaCor(corApi: string, pastas: string[]): string | null {
  const alvo = normalizar(corApi)
  if (!alvo) return null
  const exata = pastas.find((p) => normalizar(p) === alvo)
  if (exata) return exata
  const parecida = pastas.find((p) => {
    const n = normalizar(p)
    return n.startsWith(alvo) || alvo.startsWith(n)
  })
  return parecida || null
}

function montarCores(
  fotosPorCor: Record<string, string[]>,
  caixasPorCor: Record<string, string>,
  estoquePorCor: Record<string, number>
): CorExibida[] {
  const pastasDeCor = Object.keys(fotosPorCor || {}).filter((p) => !ehPastaDeAngulo(p))

  // Cores que existem na API (exceto caixas LO)
  const coresApi = Array.from(
    new Set([...Object.keys(caixasPorCor || {}), ...Object.keys(estoquePorCor || {})])
  ).filter((cor) => !ehCaixaLO(caixasPorCor?.[cor]))

  if (coresApi.length > 0) {
    const cores = coresApi.map((cor) => {
      const pasta = acharPastaDaCor(cor, pastasDeCor)
      return {
        chave: cor,
        nome: formatarNome(cor),
        caixa: caixasPorCor?.[cor] ?? null,
        estoque: estoquePorCor?.[cor] ?? 0,
        fotos: pasta ? ordenarFotos(fotosPorCor[pasta] || []) : [],
      }
    })
    // Cores com estoque primeiro, mantendo a ordem da API entre elas
    return cores.sort((a, b) => Number((b.estoque ?? 0) > 0) - Number((a.estoque ?? 0) > 0))
  }

  // Produto ainda sem dados da API: usa as pastas de fotos (sem ângulos)
  return pastasDeCor.map((pasta) => ({
    chave: pasta,
    nome: formatarNome(pasta),
    caixa: null,
    estoque: null,
    fotos: ordenarFotos(fotosPorCor[pasta] || []),
  }))
}

export default function GaleriaProduto({
  referencia,
  descricao,
  marca,
  tipoPeca,
  grade,
  composicao,
  fotosPorCor,
  caixasPorCor,
  estoquePorCor,
  r2BaseUrl,
}: GaleriaProps) {
  const cores = montarCores(fotosPorCor, caixasPorCor, estoquePorCor)

  const corInicial =
    cores.find((c) => c.fotos.length > 0 && (c.estoque ?? 0) > 0) ||
    cores.find((c) => c.fotos.length > 0) ||
    cores[0]

  const [chaveSelecionada, setChaveSelecionada] = useState<string | null>(corInicial?.chave ?? null)
  const [indiceFoto, setIndiceFoto] = useState(0)

  const corAtual = cores.find((c) => c.chave === chaveSelecionada) || null
  const fotosDaCorAtual = corAtual?.fotos ?? []

  const montarUrlFoto = (arquivo: string) =>
    `${r2BaseUrl}/${referencia}/${encodeURIComponent(arquivo)}`

  const fotoPrincipal =
    fotosDaCorAtual.length > 0
      ? montarUrlFoto(fotosDaCorAtual[indiceFoto] || fotosDaCorAtual[0])
      : null

  const trocarCor = (chave: string) => {
    setChaveSelecionada(chave)
    setIndiceFoto(0)
  }

  const fotoAnterior = () => {
    if (fotosDaCorAtual.length <= 1) return
    setIndiceFoto((prev) => (prev === 0 ? fotosDaCorAtual.length - 1 : prev - 1))
  }

  const proximaFoto = () => {
    if (fotosDaCorAtual.length <= 1) return
    setIndiceFoto((prev) => (prev === fotosDaCorAtual.length - 1 ? 0 : prev + 1))
  }

  const subtituloExibicao = tipoPeca ? formatarNome(tipoPeca) : 'Produto'

  return (
    <div className={styles.gridProduto}>
      {/* COLUNA 1: Miniaturas da cor selecionada */}
      <div className={styles.colunaMiniaturas}>
        {fotosDaCorAtual.length > 1 && (
          <button type="button" onClick={fotoAnterior} className={styles.setaVertical} aria-label="Foto anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
        )}
        <div className={styles.listaMiniaturas}>
          {fotosDaCorAtual.map((arquivo, idx) => (
            <button
              key={arquivo}
              type="button"
              onClick={() => setIndiceFoto(idx)}
              className={`${styles.btnMiniatura} ${idx === indiceFoto ? styles.btnMiniaturaAtiva : ''}`}
              aria-label={`Ver foto ${idx + 1}`}
            >
              <img src={montarUrlFoto(arquivo)} alt="" className={styles.imgMiniatura} />
            </button>
          ))}
        </div>
        {fotosDaCorAtual.length > 1 && (
          <button type="button" onClick={proximaFoto} className={styles.setaVertical} aria-label="Próxima foto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
      </div>

      {/* COLUNA 2: Foto principal */}
      <div className={styles.colunaPrincipal}>
        <div className={styles.wrapperFotoPrincipal}>
          {fotosDaCorAtual.length > 1 && (
            <button type="button" onClick={fotoAnterior} className={`${styles.setaLateral} ${styles.setaEsquerda}`} aria-label="Foto anterior">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          {fotoPrincipal ? (
            <img src={fotoPrincipal} alt={`${descricao} - ${corAtual?.nome ?? ''}`} className={styles.imgPrincipal} />
          ) : (
            <span style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>Sem foto para esta cor</span>
          )}

          {fotosDaCorAtual.length > 1 && (
            <button type="button" onClick={proximaFoto} className={`${styles.setaLateral} ${styles.setaDireita}`} aria-label="Próxima foto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          {fotosDaCorAtual.length > 1 && (
            <div className={styles.indicadoresBase}>
              {fotosDaCorAtual.map((_, idx) => (
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
        {marca && <span className={styles.tagMarca}>{marca}</span>}

        <h1 className={styles.tituloProduto}>{descricao}</h1>
        <p className={styles.codigoRef}>Código: {referencia}</p>

        <div className={styles.boxDescricao}>
          <p className={styles.linhaResumoPeca}>
            {referencia} - {subtituloExibicao}
          </p>
          <p className={styles.linhaDetalhe}>
            <strong>Grade:</strong> {grade || 'Não informada'}
          </p>
          <p className={styles.linhaDetalhe}>
            <strong>Composição:</strong> {composicao || 'Não informada'}
          </p>
        </div>

        <hr className={styles.divisor} />

        {cores.length > 0 && (
          <div>
            <p className={styles.labelCor}>
              Cor: <strong>{corAtual?.nome}</strong>
            </p>

            <div className={styles.gridCores}>
              {cores.map((cor) => {
                const selecionada = cor.chave === chaveSelecionada
                const capa = cor.fotos[0]

                return (
                  <button
                    key={cor.chave}
                    type="button"
                    onClick={() => trocarCor(cor.chave)}
                    className={styles.itemCorBox}
                  >
                    <div className={styles.selosCaixaTopo}>
                      {(cor.estoque ?? 0) > 0 ? (
                        <span className={styles.seloPE}>P.E.</span>
                      ) : (
                        <span className={styles.seloVazio}></span>
                      )}
                    </div>

                    <span className={styles.nomeCaixaTopo}>{cor.caixa ? `CX-${cor.caixa}` : '\u00A0'}</span>

                    <div className={`${styles.thumbCor} ${selecionada ? styles.thumbCorAtiva : ''}`}>
                      {capa ? (
                        <img src={montarUrlFoto(capa)} alt={cor.nome} className={styles.imgCor} />
                      ) : (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            fontSize: '11px',
                            color: 'var(--ink-muted)',
                          }}
                        >
                          Sem foto
                        </span>
                      )}
                    </div>

                    <span className={`${styles.nomeCor} ${selecionada ? styles.nomeCorAtiva : ''}`}>
                      {cor.nome}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {corAtual && corAtual.estoque !== null && (
          <div className={styles.boxDisponibilidade}>
            <span>
              Disponibilidade: <strong>{corAtual.nome} {corAtual.caixa ? `(CX-${corAtual.caixa})` : ''}</strong>
            </span>
            <span className={corAtual.estoque > 0 ? styles.badgeEstoque : styles.badgeEsgotado}>
              {corAtual.estoque > 0 ? `${corAtual.estoque} cxs.` : 'Esgotado'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
