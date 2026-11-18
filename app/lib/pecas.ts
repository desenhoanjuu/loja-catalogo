import type { Peca } from '../produto/[referencia]/GaleriaProduto'
import type { Produto } from './catalogo'

// Converte a linha do banco no formato que a galeria do produto usa
export function produtoParaPeca(p: Produto): Peca {
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
    caixas: Array.isArray(p.caixas) ? p.caixas : null,
  }
}
