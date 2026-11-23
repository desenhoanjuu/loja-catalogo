'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './GaleriaProduto.module.css'
import ImagemAjustavel from '../../componentes/ImagemAjustavel'

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
  precoPeca?: number | null // preço por peça para quem está vendo (null = não mostra)
}

// Uma caixa do ERP, ex.: CX-22D com Print 416-1 + Print 416-2
export interface Caixa {
  caixa: string // letra: A, B, C...
  pecas: number // peças por caixa
  cores: string[]
  estoque: number
  esgotada: boolean
  programacao?: boolean // sem estoque físico ainda, com previsão de chegada
  previsao?: string | null
  preco?: number | null // preço por peça desta caixa para quem está vendo (null = não mostra)
}

interface GaleriaProps {
  pecas: Peca[]
  r2BaseUrl: string
  fotosConjunto?: { url: string; cor: string | null }[] // fotos das peças juntas (página do conjunto)
}

interface InfoPecaNaCor {
  caixa: string | null
  estoque: number
  programacao?: boolean
  previsao?: string | null
  preco?: number | null // por peça
  pecas?: number // peças por caixa (para o valor da caixa)
}

const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
  if (tokens.some((t) => OUTROS_ANGULOS.includes(t))) return 2
  // Foto numerada (ex.: "VERDE_1"): número curto separado por "_". Números do nome da cor
  // ("print-373-1") e o código da referência ("430672_...") não contam.
  const partes = arquivo.replace(/\.[^.]+$/, '').split('_')
  if (partes.some((p) => /^\d{1,3}$/.test(p.trim()))) return 2
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
  // Junta as fotos da cor de TODAS as peças (no conjunto: blusa e saia), frentes primeiro
  const fotosDaCor = (nomeCor: string): string[] => {
    const achadas: { arquivo: string; url: string; peca: number }[] = []
    pastasPorPeca.forEach((pp, peca) => {
      const pasta = acharPastaDaCor(nomeCor, pp.pastas)
      if (pasta) ordenarFotos(pp.fotos[pasta]).forEach((a) => achadas.push({ arquivo: a, url: url(pp.ref, a), peca }))
    })
    // Amostra de cor (tecido) só uma vez, mesmo que as duas peças tenham a sua
    let temAmostra = false
    // Agrupa por peça (todas as fotos da blusa, depois todas da saia); amostra de cor no fim
    const ehAmostra = (arquivo: string) => (tipoDaFoto(arquivo) === 3 ? 1 : 0)
    return achadas
      .sort(
        (a, b) =>
          ehAmostra(a.arquivo) - ehAmostra(b.arquivo) ||
          a.peca - b.peca ||
          tipoDaFoto(a.arquivo) - tipoDaFoto(b.arquivo)
      )
      .filter((f) => {
        if (tipoDaFoto(f.arquivo) !== 3) return true
        if (temAmostra) return false
        temAmostra = true
        return true
      })
      .map((f) => f.url)
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
  // Junta as fotos da cor de TODAS as peças (no conjunto: blusa e saia), frentes primeiro
  const fotosDaCor = (nomeCor: string): string[] => {
    const achadas: { arquivo: string; url: string; peca: number }[] = []
    pastasPorPeca.forEach((pp, peca) => {
      const pasta = acharPastaDaCor(nomeCor, pp.pastas)
      if (pasta) ordenarFotos(pp.fotos[pasta]).forEach((a) => achadas.push({ arquivo: a, url: url(pp.ref, a), peca }))
    })
    // Amostra de cor (tecido) só uma vez, mesmo que as duas peças tenham a sua
    let temAmostra = false
    // Agrupa por peça (todas as fotos da blusa, depois todas da saia); amostra de cor no fim
    const ehAmostra = (arquivo: string) => (tipoDaFoto(arquivo) === 3 ? 1 : 0)
    return achadas
      .sort(
        (a, b) =>
          ehAmostra(a.arquivo) - ehAmostra(b.arquivo) ||
          a.peca - b.peca ||
          tipoDaFoto(a.arquivo) - tipoDaFoto(b.arquivo)
      )
      .filter((f) => {
        if (tipoDaFoto(f.arquivo) !== 3) return true
        if (temAmostra) return false
        temAmostra = true
        return true
      })
      .map((f) => f.url)
  }

  // Caixas que aparecem no site: letra válida e com estoque (ou em programação)
  const visiveis = (p: Peca) =>
    (p.caixas || [])
      .filter((cx) => /^[A-Za-z]+$/.test(String(cx.caixa || '').trim()))
      .filter((cx) => !cx.esgotada || cx.estoque > 0 || !!cx.programacao)

  const novaOpcao = (chave: string, cx: Caixa): CorExibida => {
    const fotosPorCor = cx.cores.map((c) => fotosDaCor(c))
    return {
      chave,
      nome: cx.cores.map((c) => formatarNome(c)).join(' + ') || `Caixa ${cx.caixa}`,
      fotos: Array.from(new Set(fotosPorCor.flat())),
      capas: fotosPorCor.map((f) => f[0]).filter(Boolean),
      cores: cx.cores.map((c) => normalizar(c)),
      pecasPorCaixa: cx.pecas,
      porPeca: {},
    }
  }
  const infoDaCaixa = (cx: Caixa) => ({
    caixa: `${cx.pecas}${cx.caixa}`,
    estoque: cx.estoque,
    programacao: !!cx.programacao,
    previsao: cx.previsao || null,
    preco: cx.preco ?? null,
    pecas: cx.pecas,
  })

  if (!ehConjunto) {
    return visiveis(pecas[0]).map((cx) => {
      const item = novaOpcao(normalizar(`${cx.pecas}${cx.caixa}`), cx)
      item.porPeca[pecas[0].referencia] = infoDaCaixa(cx)
      return item
    })
  }

  // Conjunto: a opção é a COR. Só entra se todas as peças têm caixa disponível nessa cor;
  // cada peça mostra a própria caixa (a letra pode ser diferente entre blusa e calça).
  const chaveDasCores = (cx: Caixa) => cx.cores.map((c) => normalizar(c)).sort().join('+')
  const caixasPorPeca = pecas.map((p) => {
    const mapa = new Map<string, Caixa>()
    visiveis(p).forEach((cx) => {
      const chave = chaveDasCores(cx)
      if (!chave) return
      const atual = mapa.get(chave)
      if (!atual || cx.estoque > atual.estoque) mapa.set(chave, cx)
    })
    return mapa
  })
  return Array.from(caixasPorPeca[0].keys())
    .filter((chave) => caixasPorPeca.every((mapa) => mapa.has(chave)))
    .map((chave) => {
      const item = novaOpcao(chave, caixasPorPeca[0].get(chave)!)
      pecas.forEach((p, i) => {
        item.porPeca[p.referencia] = infoDaCaixa(caixasPorPeca[i].get(chave)!)
      })
      return item
    })
}

