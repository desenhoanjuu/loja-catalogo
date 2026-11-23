import { cache } from 'react'
import { lerSessao } from './sessao-servidor'
import { supabaseAdmin } from './supabase-admin'

// Regra de preço de quem está vendo o site:
//   - equipe/donos: preço original do Millennium, sem ajuste;
//   - cliente: só vê preço se o vendedor ligou no código de acesso (tabela + ajuste em %).
export interface RegraPreco {
  tabela: 'original' | 'promocional'
  ajuste: number // em %, ex.: -10 = 10% de desconto
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
  return Math.round(valor * (1 + (regra.ajuste || 0) / 100) * 100) / 100
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
  return aplicarAjuste(base, ctx.regra)
}

export function formatarReal(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return ''
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
