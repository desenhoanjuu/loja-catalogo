import { cache } from 'react'
import { lerSessao } from './sessao-servidor'
import { supabaseAdmin } from './supabase-admin'

// Regra de preço de quem está vendo o site:
//   - equipe/donos: preço original do Millennium, sem ajuste;
//   - cliente: só vê preço se o vendedor ligou no código de acesso (tabela + ajuste em %).
export interface RegraPreco {
  tabela: 'original' | 'promocional'
  ajuste: number // em %, ex.: -10 = 10% de desconto
  acrescimo?: number // em R$ por peça, ex.: 3 = soma R$ 3,00; -2.5 = desconta R$ 2,50
}

export interface ContextoPreco {
  regra: RegraPreco | null // null = não mostra preço
  promocionais: Record<string, number> // referência -> preço da planilha publicada
}

// Uma vez por página (cache do React), mesmo com centenas de cards
export const contextoPreco = cache(async (): Promise<ContextoPreco> => {
  const sessao = await lerSessao()
  let regra: RegraPreco | null = null
  if (sessao?.tipo === 'equipe') regra = { tabela: 'original', ajuste: 0 }
  else if (sessao?.tipo === 'cliente' && sessao.preco) regra = sessao.preco

  const promocionais: Record<string, number> = {}
  if (regra?.tabela === 'promocional') {
    try {
      const { data } = await supabaseAdmin().from('precos_promocionais').select('referencia, preco').limit(20000)
      data?.forEach((l) => {
        if (Number(l.preco) > 0) promocionais[String(l.referencia).toUpperCase()] = Number(l.preco)
      })
    } catch {
      // sem a tabela ainda: usa o preço original
    }
  }
  return { regra, promocionais }
})

function aplicarAjuste(valor: number, regra: RegraPreco): number {
  const comPercentual = valor * (1 + (regra.ajuste || 0) / 100)
  return Math.round((comPercentual + (regra.acrescimo || 0)) * 100) / 100
}

// Preço por peça de uma caixa (ou da referência, sem caixa). A planilha promocional vale para a
// referência inteira (todas as caixas), como no gerador de catálogo.
export function precoUnitario(
  referencia: string,
  precoOriginal: number | null | undefined,
  ctx: ContextoPreco
): number | null {
  if (!ctx.regra) return null
  const promo = ctx.regra.tabela === 'promocional' ? ctx.promocionais[String(referencia).toUpperCase()] : undefined
  const base = promo || Number(precoOriginal) || 0
  if (!base) return null
  const final = aplicarAjuste(base, ctx.regra)
  return final > 0 ? final : null // desconto maior que o preço: não mostra valor errado
}

// Caixa usada no card da vitrine: a primeira caixa que aparece no site (letra válida, com estoque
// ou em programação). Devolve o preço por peça e o valor da caixa para quem está vendo.
export function precoDoCard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p: Record<string, any>,
  ctx: ContextoPreco
): { peca: number; caixa: number | null; pecas: number | null } | null {
  const caixas = (Array.isArray(p.caixas) ? p.caixas : []) as {
    caixa?: string
    pecas?: number
    estoque?: number
    esgotada?: boolean
    programacao?: boolean
    preco_pc?: number
  }[]
  const cx = caixas.find(
    (c) =>
      /^[A-Za-z]+$/.test(String(c.caixa || '').trim()) &&
      (!c.esgotada || (c.estoque || 0) > 0 || !!c.programacao) &&
      (c.pecas || 0) > 0
  )
  const peca = precoUnitario(p.referencia, cx?.preco_pc || p.preco_peca, ctx)
  if (!peca) return null
  const pecas = cx?.pecas || null
  return { peca, caixa: pecas ? Math.round(peca * pecas * 100) / 100 : null, pecas }
}

export function formatarReal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ''
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
