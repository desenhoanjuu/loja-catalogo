'use client'

import { useEffect, useRef, useState } from 'react'

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string
  onMedida?: (proporcao: number) => void // largura ÷ altura da foto, assim que ela carrega
}

// Imagem que, se for quadrada (ex.: amostra de cor 1x1), cresce para preencher o quadro.
// Fotos de modelo (verticais) continuam inteiras, sem corte.
export default function ImagemAjustavel({ src, style, alt = '', onMedida, ...resto }: Props) {
  const ref = useRef<HTMLImageElement>(null)
  const [quadrada, setQuadrada] = useState(false)

  const medir = () => {
    const img = ref.current
    if (img && img.naturalWidth && img.naturalHeight) {
      const proporcao = img.naturalWidth / img.naturalHeight
      setQuadrada(proporcao >= 0.9)
      onMedida?.(proporcao)
    }
  }

  // Foto que já veio do cache do navegador carrega antes do React: mede na hora
  useEffect(() => {
    setQuadrada(false)
    if (ref.current?.complete) medir()
  }, [src])

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      onLoad={medir}
      style={quadrada ? { ...style, objectFit: 'cover', objectPosition: 'center' } : style}
      {...resto}
    />
  )
}
