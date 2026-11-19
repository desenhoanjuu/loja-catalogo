'use client'

import { useEffect } from 'react'

// Barras com rolagem lateral (menu de departamentos e abas das marcas): ao abrir a página,
// rola até o item ativo, para ele não ficar escondido fora da tela no celular.
export default function RolarMenuAtivo({ ids }: { ids: string[] }) {
  useEffect(() => {
    ids.forEach((id) => {
      const barra = document.getElementById(id)
      const ativo = barra?.querySelector<HTMLElement>('[data-ativo="true"]')
      if (!barra || !ativo || barra.scrollWidth <= barra.clientWidth) return
      const caixaBarra = barra.getBoundingClientRect()
      const caixaAtivo = ativo.getBoundingClientRect()
      barra.scrollLeft += caixaAtivo.left - caixaBarra.left - (barra.clientWidth - caixaAtivo.width) / 2
    })
  }, [ids])
  return null
}