export default function GaleriaProduto({ pecas, r2BaseUrl, fotosConjunto = [] }: GaleriaProps) {
  const principal = pecas[0]
  const ehConjunto = pecas.length > 1
  const modoCaixas = pecas.some((p) => Array.isArray(p.caixas) && p.caixas.length > 0)
  const coresBase = modoCaixas ? montarCaixas(pecas, r2BaseUrl) : montarCores(pecas, r2BaseUrl)

  // Fotos do conjunto (peças juntas) vêm primeiro. Foto sem cor vale para todas as opções.
  const cores = coresBase.map((c) => {
    const doConjunto = fotosConjunto
      // Amostra de cor vem das peças; se alguma foi copiada para o conjunto, não repete
      .filter((f) => tipoDaFoto(decodeURIComponent(f.url.split('/').pop() || '')) !== 3)
      .filter((f) => {
        // Foto sem cor: só entra se foi enviada no painel como "Todas as cores".
        // Fotos gerais copiadas da peça (costas.jpg, modelo.jpg) nunca entram.
        if (!f.cor) return decodeURIComponent(f.url).includes('_conjunto_')
        const n = normalizar(f.cor)
        return c.cores.some((x) => x === n || x.startsWith(n) || n.startsWith(x))
      })
      .sort(
        (a, b) =>
          tipoDaFoto(decodeURIComponent(a.url.split('/').pop() || '')) -
          tipoDaFoto(decodeURIComponent(b.url.split('/').pop() || ''))
      )
    if (doConjunto.length === 0) return c
    // Foto do conjunto copiada de uma peça ("232298_frente_preto.webp" é cópia de
    // "232298/frente_preto.webp"): a original da peça não aparece de novo
    const originais = new Set(
      doConjunto
        .map((f) => {
          const nome = decodeURIComponent(f.url.split('/').pop() || '')
          const m = nome.match(/^([^_]+)_(.+)$/)
          return m && pecas.some((p) => p.referencia === m[1])
            ? `${r2BaseUrl}/${m[1]}/${encodeURIComponent(m[2])}`
            : ''
        })
        .filter(Boolean)
    )
    // A miniatura da caixa só usa foto do conjunto que tenha a cor dela; foto "de todas as cores"
    // entra na galeria, mas não vira miniatura (senão todas as caixas ficam com a mesma foto)
    const daCor = doConjunto.find((f) => !!f.cor)
    return {
      ...c,
      fotos: Array.from(new Set([...doConjunto.map((f) => f.url), ...c.fotos.filter((u) => !originais.has(u))])),
      capas: daCor ? [daCor.url] : c.capas.length > 0 ? c.capas : [doConjunto[0].url],
    }
  })

  const temEstoque = (c: CorExibida) => Object.values(c.porPeca).some((i) => i.estoque > 0)
  const temProgramacao = (c: CorExibida) => Object.values(c.porPeca).some((i) => i.programacao)
  const temCorNeutra = (c: CorExibida) => c.cores.length > 0 && c.cores.every((x) => ehCorNeutra(x))
  const combina = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)

  // Abre na cor escolhida no painel; senão, numa opção com foto e estoque, evitando preto/branco
  const corDoPainel = pecas.map((p) => (p.corCapa ? normalizar(p.corCapa) : '')).find(Boolean) || ''
  const corInicial =
    (corDoPainel && cores.find((c) => temEstoque(c) && c.cores.some((x) => combina(x, corDoPainel)))) ||
    (corDoPainel && cores.find((c) => c.cores.some((x) => combina(x, corDoPainel)))) ||
    cores.find((c) => c.fotos.length > 0 && temEstoque(c) && !temCorNeutra(c)) ||
    cores.find((c) => c.fotos.length > 0 && temEstoque(c)) ||
    cores.find((c) => c.fotos.length > 0 && temProgramacao(c)) ||
    cores.find((c) => c.fotos.length > 0 && !temCorNeutra(c)) ||
    cores.find((c) => c.fotos.length > 0) ||
    cores[0]

  const [chaveSelecionada, setChaveSelecionada] = useState<string | null>(corInicial?.chave ?? null)
  const [indiceFoto, setIndiceFoto] = useState(0)

  // Galeria lateral com rolagem própria, da mesma altura da foto principal
  const quadroRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const [alturaQuadro, setAlturaQuadro] = useState<number | null>(null)
  useEffect(() => {
    const quadro = quadroRef.current
    if (!quadro || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(() => setAlturaQuadro(quadro.offsetHeight))
    obs.observe(quadro)
    return () => obs.disconnect()
  }, [])
  // Proporção do quadro da foto principal: segue a foto (as suas são 4:5). Amostra de cor
  // (quadrada) não muda o quadro, para a página não "pular" ao passar as fotos.
  const [proporcaoQuadro, setProporcaoQuadro] = useState(0.8)
  const ajustarQuadro = (p: number) => {
    if (p < 0.9) setProporcaoQuadro(Math.min(0.85, Math.max(0.6, p)))
  }

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

  // Mantém a miniatura da foto atual visível dentro da galeria lateral (sem rolar a página)
  useEffect(() => {
    const lista = listaRef.current
    const botao = lista?.querySelector<HTMLElement>(`[data-indice="${indiceFoto}"]`)
    if (!lista || !botao) return
    if (lista.scrollHeight > lista.clientHeight + 1) {
      lista.scrollTo({ top: botao.offsetTop - lista.clientHeight / 2 + botao.clientHeight / 2, behavior: 'smooth' })
    } else if (lista.scrollWidth > lista.clientWidth + 1) {
      lista.scrollTo({ left: botao.offsetLeft - lista.clientWidth / 2 + botao.clientWidth / 2, behavior: 'smooth' })
    }
  }, [indiceFoto, chaveSelecionada])

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
        <div
          ref={listaRef}
          className={styles.listaMiniaturas}
          style={
            alturaQuadro
              ? ({ '--altura-miniaturas': `${Math.max(alturaQuadro - (fotos.length > 1 ? 76 : 0), 200)}px` } as React.CSSProperties)
              : undefined
          }
        >
          {fotos.map((foto, idx) => (
            <button
              key={foto}
              data-indice={idx}
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
        <div ref={quadroRef} className={styles.wrapperFotoPrincipal} style={{ aspectRatio: String(proporcaoQuadro) }}>
          {fotos.length > 1 && (
            <button type="button" onClick={fotoAnterior} className={`${styles.setaLateral} ${styles.setaEsquerda}`} aria-label="Foto anterior">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          {fotoPrincipal ? (
            <ImagemAjustavel onMedida={ajustarQuadro} src={fotoPrincipal} alt={`${tituloExibicao} - ${corAtual?.nome ?? ''}`} className={`${styles.imgPrincipal} ${ehAmostra ? styles.imgAmostra : ''}`} />
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

        {/* Preço (só aparece se estiver liberado para quem está vendo) */}
        {!ehConjunto && principal.precoPeca ? (
          <p className={styles.precoDestaque}>
            <strong>{real(principal.precoPeca)}</strong>
            <span>por peça</span>
          </p>
        ) : null}
        {ehConjunto && pecas.every((p) => p.precoPeca) ? (
          <p className={styles.precoDestaque}>
            <strong>{real(pecas.reduce((soma, p) => soma + (p.precoPeca || 0), 0))}</strong>
            <span>o conjunto (soma de uma peça de cada)</span>
          </p>
        ) : null}

        {ehConjunto ? (
          <div className={styles.listaPecasConjunto}>
            {pecas.map((p) => (
              <div key={p.referencia} className={styles.blocoPeca}>
                <p className={styles.linhaResumoPeca}>{rotuloCurto(p)}</p>
                <p className={styles.linhaDetalhe}>{p.descricao}</p>
                {p.precoPeca ? (
                  <p className={styles.linhaDetalhe}>
                    <strong>Preço:</strong> {real(p.precoPeca)} por peça
                  </p>
                ) : null}
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
                      {temEstoque(cor) ? (
                        <span className={styles.seloPE}>P.E.</span>
                      ) : temProgramacao(cor) ? (
                        <span className={styles.seloProg}>PROG.</span>
                      ) : (
                        <span className={styles.seloVazio}></span>
                      )}
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
                    {info?.preco ? (
                      <span className={styles.linhaPreco}>
                        <strong>{real(info.preco)}</strong> por peça
                        {info.pecas ? ` · caixa com ${info.pecas}: ${real(info.preco * info.pecas)}` : ''}
                      </span>
                    ) : null}
                  </span>
                  {!info ? (
                    <span className={styles.badgeEsgotado}>{modoCaixas ? 'Não tem esta caixa' : 'Não tem nesta cor'}</span>
                  ) : (
                    <span
                      className={
                        info.estoque > 0
                          ? styles.badgeEstoque
                          : info.programacao
                            ? styles.badgeProgramacao
                            : styles.badgeEsgotado
                      }
                    >
                      {info.estoque > 0
                        ? `${info.estoque} cxs.`
                        : info.programacao
                          ? `Programação${info.previsao ? ` · previsão ${info.previsao}` : ''}`
                          : 'Esgotado'}
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
