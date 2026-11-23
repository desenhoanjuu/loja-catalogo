import type { Caixa, Peca } from '../produto/[referencia]/GaleriaProduto'
import type { Produto } from './catalogo'
import { ContextoPreco, precoUnitario } from './precos'

// Converte a linha do banco no formato que a galeria do produto usa.
// Com o contexto de preço, cada caixa recebe o preço por peça já calculado para quem está vendo.
export function produtoParaPeca(p: Produto, ctx?: ContextoPreco): Peca {
  const caixas = Array.isArray(p.caixas)
    ? (p.caixas.map((cx: Produto) => ({
        ...cx,
        preco: ctx ? precoUnitario(p.referencia, cx.preco_pc || p.preco_peca, ctx) : null,
      })) as Caixa[])
    : null
  return {
    referencia: p.referencia,
    descricao: p.descricao || `Referência ${p.referencia}`,
    marca: p.marca,
    tipoPeca: p.tipo_peca,
    grade: p.grade,
    composicao: p.composicao,
    fotosPorCor: p.fotos || {},
    caixasPorCor: p.caixas_por_cor || {},
    estoquePorCor: p.estoque_por_cor || {},
    corCapa: p.cor_capa || null,
    caixas,
    precoPeca: ctx ? precoUnitario(p.referencia, p.preco_peca, ctx) : null,
  }
}
