'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import styles from './GaleriaProduto.module.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface GaleriaProps {
  referencia: string
  descricao: string
  marca: string
  tipoPeca?: string | null
  grade?: string | null
  tecido?: string | null
  composicao?: string | null
  estoque: number
  fotosPorCor: Record<string, string[]>
  r2BaseUrl: string
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
  return texto.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function normalizarTexto(texto: string) {
  if (!texto) return ''
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
}

export default function GaleriaProduto({
  referencia,
  descricao,
  marca,
  tipoPeca,
  grade,
  tecido,
  composicao,
  estoque,
  fotosPorCor,
  r2BaseUrl,
}: GaleriaProps) {
  
  const TODAS_CHAVES = Object.keys(fotosPorCor || {})
  const palavrasIgnoradas = ['costas', 'modelo', 'modelos', 'frente', 'detalhe', 'detalhes', 'padrao']
  
  let coresDisponiveis = TODAS_CHAVES.filter(
    cor => !palavrasIgnoradas.some(p => cor.toLowerCase().includes(p))
  )
  const chavesDeFotosGerais = TODAS_CHAVES.filter(
    cor => palavrasIgnoradas.some(p => cor.toLowerCase().includes(p))
  )

  if (coresDisponiveis.length === 0 && TODAS_CHAVES.length > 0) {
    coresDisponiveis = ['Única']
  }

  const temFotos = TODAS_CHAVES.length > 0
  const [corSelecionada, setCorSelecionada] = useState<string>(coresDisponiveis.length > 0 ? coresDisponiveis[0] : 'Única')
  const [indiceFoto, setIndiceFoto] = useState<number>(0)
  
  const [caixasPorCor, setCaixasPorCor] = useState<Record<string, string>>({})
  const [estoquePorCor, setEstoquePorCor] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('produtos')
        .select('caixas_por_cor, estoque_por_cor')
        .eq('referencia', referencia)
        .single()
        
      if (error) {
        console.error("Erro ao buscar dados complementares:", error)
        return
      }

      if (data) {
        if (data.caixas_por_cor) setCaixasPorCor(data.caixas_por_cor)
        if (data.estoque_por_cor) setEstoquePorCor(data.estoque_por_cor)
      }
    }
    fetchData()
  }, [referencia])

  // Busca geral da cor selecionada atualmente
  const buscaNorm = normalizarTexto(corSelecionada)

  const chaveEstoque = Object.keys(estoquePorCor || {}).find(k => {
    const dbNorm = normalizarTexto(k)
    return buscaNorm.includes(dbNorm) || dbNorm.includes(buscaNorm)
  })
  const estoqueSelecionado = chaveEstoque && estoquePorCor[chaveEstoque] !== undefined ? estoquePorCor[chaveEstoque] : 0

  const chaveCaixa = Object.keys(caixasPorCor || {}).find(k => {
    const dbNorm = normalizarTexto(k)
    return buscaNorm.includes(dbNorm) || dbNorm.includes(buscaNorm)
  })
  const caixaSelecionada = chaveCaixa ? caixasPorCor[chaveCaixa] : null


  // Processamento de fotos
  let fotosBrutas = fotosPorCor[corSelecionada] || []
  if (corSelecionada === 'Única' && !fotosPorCor['Única']) fotosBrutas = []
  
  chavesDeFotosGerais.forEach(chave => {
    fotosBrutas = [...fotosBrutas, ...(fotosPorCor[chave] || [])]
  })
  fotosBrutas = Array.from(new Set(fotosBrutas))
  
  const fotosDaCorAtual = temFotos ? ordenarFotos(fotosBrutas) : []
  const montarUrlFoto = (nomeArquivo: string) => `${r2BaseUrl}/${referencia}/${encodeURIComponent(nomeArquivo)}`
  const fotoPrincipal = fotosDaCorAtual.length > 0 ? montarUrlFoto(fotosDaCorAtual[indiceFoto] || fotosDaCorAtual[0]) : null

  const trocarCor = (novaCor: string) => {
    setCorSelecionada(novaCor)
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

  const tituloExibicao = descricao
  const subtituloExibicao = tipoPeca ? formatarNome(tipoPeca) : 'Produto'

  return (
    <div className={styles.gridProduto}>
      {/* COLUNA 1: Miniaturas Verticais */}
      <div className={styles.colunaMiniaturas}>
        {fotosDaCorAtual.length > 1 && (
          <button type="button" onClick={fotoAnterior} className={styles.setaVertical}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
        )}
        <div className={styles.listaMiniaturas}>
          {fotosDaCorAtual.map((arquivo, idx) => (
            <button key={arquivo} type="button" onClick={() => setIndiceFoto(idx)} className={`${styles.btnMiniatura} ${idx === indiceFoto ? styles.btnMiniaturaAtiva : ''}`}>
              <img src={montarUrlFoto(arquivo)} alt={`Foto ${idx + 1}`} className={styles.imgMiniatura} />
            </button>
          ))}
        </div>
        {fotosDaCorAtual.length > 1 && (
          <button type="button" onClick={proximaFoto} className={styles.setaVertical}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
      </div>

      {/* COLUNA 2: Foto Principal Central */}
      <div className={styles.colunaPrincipal}>
        <div className={styles.wrapperFotoPrincipal}>
          {fotosDaCorAtual.length > 1 && (
            <button type="button" onClick={fotoAnterior} className={`${styles.setaLateral} ${styles.setaEsquerda}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          {fotoPrincipal ? (
            <img src={fotoPrincipal} alt={tituloExibicao} className={styles.imgPrincipal} />
          ) : (
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>Sem imagem</span>
          )}

          {fotosDaCorAtual.length > 1 && (
            <button type="button" onClick={proximaFoto} className={`${styles.setaLateral} ${styles.setaDireita}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          {fotosDaCorAtual.length > 1 && (
            <div className={styles.indicadoresBase}>
              {fotosDaCorAtual.map((_, idx) => (
                <button key={idx} type="button" onClick={() => setIndiceFoto(idx)} className={`${styles.indicadorPonto} ${idx === indiceFoto ? styles.indicadorPontoAtivo : ''}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COLUNA 3: Informações - PADRÃO LAYOUT 1 */}
      <div className={styles.colunaInfo}>
        {marca && <span className={styles.tagMarca}>{marca}</span>}

        <h1 className={styles.tituloProduto}>{tituloExibicao}</h1>
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

        {coresDisponiveis.length > 0 && (
          <div>
            <p className={styles.labelCor}>
              Cor: <strong>{formatarNome(corSelecionada)}</strong>
            </p>

            <div className={styles.gridCores}>
              {coresDisponiveis.map((cor) => {
                const fotosOrdenadas = ordenarFotos(fotosPorCor[cor] || [])
                const primeiraFotoCor = fotosOrdenadas[0]
                const selecionada = cor === corSelecionada
                
                // Busca se a cor iterada tem uma caixa no banco de dados para exibir a tag em cima da foto
                const iteradaNorm = normalizarTexto(cor)
                const iteradaCaixaChave = Object.keys(caixasPorCor || {}).find(k => {
                  const dbNorm = normalizarTexto(k)
                  return iteradaNorm.includes(dbNorm) || dbNorm.includes(iteradaNorm)
                })
                const nomeCaixa = iteradaCaixaChave ? caixasPorCor[iteradaCaixaChave] : null

                return (
                  <button key={cor} type="button" onClick={() => trocarCor(cor)} className={styles.itemCorBox}>
                    
                    {/* Linha 1: Selo P.E. (Se houver estoque, senão fica vazio para manter a altura) */}
                    <div className={styles.selosCaixaTopo}>
                      {estoquePorCor[iteradaCaixaChave || ''] > 0 ? <span className={styles.seloPE}>P.E.</span> : <span className={styles.seloVazio}></span>}
                    </div>
                    
                    {/* Linha 2: O nome da caixa, fora da imagem */}
                    <span className={styles.nomeCaixaTopo}>{nomeCaixa ? `CX-${nomeCaixa}` : 'CX'}</span>

                    {/* Linha 3: A Imagem da modelo 100% livre */}
                    <div className={`${styles.thumbCor} ${selecionada ? styles.thumbCorAtiva : ''}`}>
                      {primeiraFotoCor && (
                        <img src={montarUrlFoto(primeiraFotoCor)} alt={cor} className={styles.imgCor} />
                      )}
                    </div>
                    
                    {/* Linha 4: O nome da cor embaixo */}
                    <span className={`${styles.nomeCor} ${selecionada ? styles.nomeCorAtiva : ''}`}>
                      {formatarNome(cor)}
                    </span>

                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className={styles.boxDisponibilidade}>
          <span>Disponibilidade: <strong>{formatarNome(corSelecionada)} {caixaSelecionada ? `(CX-${caixaSelecionada})` : ''}</strong></span>
          <span className={estoqueSelecionado > 0 ? styles.badgeEstoque : styles.badgeEsgotado}>
            {estoqueSelecionado > 0 ? `${estoqueSelecionado} cxs.` : 'Esgotado'}
          </span>
        </div>
      </div>
    </div>
  )
}