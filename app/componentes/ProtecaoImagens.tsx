'use client'

import { useEffect } from 'react'

// Proteção para clientes: sem botão direito / arrastar nas fotos, sem atalhos de salvar,
// imprimir ou ver código, e limpa a área de transferência quando apertam Print Screen.
// Não impede 100% (ninguém consegue), mas barra o caminho fácil.
export default function ProtecaoImagens() {
  useEffect(() => {
    const ehImagem = (alvo: EventTarget | null) =>
      alvo instanceof HTMLElement && (alvo.tagName === 'IMG' || !!alvo.closest('img, picture'))

    const bloquearMenu = (e: MouseEvent) => {
      if (ehImagem(e.target)) e.preventDefault()
    }
    const bloquearArrastar = (e: DragEvent) => {
      if (ehImagem(e.target)) e.preventDefault()
    }
    const bloquearAtalhos = (e: KeyboardEvent) => {
      const tecla = e.key.toLowerCase()
      const comando = e.ctrlKey || e.metaKey
      if (
        (comando && ['s', 'p', 'u'].includes(tecla)) || // salvar, imprimir, ver código-fonte
        (comando && e.shiftKey && ['i', 'j', 'c'].includes(tecla)) || // ferramentas do navegador
        e.key === 'F12'
      ) {
        e.preventDefault()
      }
    }
    const aposPrintScreen = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {})
      }
    }

    document.addEventListener('contextmenu', bloquearMenu)
    document.addEventListener('dragstart', bloquearArrastar)
    document.addEventListener('keydown', bloquearAtalhos)
    document.addEventListener('keyup', aposPrintScreen)
    return () => {
      document.removeEventListener('contextmenu', bloquearMenu)
      document.removeEventListener('dragstart', bloquearArrastar)
      document.removeEventListener('keydown', bloquearAtalhos)
      document.removeEventListener('keyup', aposPrintScreen)
    }
  }, [])

  return null
}
